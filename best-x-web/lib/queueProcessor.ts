import { DB } from './DB';
import QueueModel from './models/QueueModel';
import { TaskHandlerFactory } from './taskHandlers';
import type { Task } from './models/QueueModel';

export class QueueProcessor {
  private db: DB;
  private queueModel: QueueModel;
  private taskHandlerFactory: TaskHandlerFactory;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private workerId: string;
  
  constructor(db: DB) {
    this.db = db;
    this.queueModel = new QueueModel(db);
    this.taskHandlerFactory = new TaskHandlerFactory(db);
    this.workerId = `worker_${Date.now()}`;
  }
  
  // 启动队列处理器
  start(intervalMs: number = 2000): void {
    if (this.intervalId) {
      console.log('⚠️ 队列处理器已在运行');
      return;
    }
    
    console.log(`🚀 队列处理器已启动 (检查间隔: ${intervalMs}ms)`);
    
    // 立即执行一次
    this.processNext();
    
    // 设置定时器
    this.intervalId = setInterval(() => {
      if (!this.isProcessing) {
        this.processNext();
      }
    }, intervalMs);
  }
  
  // 停止队列处理器
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 队列处理器已停止');
    }
  }
  
  // 处理下一个任务
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // 获取下一个任务
      const task = this.queueModel.getNextTask(this.workerId);
      
      if (!task) {
        // 队列为空
        return;
      }
      
      console.log(`\n📋 开始处理任务 #${task.task_id} (类型: ${task.type || 'extract'})`);
      
      // 获取对应的处理器
      const taskType = task.type || 'extract'; // 默认为 extract 以兼容旧数据
      const handler = this.taskHandlerFactory.getHandler(taskType);
      
      if (!handler) {
        console.error(`❌ 未知任务类型: ${taskType}`);
        this.queueModel.failTask(task.task_id, `不支持的任务类型: ${taskType}`);
        return;
      }
      
      try {
        // 解析参数
        let params: any;
        if (task.params) {
          params = JSON.parse(task.params);
          console.log(`📄 解析参数: ${JSON.stringify(params)}`);
        } else {
          // 兼容旧的 extract 任务
          params = { url: task.url, scrollTimes: task.scroll_times };
          console.log(`📄 使用旧格式参数: ${JSON.stringify(params)}`);
        }
        
        // 更新进度
        this.queueModel.updateProgress(task.task_id, 10, `正在处理 ${taskType} 任务...`);
        
        console.log(`🔧 使用处理器: ${taskType}, 参数: ${JSON.stringify(params)}`);
        
        // 执行任务
        const result = await handler.execute(params);
        
        // 处理结果
        if (taskType === 'extract' && result.extractionId) {
          // extract 任务：更新 result_id
          this.queueModel.completeTask(task.task_id, result.extractionId);
        } else {
          // 其他任务：将结果存储在数据库的某个地方或直接标记完成
          // 可以考虑将结果存储在 task_queue 表的新字段中
          this.markTaskCompleted(task.task_id, result);
        }
        
        console.log(`✅ 任务 #${task.task_id} 完成`);
        
      } catch (error: any) {
        console.error(`❌ 任务 #${task.task_id} 失败:`, error.message);
        this.queueModel.failTask(task.task_id, error.message || '未知错误');
      }
      
    } catch (error) {
      console.error('队列处理器错误:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  // 标记任务完成（通用方法）
  private markTaskCompleted(taskId: string, result: any): void {
    const stmt = this.db.getDB().prepare(`
      UPDATE task_queue
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          progress = 100,
          result_id = ?,
          progress_message = ?
      WHERE task_id = ?
    `);
    
    // 将结果转为 JSON 字符串存储在 progress_message 中（临时方案）
    // 未来可以添加专门的 result 字段
    stmt.run(
      result.extractionId || null,
      JSON.stringify(result),
      taskId
    );
  }
  
  // 清理旧任务（可选）
  cleanOldTasks(daysToKeep: number = 7): void {
    const stmt = this.db.getDB().prepare(`
      DELETE FROM task_queue
      WHERE completed_at < datetime('now', '-' || ? || ' days')
      AND status IN ('completed', 'failed', 'cancelled')
    `);
    
    const result = stmt.run(daysToKeep);
    console.log(`🧹 清理了 ${result.changes} 个旧任务`);
  }
}