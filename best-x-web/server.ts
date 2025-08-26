import express, { Request, Response } from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DB } from './lib/DB';
import { Migration } from './lib/Migration';
import { migrations } from './lib/migrations';
import { ExtractionsModel } from './lib/models/ExtractionsModel';
import QueueModel from './lib/models/QueueModel';
import { QueueProcessor } from './lib/queueProcessor';

// 导入路由模块
import { createExtractionRoutes } from './routes/extractionRoutes';
import { createTaskRoutes } from './routes/taskRoutes';
import { createQueueRoutes } from './routes/queueRoutes';
import { createSearchRoutes } from './routes/searchRoutes';

console.log('Starting server...');
const app = express();

app.use(cors());
app.use(express.json());

// 数据库路径
const DB_PATH = join(process.cwd(), 'data', 'tweets.db');

// 启动服务器
async function startServer() {
  try {
    // 确保数据目录存在
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // 初始化数据库连接
    const db = DB.getInstance(DB_PATH);
    
    // 运行迁移
    const migration = new Migration(db);
    await migration.apply(migrations);
    
    // 初始化 Model
    ExtractionsModel.setDB(db);
    const extractionsModel = ExtractionsModel.getInstance();
    const queueModel = new QueueModel(db);
    
    // 初始化队列处理器
    const queueProcessor = new QueueProcessor(db);
    
    console.log('✨ 数据库初始化完成');
    
    // 注册路由 - 清晰的模块化结构
    console.log('📍 注册路由...');
    
    // API 路由
    app.use('/api/extractions', createExtractionRoutes(extractionsModel, queueModel));
    app.use('/api/queue', createQueueRoutes(queueModel));
    app.use('/api/search', createSearchRoutes(extractionsModel));
    
    // 任务相关路由 - 注意这里直接挂载到 /api
    const taskRouter = createTaskRoutes(queueModel, extractionsModel);
    app.use('/api', taskRouter);  // 这样 /fetch-tweet, /task 等路由直接在 /api 下
    
    // 健康检查
    app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    console.log('✅ 路由注册完成');
    
    // 启动队列处理器
    queueProcessor.start(2000);
    
    // 定期清理旧任务（每小时）
    setInterval(() => {
      queueProcessor.cleanOldTasks();
    }, 60 * 60 * 1000);
    
    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
      console.log('📝 API 端点:');
      console.log('  任务管理:');
      console.log('  - POST   /api/fetch-tweet             添加提取任务');
      console.log('  - POST   /api/task                    创建通用任务');
      console.log('  - GET    /api/task/:id                查询任务详情');
      console.log('  - DELETE /api/task/:id                取消任务');
      console.log('  队列管理:');
      console.log('  - GET    /api/queue/status            获取队列状态');
      console.log('  数据管理:');
      console.log('  - GET    /api/extractions             获取历史');
      console.log('  - GET    /api/extractions/:id         获取详情');
      console.log('  - GET    /api/extractions/:id/article 获取合并文章');
      console.log('  - GET    /api/extractions/:id/article-markdown 获取 Markdown 文章');
      console.log('  - POST   /api/extractions/:id/translate 创建翻译任务');
      console.log('  - DELETE /api/extractions/:id         删除记录');
      console.log('  - GET    /api/search                  搜索功能');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();