import express, { Request, Response } from 'express';
import cors from 'cors';
import { getXPost } from '../get-post';
import { extractionsDB } from './lib/db';

console.log('Starting server...');
const app = express();

app.use(cors());
app.use(express.json());

interface FetchTweetRequest {
  url: string;
  scrollTimes?: number;
}

app.post('/api/fetch-tweet', async (req: Request<{}, {}, FetchTweetRequest>, res: Response) => {
  const { url, scrollTimes = 3 } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供推文URL' });
  }
  
  try {
    console.log(`📥 接收请求: ${url}, 滚动次数: ${scrollTimes}`);
    
    // 调用函数提取数据
    const result = await getXPost(url, { scrollTimes });
    
    // 保存到数据库
    const extractionId = extractionsDB.saveExtraction(result, scrollTimes, 0);
    console.log(`💾 数据已保存，ID: ${extractionId}`);
    
    // 从数据库读取刚保存的数据
    const savedData = extractionsDB.getExtraction(extractionId);
    if (!savedData) {
      throw new Error('保存后无法读取数据');
    }
    
    // 返回数据库中的数据（包含数据库ID）
    res.json({ ...savedData, extractionId });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取推文失败' });
  }
});

// 获取历史记录列表
app.get('/api/extractions', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const extractions = extractionsDB.getExtractions(limit, offset);
    const stats = extractionsDB.getStats();
    
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
    const extraction = extractionsDB.getExtraction(id);
    
    if (!extraction) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json(extraction);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取记录失败' });
  }
});

// 删除提取记录
app.delete('/api/extractions/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = extractionsDB.deleteExtraction(id);
    
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
    
    const id = extractionsDB.saveExtraction(mockResult, 1, 0);
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
        results = extractionsDB.searchByAuthor(query as string);
        break;
      case 'content':
        results = extractionsDB.searchByContent(query as string);
        break;
      case 'url':
      default:
        results = extractionsDB.searchByUrl(query as string);
        break;
    }
    
    res.json(results);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '搜索失败' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log('📝 API 端点:');
  console.log('  - POST   /api/fetch-tweet     提取推文');
  console.log('  - GET    /api/extractions      获取历史');
  console.log('  - GET    /api/extractions/:id  获取详情');
  console.log('  - DELETE /api/extractions/:id  删除记录');
  console.log('  - GET    /api/search           搜索功能');
});