import { DB } from '../DB';
import Database from 'better-sqlite3';
import { DEFAULT_SCROLLS } from '../consts';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'extract' | 'translate' | 'summary';

export interface Task {
  id: number;
  task_id: string;
  type: TaskType;  // 新增任务类型
  url: string;  // 保留以兼容旧代码
  scroll_times: number;  // 保留以兼容旧代码
  params: string | null;  // JSON 格式的参数
  status: TaskStatus;
  priority: number;
  retry_count: number;
  worker_id: string | null;
  progress: number;
  progress_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_id: number | null;
  user_id: string | null;
}

export interface QueueStatus {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  currentTask: {
    task_id: string;
    url: string;
    progress: number;
    message: string;
    elapsed: number;
  } | null;
  queue: Array<{
    position: number;
    task_id: string;
    url: string;
    estimatedTime: string;
  }>;
  recent: Array<{
    task_id: string;
    url: string;
    status: 'completed' | 'failed';
    completedAt: string;
    error?: string;
  }>;
  allTasks?: Task[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default class QueueModel {
  private db: Database.Database;

  constructor(dbInstance: DB) {
    this.db = dbInstance.getDB();
  }

  // 生成唯一的任务ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 添加任务到队列（保留旧方法以兼容）
  addTask(url: string, scrollTimes: number = DEFAULT_SCROLLS, userId?: string): string {
    return this.addGenericTask('extract', { url, scrollTimes }, userId);
  }
  
  // 添加通用任务到队列
  addGenericTask(type: TaskType, params: any, userId?: string, priority: number = 0): string {
    const taskId = this.generateTaskId();
    
    // 对于 extract 类型，保持向后兼容
    if (type === 'extract') {
      const stmt = this.db.prepare(`
        INSERT INTO task_queue (task_id, type, url, scroll_times, params, user_id, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        taskId, 
        type,
        params.url || '', 
        params.scrollTimes || DEFAULT_SCROLLS,
        JSON.stringify(params),
        userId || null,
        priority
      );
    } else {
      // 其他类型的任务
      const stmt = this.db.prepare(`
        INSERT INTO task_queue (task_id, type, params, user_id, priority, url, scroll_times)
        VALUES (?, ?, ?, ?, ?, '', 0)
      `);
      stmt.run(taskId, type, JSON.stringify(params), userId || null, priority);
    }
    
    console.log(`📝 ${type} 任务已入队: ${taskId}`);
    return taskId;
  }

  // 获取下一个待处理的任务并标记为处理中
  getNextTask(workerId: string = 'default'): Task | null {
    const db = this.db;
    
    // 使用事务确保原子性
    const transaction = db.transaction(() => {
      // 查找下一个待处理任务
      const task = db.prepare(`
        SELECT * FROM task_queue
        WHERE status = 'pending'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      `).get() as Task | undefined;
      
      if (!task) return null;
      
      // 更新任务状态为处理中
      db.prepare(`
        UPDATE task_queue
        SET status = 'processing',
            started_at = CURRENT_TIMESTAMP,
            worker_id = ?
        WHERE id = ?
      `).run(workerId, task.id);
      
      return task;
    });
    
    return transaction() as Task | null;
  }

  // 更新任务进度
  updateProgress(taskId: string, progress: number, message?: string): void {
    const stmt = this.db.prepare(`
      UPDATE task_queue
      SET progress = ?,
          progress_message = ?
      WHERE task_id = ?
    `);
    
    stmt.run(progress, message || null, taskId);
  }

  // 标记任务完成
  completeTask(taskId: string, resultId: number): void {
    const stmt = this.db.prepare(`
      UPDATE task_queue
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          progress = 100,
          result_id = ?
      WHERE task_id = ?
    `);
    
    stmt.run(resultId, taskId);
    console.log(`✅ 任务完成: ${taskId}`);
  }

  // 标记任务失败
  failTask(taskId: string, errorMessage: string): void {
    const stmt = this.db.prepare(`
      UPDATE task_queue
      SET status = 'failed',
          completed_at = CURRENT_TIMESTAMP,
          error_message = ?
      WHERE task_id = ?
    `);
    
    stmt.run(errorMessage, taskId);
    console.log(`❌ 任务失败: ${taskId} - ${errorMessage}`);
  }

  // 获取任务状态
  getTask(taskId: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT * FROM task_queue
      WHERE task_id = ?
    `);
    
    return stmt.get(taskId) as Task | null;
  }

  // 获取队列状态概览（支持分页）
  getQueueStatus(page: number = 1, pageSize: number = 10, filter: string = 'all'): QueueStatus {
    const db = this.db;
    
    // 统计各状态任务数
    const summary = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM task_queue
      WHERE created_at > datetime('now', '-24 hours')
    `).get() as any;
    
    // 构建筛选条件
    let whereClause = "created_at > datetime('now', '-24 hours')";
    if (filter !== 'all') {
      whereClause += ` AND status = '${filter}'`;
    }
    
    // 获取符合条件的总数（用于计算总页数）
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM task_queue
      WHERE ${whereClause}
    `).get() as any;
    
    // 计算分页偏移
    const offset = (page - 1) * pageSize;
    
    // 获取分页后的任务列表
    const allTasks = db.prepare(`
      SELECT 
        task_id, 
        url, 
        status, 
        progress,
        progress_message,
        priority,
        created_at as createdAt,
        started_at as startedAt, 
        completed_at as completedAt,
        error_message as error,
        CASE 
          WHEN status = 'processing' THEN (strftime('%s', 'now') - strftime('%s', started_at))
          ELSE NULL
        END as elapsed
      FROM task_queue
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN status = 'processing' THEN 0
          WHEN status = 'pending' THEN 1
          WHEN status = 'completed' THEN 2
          WHEN status = 'failed' THEN 3
        END,
        created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `).all() as any[];
    
    // 获取当前处理中的任务
    const currentTask = db.prepare(`
      SELECT task_id, url, progress, progress_message,
             (strftime('%s', 'now') - strftime('%s', started_at)) as elapsed
      FROM task_queue
      WHERE status = 'processing'
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as any;
    
    // 获取排队中的任务
    const queue = db.prepare(`
      SELECT task_id, url,
             ROW_NUMBER() OVER (ORDER BY priority ASC, created_at ASC) as position
      FROM task_queue
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 10
    `).all() as any[];
    
    // 获取最近完成的任务
    const recent = db.prepare(`
      SELECT task_id, url, status, completed_at as completedAt, error_message as error
      FROM task_queue
      WHERE status IN ('completed', 'failed')
      ORDER BY completed_at DESC
      LIMIT 5
    `).all() as any[];
    
    // 计算预估时间（简单估算：每个任务30秒）
    const queueWithEstimate = queue.map((task: any) => ({
      ...task,
      estimatedTime: `${task.position * 30}秒后`
    }));
    
    return {
      summary: {
        pending: summary?.pending || 0,
        processing: summary?.processing || 0,
        completed: summary?.completed || 0,
        failed: summary?.failed || 0
      },
      currentTask: currentTask ? {
        task_id: currentTask.task_id,
        url: currentTask.url,
        progress: currentTask.progress,
        message: currentTask.progress_message || '处理中...',
        elapsed: currentTask.elapsed || 0
      } : null,
      queue: queueWithEstimate,
      recent: recent.map(r => ({
        task_id: r.task_id,
        url: r.url,
        status: r.status as 'completed' | 'failed',
        completedAt: r.completedAt,
        error: r.error
      })),
      allTasks: allTasks.map(t => ({
        task_id: t.task_id,
        url: t.url,
        status: t.status,
        progress: t.progress,
        message: t.progress_message,
        priority: t.priority,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        error: t.error,
        elapsed: t.elapsed
      })),
      pagination: {
        page,
        pageSize,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / pageSize)
      }
    };
  }

  // 取消任务
  cancelTask(taskId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE task_queue
      SET status = 'cancelled',
          completed_at = CURRENT_TIMESTAMP
      WHERE task_id = ? AND status IN ('pending', 'processing')
    `);
    
    const result = stmt.run(taskId);
    return result.changes > 0;
  }

  // 清理旧任务（保留最近7天的数据）
  cleanOldTasks(): number {
    const stmt = this.db.prepare(`
      DELETE FROM task_queue
      WHERE completed_at < datetime('now', '-7 days')
        AND status IN ('completed', 'failed', 'cancelled')
    `);
    
    const result = stmt.run();
    console.log(`🧹 清理了 ${result.changes} 个旧任务`);
    return result.changes;
  }
}