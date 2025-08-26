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
    const prompt = `请将以下 Twitter/X 推文内容翻译成${targetLang}。

要求：
1. 保持所有 Markdown 格式标记不变
   - 图片标记 ![Image](url) 和 ![Video](url)
   - 链接格式 [text](url)
   - 分隔线 ---
   - 列表格式 - item
   - 粗体 **text**
   - 斜体 *text*
2. 保留所有 URL 链接不变
3. 保留表情符号
4. 人名、品牌名、技术术语可以保留原文或音译
5. 翻译要自然流畅，符合${targetLang}表达习惯
6. 只返回翻译后的内容，不要添加任何额外说明

内容：
${markdownContent}`;

    // 调用 Claude 进行翻译
    console.log(`🤖 调用 Claude 进行翻译...`);
    const startTime = Date.now();
    
    const translatedContent = await claude()
      .withModel('haiku')  // 使用 haiku 模型，速度更快
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