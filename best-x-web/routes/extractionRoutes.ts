import { Router, Request, Response } from 'express';
import { ExtractionsModel } from '../lib/models/ExtractionsModel';
import QueueModel from '../lib/models/QueueModel';
import { DB } from '../lib/DB';

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

  // 获取翻译内容
  router.get('/:id/translation', async (req: Request, res: Response) => {
    try {
      const extractionId = parseInt(req.params.id);
      
      if (isNaN(extractionId)) {
        return res.status(400).json({ error: '无效的提取记录ID' });
      }
      
      const db = DB.getInstance();
      
      // 查找对应的翻译任务
      const translationTask = db.getDB().prepare(`
        SELECT task_id, status, progress_message, completed_at
        FROM task_queue
        WHERE type = 'translate' 
          AND params LIKE ? 
          AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(`%"extractionId":${extractionId}%`) as any;
      
      if (!translationTask) {
        return res.status(404).json({ error: '未找到翻译内容' });
      }
      
      // 解析翻译结果
      let translationContent = null;
      if (translationTask.progress_message) {
        try {
          const result = JSON.parse(translationTask.progress_message);
          translationContent = result.translatedMarkdown || null;
        } catch (e) {
          console.error('解析翻译结果失败:', e);
        }
      }
      
      if (!translationContent) {
        return res.status(404).json({ error: '翻译内容为空' });
      }
      
      res.json({
        taskId: translationTask.task_id,
        translationContent,
        completedAt: translationTask.completed_at
      });
    } catch (error: any) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message || '获取翻译内容失败' });
    }
  });

  // 创建标签任务
  router.post('/:id/tag', async (req: Request, res: Response) => {
    try {
      const extractionId = parseInt(req.params.id);
      
      // 检查提取记录是否存在
      const db = DB.getInstance();
      const extraction = db.getDB()
        .prepare('SELECT id FROM extractions WHERE id = ?')
        .get(extractionId);
      
      if (!extraction) {
        return res.status(404).json({ error: '提取记录不存在' });
      }
      
      // 创建标签任务
      const taskParams = {
        extractionId
      };
      
      const taskId = queueModel.addGenericTask('tag', taskParams);
      
      console.log(`📥 创建标签任务: 记录 #${extractionId}`);
      
      res.json({
        taskId,
        status: 'queued',
        message: '标签任务已加入队列'
      });
      
    } catch (error: any) {
      console.error('创建标签任务失败:', error);
      res.status(500).json({ error: error.message || '创建标签任务失败' });
    }
  });

  // 获取标签结果
  router.get('/:id/tags', async (req: Request, res: Response) => {
    try {
      const extractionId = parseInt(req.params.id);
      
      // 查询最新的标签任务结果
      const db = DB.getInstance();
      const tagTask = db.getDB().prepare(`
        SELECT task_id, status, progress_message, completed_at
        FROM task_queue
        WHERE type = 'tag' 
          AND params LIKE ? 
          AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(`%"extractionId":${extractionId}%`) as any;
      
      if (!tagTask) {
        return res.status(404).json({ 
          error: '没有找到标签结果',
          message: '可能标签任务还在处理中或尚未创建' 
        });
      }
      
      // 解析标签结果
      let tagData = null;
      try {
        const progressMessage = JSON.parse(tagTask.progress_message);
        tagData = {
          tags: progressMessage.tags || [],
          reasons: progressMessage.reasons || {},
          taggedAt: progressMessage.taggedAt || tagTask.completed_at
        };
      } catch (e) {
        console.error('解析标签数据失败:', e);
        return res.status(500).json({ error: '标签数据格式错误' });
      }
      
      res.json({
        extractionId,
        taskId: tagTask.task_id,
        ...tagData
      });
      
    } catch (error: any) {
      console.error('获取标签失败:', error);
      res.status(500).json({ error: error.message || '获取标签失败' });
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