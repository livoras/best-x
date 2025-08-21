import express from 'express';
import cors from 'cors';
import { getXPost } from '../get-post.js';

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/fetch-tweet', async (req, res) => {
  const { url, scrollTimes = 3 } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供推文URL' });
  }
  
  try {
    console.log(`📥 接收请求: ${url}, 滚动次数: ${scrollTimes}`);
    
    // 直接调用函数
    const result = await getXPost(url, { scrollTimes });
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || '获取推文失败' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log('📝 API 端点: POST http://localhost:3001/api/fetch-tweet');
});