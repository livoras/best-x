# 通用任务队列系统架构文档

## 概述

本项目实现了一个通用的异步任务队列系统，支持多种任务类型的处理，包括内容提取（extract）、翻译（translate）和摘要（summary）等。系统基于 SQLite 数据库实现任务持久化，采用轮询机制处理任务。

## 系统架构

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Express)                   │
├─────────────────────────────────────────────────────────┤
│  /api/task          │  /api/fetch-tweet  │  /api/queue  │
│  /api/extractions   │  /api/search       │              │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│                  Queue Model                            │
│  - addGenericTask()                                    │
│  - getNextTask()                                       │
│  - updateProgress()                                    │
│  - completeTask() / failTask()                        │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│                Queue Processor                          │
│  - 轮询间隔: 2秒                                        │
│  - 顺序处理任务                                         │
│  - 调用 TaskHandlerFactory                             │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│            Task Handler Factory                         │
├─────────────────────────────────────────────────────────┤
│  ExtractTaskHandler │ TranslateTaskHandler │ TagHandler │
│  SummaryTaskHandler │ (可扩展...)          │            │
└─────────────────────────────────────────────────────────┘
```

## 数据库结构

### task_queue 表

```sql
CREATE TABLE task_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 核心字段
    task_id TEXT UNIQUE NOT NULL,      -- 唯一任务ID (task_时间戳_随机串)
    type TEXT DEFAULT "extract",       -- 任务类型
    params TEXT,                        -- JSON格式的任务参数
    
    -- 状态管理
    status TEXT DEFAULT 'pending',     -- pending|processing|completed|failed|cancelled
    priority INTEGER DEFAULT 0,         -- 优先级（数字越小越优先）
    
    -- 执行信息
    worker_id TEXT,                     -- 处理器标识
    retry_count INTEGER DEFAULT 0,      -- 重试次数
    max_retries INTEGER DEFAULT 3,      -- 最大重试次数
    
    -- 进度追踪
    progress INTEGER DEFAULT 0,         -- 进度百分比 (0-100)
    progress_message TEXT,              -- 进度消息/结果JSON
    
    -- 时间记录
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    
    -- 结果信息
    result_id INTEGER,                  -- 关联extraction表ID（extract任务）
    error_message TEXT,                 -- 错误信息
    
    -- 兼容字段（历史原因保留）
    url TEXT NOT NULL,                  -- 兼容旧extract任务
    scroll_times INTEGER DEFAULT 3,     -- 兼容旧extract任务
    
    -- 扩展字段（未来功能）
    user_id TEXT,                       -- 用户标识
    parent_task_id TEXT,                -- 父任务ID（任务链）
    pipeline_id TEXT,                   -- 流水线ID
    step_index INTEGER DEFAULT 0        -- 流水线步骤索引
);
```

### 索引优化

- `idx_task_status`: 快速查询特定状态的任务
- `idx_task_priority`: 按优先级排序查询
- `idx_task_id`: 通过任务ID快速查找
- `idx_task_created`: 按创建时间排序
- `idx_task_type`: 按任务类型过滤

## 任务类型与处理器

### 1. Extract 任务（内容提取）

**处理器**: `ExtractTaskHandler`

**参数结构**:
```json
{
    "url": "https://x.com/...",
    "scrollTimes": 10
}
```

**处理流程**:
1. 调用 `getXPost()` 从 Twitter/X 提取内容
2. 保存提取结果到 `extractions` 表
3. 返回 `extractionId` 作为结果

### 2. Translate 任务（翻译）

**处理器**: `TranslateTaskHandler`

**参数结构**:
```json
{
    "extractionId": 106,
    "targetLang": "中文"
}
```

**处理流程**:
1. 从 `extractions` 表获取原文内容
2. 调用 Claude API (Opus模型) 进行翻译
3. 保存翻译结果到文件系统
4. 将完整翻译内容存储在 `progress_message` 中

**结果存储**:
- 文件: `/tmp/translated-{id}-{timestamp}.md`
- 数据库: `progress_message` 字段包含完整JSON结果

### 3. Summary 任务（摘要）

**处理器**: `SummaryTaskHandler`

**状态**: 待实现

**参数结构**:
```json
{
    "extractionId": 106,
    "style": "brief"
}
```

### 4. Tag 任务（AI标签分类）

**处理器**: `TagTaskHandler`

**参数结构**:
```json
{
    "extractionId": 113
}
```

**处理流程**:
1. 从 `extractions` 表获取Markdown内容
2. 调用 Claude API (Sonnet模型) 进行标签分类
3. 基于预定义标签体系进行智能匹配
4. 返回标签列表和分类理由

**结果存储**:
- 数据库: `progress_message` 字段包含标签和理由的JSON结果
```json
{
    "extractionId": 113,
    "tags": ["tech_share", "ai_ml", "tutorial"],
    "reasons": {
        "tech_share": "分享技术实现经验",
        "ai_ml": "涉及AI相关内容",
        "tutorial": "包含教程指南"
    },
    "taggedAt": "2025-08-26T07:34:57.013Z"
}
```

**预定义标签体系** (`lib/tagConfig.ts`):
- **内容类型**: tech_share, news, tutorial, opinion, announcement, discussion, resource, case_study
- **技术领域**: ai_ml, web_dev, mobile, backend, devops, security, database, frontend
- **难度级别**: beginner, intermediate, advanced, expert
- **内容特征**: with_code, with_demo, theoretical, practical, controversial, trending, evergreen

## API 端点

### 任务管理

#### POST /api/task
创建通用任务
```json
{
    "type": "translate",
    "params": {
        "extractionId": 106,
        "targetLang": "日语"
    },
    "priority": 0
}
```

#### POST /api/fetch-tweet
创建提取任务（兼容旧接口）
```json
{
    "url": "https://x.com/...",
    "scrollTimes": 10
}
```

#### GET /api/task/:taskId
查询任务状态，返回任务详情包括进度和结果

#### DELETE /api/task/:id
取消任务（仅限 pending/processing 状态）

### 提取内容管理

#### POST /api/extractions/:id/translate
为指定提取记录创建翻译任务
```json
{
    "targetLang": "英语"
}
```

#### GET /api/extractions/:id/translation
获取翻译内容结果

#### POST /api/extractions/:id/tag
为指定提取记录创建标签分类任务

#### GET /api/extractions/:id/tags
获取标签分类结果

#### GET /api/extractions/:id/article-markdown
获取 Markdown 格式的文章内容

### 队列监控

#### GET /api/queue/status
获取队列状态概览，支持分页和过滤
```
?page=1&pageSize=10&filter=pending
```

## 任务生命周期

```
创建任务 (pending)
    ↓
