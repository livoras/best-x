import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

export async function extractArticles(url: string): Promise<string> {
  console.log('1. 开始连接 Playwright...');
  // 连接 Playwright
  const client = new PlaywrightClient('http://localhost:3102');
  console.log('2. 连接成功');
  
  // 打开页面
  console.log('3. 创建页面...', url);
  const { pageId } = await client.createPage('x', 'Extract', url, 3000);
  console.log('4. 页面创建成功, pageId:', pageId);
  await client.waitForTimeout(pageId, 3000);
  console.log('5. 等待完成');
  
  // 获取HTML
  const htmlFile = await client.pageToHtmlFile(pageId, false);
  const htmlContent = fs.readFileSync(htmlFile.filePath, 'utf-8');
  
  // 提取articles
  const $ = cheerio.load(htmlContent);
  const articles = $('article');
  
  // 保存文件
  const articlesFile = `/tmp/articles-${Date.now()}.html`;
  const articlesHtml = articles.map((i, el) => $.html(el)).get().join('\n\n');
  fs.writeFileSync(articlesFile, articlesHtml, 'utf-8');
  
  // 关闭页面
  await client.closePage(pageId);
  
  return articlesFile;
}

// 命令行支持
if (process.argv[2]) {
  console.log('开始提取:', process.argv[2]);
  extractArticles(process.argv[2])
    .then(path => {
      console.log('已保存到:', path);
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error);
      process.exit(1);
    });
}