import { PlaywrightClient } from 'better-playwright-mcp';
import * as fs from 'fs';

/**
 * 提取网页HTML并保存到文件
 * @param url - 目标URL
 * @param wait - 等待时间（毫秒）
 * @returns 保存的HTML文件路径
 */
async function extractHtml(url: string, wait: number = 3000): Promise<string> {
  const client = new PlaywrightClient('http://localhost:3103');
  
  try {
    console.log(`📖 打开: ${url}`);
    const { pageId } = await client.createPage('extract', 'Extract HTML', url, 3000);
    
    console.log(`⏳ 等待 ${wait}ms...`);
    await client.waitForTimeout(pageId, wait);
    
    console.log('📸 获取HTML...');
    const htmlFile = await client.pageToHtmlFile(pageId, false);
    const html = fs.readFileSync(htmlFile.filePath, 'utf-8');
    
    // 保存到 /tmp，文件名包含域名和时间戳
    const domain = new URL(url).hostname.replace(/\./g, '-');
    const timestamp = Date.now();
    const outputPath = `/tmp/${domain}-${timestamp}.html`;
    fs.writeFileSync(outputPath, html, 'utf-8');
    
    await client.closePage(pageId);
    
    console.log(`💾 已保存: ${outputPath} (${(html.length / 1024).toFixed(2)} KB)`);
    return outputPath;
    
  } catch (error: any) {
    console.error('❌ 提取失败:', error.message);
    throw error;
  }
}

// 命令行支持
if (process.argv[2]) {
  const url = process.argv[2];
  
  // 解析 --wait 参数
  const waitIndex = process.argv.indexOf('--wait');
  const wait = waitIndex > -1 && process.argv[waitIndex + 1] 
    ? parseInt(process.argv[waitIndex + 1]) 
    : 3000;
  
  // 验证URL
  try {
    new URL(url);
  } catch {
    console.error('❌ 无效的URL:', url);
    process.exit(1);
  }
  
  extractHtml(url, wait)
    .then(path => {
      console.log('\n' + path); // 最后一行输出路径，方便脚本使用
      process.exit(0);
    })
    .catch(err => {
      process.exit(1);
    });
} else {
  console.log('用法: tsx extract-html.ts <url> [--wait <毫秒>]');
  console.log('示例: tsx extract-html.ts https://x.com/user --wait 5000');
  process.exit(1);
}

export { extractHtml };