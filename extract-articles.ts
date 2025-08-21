import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

export async function extractArticles(url: string): Promise<string> {
  // 连接 Playwright
  const client = new PlaywrightClient('http://localhost:3102');
  
  // 打开页面
  const { pageId } = await client.createPage('x', 'Extract', url, 3000);
  await client.waitForTimeout(pageId, 3000);
  
  // 获取HTML
  const htmlFile = await client.pageToHtmlFile(pageId, true);
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
if (require.main === module) {
  extractArticles(process.argv[2])
    .then(path => console.log(path))
    .catch(console.error);
}