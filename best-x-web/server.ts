import express, { Request, Response } from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getXPost } from '../get-post';
import { DB } from './lib/DB';
import { Migration } from './lib/Migration';
import { migrations } from './lib/migrations';
import { ExtractionsModel } from './lib/models/ExtractionsModel';
import QueueModel from './lib/models/QueueModel';
import { DEFAULT_SCROLLS } from './lib/consts';

console.log('Starting server...');
const app = express();

app.use(cors());
app.use(express.json());

interface FetchTweetRequest {
  url: string;
  scrollTimes?: number;
}

// 改造为入队操作（异步处理）
app.post('/api/fetch-tweet', async (req: Request<{}, {}, FetchTweetRequest>, res: Response) => {
  const { url, scrollTimes = DEFAULT_SCROLLS } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供推文URL' });
  }
  
  try {
    console.log(`📥 接收请求: ${url}, 滚动次数: ${scrollTimes}`);
    
    // 添加任务到队列
    const taskId = queueModel.addTask(url, scrollTimes);
    
    // 立即返回任务ID
    res.json({ 
      taskId,
      status: 'queued',
      message: '任务已加入队列'
    });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '添加任务失败' });
  }
});

// 查询任务状态
app.get('/api/task/:taskId', (req: Request, res: Response) => {
  try {
    const task = queueModel.getTask(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // 如果任务完成，附带结果数据
    let result = null;
    if (task.status === 'completed' && task.result_id) {
      result = extractionsModel.getExtraction(task.result_id);
    }
    
    res.json({ ...task, result });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '查询任务失败' });
  }
});

// 获取队列状态（支持分页）
app.get('/api/queue/status', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const filter = (req.query.filter as string) || 'all';
    
    const status = queueModel.getQueueStatus(page, pageSize, filter);
    res.json(status);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取队列状态失败' });
  }
});

// 取消任务
app.delete('/api/task/:taskId', (req: Request, res: Response) => {
  try {
    const success = queueModel.cancelTask(req.params.taskId);
    
    if (!success) {
      return res.status(400).json({ error: '无法取消该任务' });
    }
    
    res.json({ message: '任务已取消' });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '取消任务失败' });
  }
});

// 获取历史记录列表
app.get('/api/extractions', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const extractions = extractionsModel.getExtractions(limit, offset);
    const stats = extractionsModel.getStats();
    
    res.json({ extractions, stats });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取历史记录失败' });
  }
});

// 获取单个提取记录
app.get('/api/extractions/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const extraction = extractionsModel.getExtraction(id);
    
    if (!extraction) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json(extraction);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取记录失败' });
  }
});

// 获取合并的文章内容（连续同作者推文）
app.get('/api/extractions/:id/article', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const article = extractionsModel.getPostContentByTweet(id);
    
    if (!article) {
      return res.status(404).json({ error: '记录不存在或无法生成文章' });
    }
    
    res.json(article);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取文章内容失败' });
  }
});

// 获取 Markdown 格式的文章内容
app.get('/api/extractions/:id/article-markdown', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const markdownArticle = extractionsModel.getPostContentAsMarkdown(id);
    
    if (!markdownArticle) {
      return res.status(404).json({ error: '记录不存在或无法生成 Markdown 文章' });
    }
    
    res.json(markdownArticle);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取 Markdown 文章内容失败' });
  }
});

// 删除提取记录
app.delete('/api/extractions/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = extractionsModel.deleteExtraction(id);
    
    if (!success) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '删除失败' });
  }
});

