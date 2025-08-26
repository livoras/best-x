import { Router, Request, Response } from 'express';
import { ExtractionsModel } from '../lib/models/ExtractionsModel';
import QueueModel from '../lib/models/QueueModel';

export function createExtractionRoutes(
  extractionsModel: ExtractionsModel,
  queueModel: QueueModel
) {
  const router = Router();

  // 获取历史记录列表
  router.get('/', (req: Request, res: Response) => {
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
  router.get('/:id', (req: Request, res: Response) => {
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
  router.get('/:id/article', (req: Request, res: Response) => {
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
  router.get('/:id/article-markdown', (req: Request, res: Response) => {
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

  // 创建翻译任务
  router.post('/:id/translate', async (req: Request, res: Response) => {
    try {
      const extractionId = parseInt(req.params.id);
      const { targetLang = '中文' } = req.body;
      
      console.log(`📥 创建翻译任务: 记录 #${extractionId} -> ${targetLang}`);
      
      // 检查提取记录是否存在
      const extraction = extractionsModel.getExtraction(extractionId);
      if (!extraction) {
        return res.status(404).json({ error: '记录不存在' });
      }
      
      // 添加翻译任务到队列
      const taskId = queueModel.addGenericTask('translate', {
        extractionId,
        targetLang
      });
      
      res.json({ 
        taskId,
        status: 'queued',
        message: '翻译任务已加入队列'
      });
    } catch (error: any) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message || '创建翻译任务失败' });
    }
  });

  // 删除提取记录
  router.delete('/:id', (req: Request, res: Response) => {
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

  return router;
}