队列处理器轮询获取
    ↓
标记为处理中 (processing)
    ↓
执行任务处理器
    ├→ 成功: 标记完成 (completed)
    └→ 失败: 标记失败 (failed)
         ↓
    重试检查 (retry_count < max_retries)
         ├→ 是: 重新入队 (pending)
         └→ 否: 最终失败 (failed)
```

### 状态转换规则

- **pending → processing**: 队列处理器获取任务时
- **processing → completed**: 任务成功执行
- **processing → failed**: 任务执行失败
- **pending/processing → cancelled**: 用户取消任务
- **failed → pending**: 重试机制触发

## 队列处理机制

### QueueProcessor 工作流程

1. **定时轮询** (每2秒)
   - 检查是否有 pending 状态的任务
   - 按优先级和创建时间排序获取

2. **任务锁定**
   - 使用事务确保原子性
   - 设置 worker_id 防止重复处理

3. **任务执行**
   - 根据 type 字段选择对应处理器
   - 解析 params JSON 获取参数
   - 调用处理器的 execute() 方法

4. **结果处理**
   - 成功: 更新状态为 completed，存储结果
   - 失败: 更新状态为 failed，记录错误

5. **清理机制**
   - 每小时清理7天前的已完成任务

### 并发控制

- 当前实现为单线程顺序处理
- 通过 `isProcessing` 标志防止并发
- 未来可扩展为多 worker 并行处理

## 扩展性设计

### 添加新任务类型 - 标准操作流程(SOP)

#### 步骤1: 后端任务处理器实现

**文件**: `lib/taskHandlers.ts`

```typescript
// 1. 创建新的任务处理器类
export class NewTaskHandler implements TaskHandler {
  private db: DB;
  
  constructor(db: DB) {
    this.db = db;
  }
  
