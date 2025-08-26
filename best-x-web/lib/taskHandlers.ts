import { getXPost } from '../../get-post';
import { translatePost } from '../../translate-post';
import { ExtractionsModel } from './models/ExtractionsModel';
import { DB } from './DB';

// 任务处理器接口
export interface TaskHandler {
  execute(params: any): Promise<any>;
}

// Extract 任务处理器
export class ExtractTaskHandler implements TaskHandler {
  private extractionsModel: ExtractionsModel;
  
  constructor(db: DB) {
    // ExtractionsModel 是单例模式，使用 getInstance
    this.extractionsModel = ExtractionsModel.getInstance();
  }
  
  async execute(params: { url: string; scrollTimes?: number }) {
    console.log(`🔄 开始提取任务: ${params.url}`);
    
    // 调用提取函数
    const result = await getXPost(params.url, { 
      scrollTimes: params.scrollTimes || 10 
    });
    
    // 保存到数据库
    const extraction = this.extractionsModel.saveExtraction(result);
    
    console.log(`✅ 提取完成，ID: ${extraction.id}`);
    
    return { 
      extractionId: extraction.id,
      tweetCount: result.tweets.length,
      url: params.url
    };
  }
}

// Translate 任务处理器
export class TranslateTaskHandler implements TaskHandler {
  private db: DB;
  
  constructor(db: DB) {
    this.db = db;
  }
  
  async execute(params: { extractionId: number; targetLang?: string }) {
    console.log(`🌐 开始翻译任务: 提取记录 #${params.extractionId}`);
    
    // 检查提取记录是否存在
    const extraction = this.db.getDB()
      .prepare('SELECT id FROM extractions WHERE id = ?')
      .get(params.extractionId);
    
    if (!extraction) {
      throw new Error(`提取记录 #${params.extractionId} 不存在`);
    }
    
    // 调用翻译函数
    const result = await translatePost({
      extractionId: params.extractionId,
      targetLang: params.targetLang || '中文'
    });
    
    console.log(`✅ 翻译完成: ${result.outputFile}`);
    
    return { 
      extractionId: params.extractionId,
      targetLang: result.targetLang,
      outputFile: result.outputFile,
      // 存储翻译后的 markdown 以便前端使用
      translatedMarkdown: result.translated
    };
  }
}

// Summary 任务处理器（示例，未来可扩展）
export class SummaryTaskHandler implements TaskHandler {
  async execute(params: { extractionId: number }) {
    console.log(`📝 开始摘要任务: 提取记录 #${params.extractionId}`);
    
    // TODO: 实现摘要逻辑
    // 可以调用 Claude SDK 生成摘要
    
    return {
      extractionId: params.extractionId,
      summary: '功能待实现'
    };
  }
}

// 任务处理器工厂
export class TaskHandlerFactory {
  private handlers: Map<string, TaskHandler>;
  
  constructor(db: DB) {
    this.handlers = new Map();
    
    // 注册所有处理器
    this.handlers.set('extract', new ExtractTaskHandler(db));
    this.handlers.set('translate', new TranslateTaskHandler(db));
    this.handlers.set('summary', new SummaryTaskHandler());
  }
  
  getHandler(type: string): TaskHandler | undefined {
    return this.handlers.get(type);
  }
  
  getSupportedTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}