// 测试端点 - 插入模拟数据
app.post('/api/test-save', (req: Request, res: Response) => {
  try {
    const mockResult = {
      url: 'https://x.com/test/status/123456',
      htmlFile: '/tmp/test.html',
      articlesFile: '/tmp/articles.html',
      tweets: [{
        author: {
          name: 'Test User',
          handle: '@testuser',
          avatar: 'https://example.com/avatar.jpg'
        },
        content: {
          text: 'This is a test tweet for database persistence',
          hasMore: false
        },
        media: {
          images: [],
          video: null
        },
        time: '2025年8月21日',
        statusLink: '/test/status/123456',
        stats: {
          replies: '10',
          retweets: '20',
          likes: '30',
          bookmarks: '5',
          views: '1000'
        }
      }],
      count: 1
    };
    
    const id = extractionsModel.saveExtraction(mockResult, 1, 0);
    res.json({ success: true, id, message: '测试数据已保存' });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索功能
app.get('/api/search', (req: Request, res: Response) => {
  try {
    const { type, query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }
    
    let results;
    switch (type) {
      case 'author':
        results = extractionsModel.searchByAuthor(query as string);
        break;
      case 'content':
        results = extractionsModel.searchByContent(query as string);
        break;
      case 'url':
      default:
        results = extractionsModel.searchByUrl(query as string);
        break;
    }
    
    res.json(results);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '搜索失败' });
  }
});

// 数据库路径
const DB_PATH = join(process.cwd(), 'data', 'tweets.db');

// 队列处理器
let isProcessing = false;
async function startQueueProcessor() {
  console.log('🚀 队列处理器已启动');
  
  // 每2秒检查一次队列
  setInterval(async () => {
    if (isProcessing) return; // 如果正在处理，跳过
    
    try {
      // 获取下一个任务
      const task = queueModel.getNextTask();
      if (!task) return; // 没有待处理任务
      
      isProcessing = true;
      console.log(`🔄 开始处理任务: ${task.task_id} - ${task.url}`);
      
      try {
        // 更新进度：开始抓取
        queueModel.updateProgress(task.task_id, 10, '正在连接页面...');
        
        // 调用抓取函数
        const result = await getXPost(task.url, { 
          scrollTimes: task.scroll_times,
          onProgress: (progress: number, message: string) => {
            // 进度回调
            queueModel.updateProgress(task.task_id, 10 + progress * 0.8, message);
          }
        });
        
        // 更新进度：保存数据
        queueModel.updateProgress(task.task_id, 90, '正在保存数据...');
        
        // 保存到数据库
        const extractionId = extractionsModel.saveExtraction(result, task.scroll_times, 0);
        
        // 标记任务完成
        queueModel.completeTask(task.task_id, extractionId);
        console.log(`✅ 任务完成: ${task.task_id}`);
        
      } catch (error: any) {
        console.error(`❌ 任务失败: ${task.task_id}`, error);
        queueModel.failTask(task.task_id, error.message || '未知错误');
      }
      
    } catch (error) {
      console.error('队列处理器错误:', error);
    } finally {
      isProcessing = false;
    }
  }, 2000);
  
  // 定期清理旧任务（每小时）
  setInterval(() => {
    queueModel.cleanOldTasks();
  }, 60 * 60 * 1000);
}

// Model 实例（像 confow 那样）
let extractionsModel: ExtractionsModel;
let queueModel: QueueModel;

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
    extractionsModel = ExtractionsModel.getInstance();
    queueModel = new QueueModel(db);
    
    console.log('✨ 数据库初始化完成');
    
    // 启动队列处理器
    startQueueProcessor();
    
    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
      console.log('📝 API 端点:');
      console.log('  - POST   /api/fetch-tweet             添加提取任务');
      console.log('  - GET    /api/queue/status            获取队列状态');
      console.log('  - GET    /api/task/:id                查询任务详情');
      console.log('  - DELETE /api/task/:id                取消任务');
      console.log('  - GET    /api/extractions             获取历史');
      console.log('  - GET    /api/extractions/:id         获取详情');
      console.log('  - GET    /api/extractions/:id/article 获取合并文章');
      console.log('  - GET    /api/extractions/:id/article-markdown 获取 Markdown 文章');
      console.log('  - DELETE /api/extractions/:id         删除记录');
      console.log('  - GET    /api/search                  搜索功能');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();