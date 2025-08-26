import { Router, Request, Response } from 'express';
import QueueModel from '../lib/models/QueueModel';
import { ExtractionsModel } from '../lib/models/ExtractionsModel';
import { DEFAULT_SCROLLS } from '../lib/consts';

interface FetchTweetRequest {
  url: string;
  scrollTimes?: number;
}

export function createTaskRoutes(
  queueModel: QueueModel,
  extractionsModel: ExtractionsModel
) {
  const router = Router();

  // 添加提取任务（兼容旧接口）
  router.post('/fetch-tweet', async (req: Request<{}, {}, FetchTweetRequest>, res: Response) => {
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

  // 创建通用任务
  router.post('/task', async (req: Request, res: Response) => {
    try {
      const { type, params, priority = 0 } = req.body;
      
      if (!type || !params) {
        return res.status(400).json({ error: '请提供任务类型和参数' });
      }
      
      // 验证任务类型
      const supportedTypes = ['extract', 'translate', 'summary'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({ 
          error: `不支持的任务类型: ${type}`,
          supportedTypes 
        });
      }
      
      console.log(`📥 创建 ${type} 任务`);
      
      // 添加任务到队列
      const taskId = queueModel.addGenericTask(type, params, undefined, priority);
      
      res.json({ 
        taskId,
        status: 'queued',
        message: `${type} 任务已加入队列`
      });
    } catch (error: any) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message || '创建任务失败' });
    }
  });

  // 查询任务状态
  router.get('/task/:taskId', (req: Request, res: Response) => {
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

  // 取消任务
  router.delete('/task/:taskId', (req: Request, res: Response) => {
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

  // 测试端点 - 插入模拟数据
  router.post('/test-save', (req: Request, res: Response) => {
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

  return router;
}