  async execute(params: { extractionId: number, [key: string]: any }) {
    console.log(`🔧 开始新任务: 提取记录 #${params.extractionId}`);
    
    // 获取数据
    const extractionsModel = ExtractionsModel.getInstance();
    const content = extractionsModel.getPostContentAsMarkdown(params.extractionId);
    
    // 处理逻辑
    const result = await processTask(content);
    
    // 返回结果（存储在progress_message中）
    return {
      extractionId: params.extractionId,
      result: result,
      processedAt: new Date().toISOString()
    };
  }
}

// 2. 在TaskHandlerFactory注册
this.handlers.set('newtask', new NewTaskHandler(db));
```

#### 步骤2: 更新类型定义

**文件1**: `lib/models/QueueModel.ts`
```typescript
export type TaskType = 'extract' | 'translate' | 'summary' | 'tag' | 'newtask';
```

**文件2**: `components/Dashboard.tsx`
```typescript
interface Task {
  type?: 'extract' | 'translate' | 'summary' | 'tag' | 'newtask';
  // ...
}
```

**文件3**: `app/dashboard/page.tsx`
```typescript
interface Task {
  type?: 'extract' | 'translate' | 'summary' | 'tag' | 'newtask';
  params?: string;  // 确保包含params字段
  // ...
}
```

#### 步骤3: 添加API端点

**文件**: `routes/extractionRoutes.ts`

```typescript
// 创建任务端点
router.post('/:id/newtask', async (req: Request, res: Response) => {
  try {
    const extractionId = parseInt(req.params.id);
    
    // 检查提取记录存在
    const db = DB.getInstance();
    const extraction = db.getDB()
      .prepare('SELECT id FROM extractions WHERE id = ?')
      .get(extractionId);
    
    if (!extraction) {
      return res.status(404).json({ error: '提取记录不存在' });
    }
    
    // 创建任务
    const taskParams = {
      extractionId,
      ...req.body  // 其他参数
    };
    
    const taskId = queueModel.addGenericTask('newtask', taskParams);
    
    res.json({
      taskId,
      status: 'queued',
      message: '任务已加入队列'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取结果端点
router.get('/:id/newtask-result', async (req: Request, res: Response) => {
  try {
    const extractionId = parseInt(req.params.id);
    
    const db = DB.getInstance();
    const task = db.getDB().prepare(`
      SELECT task_id, status, progress_message, completed_at
      FROM task_queue
      WHERE type = 'newtask' 
        AND params LIKE ? 
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `).get(`%"extractionId":${extractionId}%`) as any;
    
    if (!task) {
      return res.status(404).json({ error: '未找到结果' });
    }
    
    const result = JSON.parse(task.progress_message);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 步骤4: 前端集成

**文件**: `app/[[...slug]]/page.tsx`

```typescript
// 1. 添加状态管理
const [newTaskContent, setNewTaskContent] = useState<any>(null);
const [loadingNewTask, setLoadingNewTask] = useState(false);
const [hasNewTask, setHasNewTask] = useState(false);

// 2. 更新activeTab类型
const [activeTab, setActiveTab] = useState<'translation' | 'article' | 'markdown' | 'rendered' | 'tags' | 'newtask'>('article');

// 3. 检查功能可用性
const checkNewTaskAvailable = async (extractionId: number) => {
  try {
    const res = await fetch(`http://localhost:3001/api/extractions/${extractionId}/newtask-result`);
    setHasNewTask(res.ok);
    if (res.ok) {
      const data = await res.json();
      setNewTaskContent(data);
    }
  } catch (err) {
    setHasNewTask(false);
  }
};

// 4. 加载历史记录时检查
// 在loadHistoryItem函数中添加:
checkNewTaskAvailable(id);

// 5. 添加操作按钮（在历史记录列表中）
<button
  onClick={async (e) => {
    e.stopPropagation();
    const res = await fetch(`http://localhost:3001/api/extractions/${item.id}/newtask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    // 处理响应
  }}
  className="px-2 py-0.5 text-xs bg-[color] hover:bg-[color] text-[color] rounded"
>
  🔧 新任务
</button>

// 6. 添加Tab和内容显示
{hasNewTask && (
  <button onClick={() => setActiveTab('newtask')}>新任务</button>
)}

// 在switch语句中添加case
case 'newtask':
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      {/* 新任务内容显示 */}
    </div>
  );
```

#### 步骤5: Dashboard任务显示

**文件**: `components/Dashboard.tsx`

```typescript
// 在getTaskTypeDisplay()函数中添加
case 'newtask':
  return { label: '新任务', color: 'bg-[color]-100 text-[color]-700', icon: '🔧' };

// 任务描述显示
task.type === 'newtask' && taskParams.extractionId
  ? `#${taskParams.extractionId} 新任务处理`
  : ...

// 完成结果显示
else if (task.type === 'newtask') {
  return (
    <div className="text-xs text-green-600 mt-1">
      ✅ 新任务已完成
    </div>
  );
}
```

#### 检查清单

- [ ] **后端实现**
  - [ ] TaskHandler类实现 (`lib/taskHandlers.ts`)
  - [ ] TaskHandlerFactory注册
  - [ ] TaskType类型更新 (`lib/models/QueueModel.ts`)
  
- [ ] **API端点**
  - [ ] POST创建任务端点 (`routes/extractionRoutes.ts`)
  - [ ] GET获取结果端点
  
- [ ] **前端集成**
  - [ ] 状态管理变量 (`app/[[...slug]]/page.tsx`)
  - [ ] activeTab类型扩展
  - [ ] 检查和获取函数
  - [ ] 历史记录按钮
  - [ ] Tab组件
  - [ ] 内容显示组件
  
- [ ] **Dashboard支持**
  - [ ] Task接口类型更新 (`components/Dashboard.tsx`, `app/dashboard/page.tsx`)
  - [ ] 任务类型显示逻辑
  - [ ] 任务描述格式
  - [ ] 完成结果展示
  
- [ ] **测试验证**
  - [ ] 创建任务API测试
  - [ ] 任务执行验证
  - [ ] 结果获取测试
  - [ ] UI显示正确

#### 注意事项

1. **命名规范**：保持一致的命名模式（如 `newtask`, `newTaskContent`, `checkNewTaskAvailable`）
2. **错误处理**：所有async函数都要包含try-catch
3. **单例模式**：使用 `DB.getInstance()` 和 `ExtractionsModel.getInstance()`
4. **数据存储**：任务结果存储在 `progress_message` 字段（JSON格式）
5. **UI一致性**：按钮样式、Tab样式、加载状态保持与现有组件一致

### 任务链支持

利用 `parent_task_id` 字段可实现任务依赖：
```typescript
// 创建任务链
const extractId = queueModel.addGenericTask('extract', {...});
const translateId = queueModel.addGenericTask('translate', {
    extractionId: extractId,
    waitFor: extractId  // 等待前置任务
});
```

### 流水线支持

利用 `pipeline_id` 和 `step_index` 实现复杂工作流：
```typescript
// 定义流水线
const pipeline = [
    { type: 'extract', params: {...} },
    { type: 'translate', params: {...} },
    { type: 'summary', params: {...} }
];
```

## 性能考虑

### 当前瓶颈

1. **单线程处理**: 任务顺序执行，无并发
2. **轮询开销**: 每2秒查询一次数据库
3. **大结果存储**: 翻译结果存在 TEXT 字段中

### 优化建议

1. **实现任务并发**
   - 多 worker 进程
   - 基于任务类型的并发控制

2. **优化轮询机制**
   - 使用数据库触发器
   - 实现长轮询或 WebSocket

3. **结果存储优化**
   - 大内容存储到对象存储
   - 数据库只存储引用

4. **添加缓存层**
   - Redis 缓存热点任务
   - 内存缓存频繁查询

## 监控与运维

### 关键指标

- 队列长度（pending 任务数）
- 处理延迟（created_at 到 started_at）
- 任务成功率
- 平均处理时间

### 日志记录

所有任务操作都有控制台日志：
- 📝 任务入队
- 📋 开始处理
- ✅ 任务完成
- ❌ 任务失败
- 🧹 清理任务

### 故障恢复

- 服务重启后自动恢复 processing → pending
- 失败任务自动重试（最多3次）
- 7天自动清理策略防止数据膨胀

## 总结

当前任务队列系统提供了一个可扩展的基础架构，支持多种任务类型的异步处理。通过工厂模式和统一的任务接口，可以方便地添加新的任务类型。系统具备基本的错误处理、重试机制和监控能力，适合中小规模的异步任务处理需求。

未来可根据实际负载情况，逐步实现并发处理、分布式部署等高级特性。