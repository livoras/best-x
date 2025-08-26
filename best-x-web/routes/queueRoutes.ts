import { Router, Request, Response } from 'express';
import QueueModel from '../lib/models/QueueModel';

export function createQueueRoutes(queueModel: QueueModel) {
  const router = Router();

  // 获取队列状态（支持分页）
  router.get('/status', (req: Request, res: Response) => {
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

  return router;
}