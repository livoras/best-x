import { Router, Request, Response } from 'express';
import { ExtractionsModel } from '../lib/models/ExtractionsModel';

export function createSearchRoutes(extractionsModel: ExtractionsModel) {
  const router = Router();

  // 搜索功能
  router.get('/', (req: Request, res: Response) => {
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

  return router;
}