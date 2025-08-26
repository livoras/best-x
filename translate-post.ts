import { claude } from 'claude-code-sdk-ts2';
import * as fs from 'fs';

interface TranslateOptions {
  extractionId?: number;
  markdownFile?: string;
  outputFile?: string;
  targetLang?: string;
}

interface TranslateResult {
  original: string;
  translated: string;
  extractionId?: number;
  targetLang: string;
  outputFile?: string;
}

async function translatePost(options: TranslateOptions = {}): Promise<TranslateResult> {
  try {
    const extractionId = options.extractionId || parseInt(process.argv[2]);
    const targetLang = options.targetLang || '中文';
    
    let markdownContent: string;
    let author: any = null;
    
    // 获取 Markdown 内容
    if (options.markdownFile) {
      // 从文件读取
      console.log(`📖 从文件读取: ${options.markdownFile}`);
      markdownContent = fs.readFileSync(options.markdownFile, 'utf-8');
    } else if (extractionId) {
      // 从 API 获取
      console.log(`📖 获取提取记录 #${extractionId} 的 Markdown 内容...`);
      const response = await fetch(`http://localhost:3001/api/extractions/${extractionId}/article-markdown`);
      
      if (!response.ok) {
        throw new Error(`获取失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      markdownContent = data.markdown;
      author = data.author;
      
      console.log(`✅ 获取成功`);
      console.log(`   作者: ${author.name} (${author.handle})`);
      console.log(`   推文数: ${data.tweetCount}`);
    } else {
      throw new Error('请提供 extractionId 或 markdownFile');
    }
    
    // 统计原文信息
    const lineCount = markdownContent.split('\n').length;
    const charCount = markdownContent.length;
    console.log(`📊 原文统计: ${lineCount} 行, ${charCount} 字符`);
    
    // 准备翻译 prompt
    const prompt = `任务：将下面的内容翻译成地道的${targetLang}。
重要：直接输出翻译结果，不要加任何开场白、说明或评论。

翻译风格：
1. 用口语，别用书面语
   - "填个表"而不是"请填写表格"
   - "没几个"而不是"寥寥无几"
   - "搞定了"而不是"已完成"
   
2. 语气要自然
   - 多用"吧、呢、啊、嘛"这些语气词
   - 能省略的就省略（"我觉得"→"觉得"）
   - 网络用语该用就用（火了、爆了、绝了）
   
3. 意思到位就行
   - 不用每个词都翻译
   - 啰嗦的直接删
   - 意思不清的就加点解释
   
4. 保持原文的感觉
   - 炫耀就炫耀，吐槽就吐槽
   - 兴奋、沮丧、讽刺的语气要出来
   
5. 专有名词
   - 大家都知道的直接用中文（谷歌、推特）
   - 不常见的保留英文
   
6. Markdown 格式保留（图片、链接那些别动）

核心原则：翻译成中国人平时聊天的样子，怎么顺口怎么来。

待翻译内容：
${markdownContent}`;

    // 调用 Claude 进行翻译
    console.log(`🤖 调用 Claude 进行翻译...`);
    const startTime = Date.now();
    
    const translatedContent = await claude()
      .withModel('opus')  // 使用 Opus 模型，理解能力更强
      .skipPermissions()
      .query(prompt)
      .asText();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ 翻译完成 (耗时 ${duration}秒)`);
    
    // 统计译文信息
    const translatedLineCount = translatedContent.split('\n').length;
    const translatedCharCount = translatedContent.length;
    console.log(`📊 译文统计: ${translatedLineCount} 行, ${translatedCharCount} 字符`);
    
    // 保存到文件
    let outputFile = options.outputFile;
    if (!outputFile) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      outputFile = `/tmp/translated-${extractionId || 'content'}-${timestamp}.md`;
    }
    
    fs.writeFileSync(outputFile, translatedContent, 'utf-8');
    console.log(`💾 译文已保存到: ${outputFile}`);
    
    // 返回结果
    return {
      original: markdownContent,
      translated: translatedContent,
      extractionId,
      targetLang,
      outputFile
    };
    
  } catch (error) {
    console.error('❌ 翻译失败:', error);
    throw error;
  }
}

// 如果直接运行脚本
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  const extractionId = process.argv[2];
  const targetLang = process.argv[3] || '中文';
  
  if (!extractionId) {
    console.log(`
使用方法:
  tsx translate-post.ts <extractionId> [targetLang]

示例:
  tsx translate-post.ts 106          # 翻译 ID 106 的提取记录为中文
  tsx translate-post.ts 106 日语     # 翻译为日语
  tsx translate-post.ts 106 English  # 翻译为英文

选项:
  extractionId  提取记录的 ID
  targetLang    目标语言（默认：中文）
`);
    process.exit(1);
  }
  
  console.log('\n🌐 开始翻译任务...\n');
  
  translatePost({ 
    extractionId: parseInt(extractionId),
    targetLang 
  })
    .then(result => {
      console.log('\n✨ 翻译完成！');
      
      // 显示前几行译文预览
      const preview = result.translated.split('\n').slice(0, 5).join('\n');
      console.log('\n📝 译文预览:');
      console.log('---');
      console.log(preview);
      console.log('---');
      console.log(`\n完整译文已保存至: ${result.outputFile}`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('\n翻译任务失败:', error.message);
      process.exit(1);
    });
}

// 导出函数
export { translatePost, TranslateOptions, TranslateResult };