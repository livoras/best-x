import { getXPost } from '../../crawls/get-post';
import { translatePost } from '../../translate-post';
import { ExtractionsModel } from './models/ExtractionsModel';
import { DB } from './DB';
import { claude } from 'claude-code-sdk-ts2';
import { formatTagsForPrompt, getAllTags } from './tagConfig';

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

// Tag 任务处理器 - AI 自动标签分类
export class TagTaskHandler implements TaskHandler {
  private db: DB;
  
  constructor(db: DB) {
    this.db = db;
  }
  
  async execute(params: { extractionId: number }) {
    console.log(`🏷️ 开始标签任务: 提取记录 #${params.extractionId}`);
    
    // 1. 获取提取记录的内容
    const extractionsModel = ExtractionsModel.getInstance();
    const markdownArticle = extractionsModel.getPostContentAsMarkdown(params.extractionId);
    
    if (!markdownArticle) {
      throw new Error(`提取记录 #${params.extractionId} 不存在或没有内容`);
    }
    
    // 2. 准备内容 - 使用 markdown 内容
    const content = markdownArticle.markdown || '';
    
    // 限制内容长度，避免 token 过多
    const maxContentLength = 8000;
    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength) + '...';
    }
    
    // 3. 准备标签分析 prompt
    const prompt = `分析以下内容并打上合适的标签。

可用标签列表（你只能从这些标签中选择）：
${formatTagsForPrompt()}

严格要求：
1. 【重要】只能从上述列表中选择标签，绝对不能创造新标签
2. 【重要】返回的每个标签必须完全匹配列表中的 key（英文），不能有任何修改
3. 每个类别最多选择 2 个最相关的标签（内容领域可以选择1-3个）
4. 总共选择 4-10 个标签
5. 返回 JSON 格式，tags 数组只包含上述列表中存在的标签 key

检查规则：
- 如果你想使用 "nostalgic"、"funny"、"sad" 等情感词，请改用列表中的 stance 类别标签
- 如果找不到完全匹配的概念，选择最接近的标签
- 不要返回任何不在上述列表中的标签

返回格式示例：
{
  "tags": ["thread", "tech", "informative", "objective", "with_media"],
  "reasons": {
    "thread": "内容是连续的推文讨论",
    "tech": "讨论科技相关话题",
    "informative": "提供了有价值的信息",
    "objective": "观点客观中立",
    "with_media": "包含图片或视频"
  }
}

待分析内容：
${content}`;

    console.log(`🤖 调用 Claude 进行标签分析...`);
    const startTime = Date.now();
    
    try {
      // 4. 调用 Claude 分析
      const response = await claude()
        .withModel('sonnet')  // 使用 Sonnet，准确性和速度平衡
        .skipPermissions()
        .query(prompt)
        .asText();
      
      
      // 5. 解析响应
      let result;
      try {
        // 提取 JSON 部分（处理可能的额外文本）
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('响应中没有找到有效的 JSON');
        }
      } catch (parseError) {
        console.error('解析标签响应失败:', parseError);
        throw new Error('标签分析响应格式错误');
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ 标签分析完成 (耗时 ${duration}秒)`);
      console.log(`📊 识别标签: ${result.tags.join(', ')}`);
      
      // 6. 返回结果
      return {
        extractionId: params.extractionId,
        tags: result.tags,
        reasons: result.reasons,
        taggedAt: new Date().toISOString()
      };
      
    } catch (error: any) {
      console.error(`❌ 标签分析失败:`, error.message);
      throw error;
    }
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
    this.handlers.set('tag', new TagTaskHandler(db));
  }
  
  getHandler(type: string): TaskHandler | undefined {
    return this.handlers.get(type);
  }
  
  getSupportedTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}