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
├──────────────────────────────────────────────────────── │
│  ExtractTaskHandler │ TranslateTaskHandler │ Summary... │
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
2. 调用 Claude API 进行翻译
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

### 添加新任务类型

1. 在 `TaskType` 中添加新类型
2. 实现新的 `TaskHandler` 类
3. 在 `TaskHandlerFactory` 中注册
4. 更新 API 路由支持新类型

示例：添加 "analyze" 任务
```typescript
// 1. 定义处理器
export class AnalyzeTaskHandler implements TaskHandler {
    async execute(params: any) {
        // 实现分析逻辑
        return { analysis: "..." };
    }
}

// 2. 注册到工厂
this.handlers.set('analyze', new AnalyzeTaskHandler(db));
```

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