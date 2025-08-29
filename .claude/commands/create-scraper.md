---
description: 按照 Web Scraper Pattern 创建新的爬虫脚本
---

# 创建爬虫脚本

你需要按照 `docs/web-scraper-pattern.md` 中定义的标准流程创建一个新的爬虫脚本。

## 参数
用户提供的参数：$ARGUMENTS
- 第一个参数：目标URL
- 第二个参数（可选）：爬虫名称（如 "followers", "likes" 等）

## 执行流程

### 步骤1：保存HTML快照

```bash
tsx lib/extract-html.ts [URL] --wait 5000
```

保存输出的文件路径，如：`/tmp/x-com-1756299773101.html`

### 步骤2：分析HTML结构

使用Read工具读取HTML，分析并记录：

**示例分析格式：**
```
- 数据容器：<article> 标签 或 [data-testid$="-follow"]
- 唯一标识：data-testid="123456-unfollow" 中的数字部分
- 关键字段：
  - 用户名：a[href^="/"] 且匹配 /^\/[a-zA-Z0-9_]+$/
  - 显示名称：用户链接附近的 span 标签
  - 其他字段...
```

### 步骤3：设计数据结构

创建TypeScript类型定义文件 `types/[name].ts`：

```typescript
// 单个数据项
interface [Name]Item {
  id: string;           // 唯一标识
  // ... 其他字段
}

// 返回结果
interface [Name]Result {
  items: [Name]Item[];
  count: number;
  extractedAt: string;
  // ... 其他统计字段
}

// 选项（如需要）
interface Get[Name]Options {
  scrollTimes?: number;
  maxItems?: number;
}
```

### 步骤4：实现爬虫脚本

#### 4.1 如果是列表页面（需要滚动）

创建 `crawls/get-[name].ts`，使用以下完整模板：

```typescript
import { ScraperBase, cheerio, ScrapeOptions } from '../lib/scraper-base';
import type { [Name]Item, [Name]Result } from '../types/[name]';

/**
 * [描述]爬虫（使用通用基类实现）
 */
class [Name]Scraper extends ScraperBase<[Name]Item, [Name]Result> {
  private param?: string;  // 如需要额外参数
  
  constructor(param?: string, serverUrl?: string) {
    super(serverUrl);
    this.param = param;
  }
  
  /**
   * 从HTML中提取数据项
   */
  extractItems(html: string): [Name]Item[] {
    const $ = cheerio.load(html);
    const items: [Name]Item[] = [];
    
    // 基于步骤2的分析结果，查找数据容器
    // 示例1：关注列表使用关注按钮
    $('[data-testid$="-follow"], [data-testid$="-unfollow"]').each((index, element) => {
      const button = $(element);
      const testId = button.attr('data-testid') || '';
      
      if (!testId) return;
      
      // 提取ID
      const id = testId.replace(/-(un)?follow$/, '');
      
      // 向上查找容器
      let container = button.parent();
      let maxLevels = 10;
      while (maxLevels > 0 && container.length > 0) {
        const links = container.find('a[href^="/"][role="link"]');
        if (links.length > 0) break;
        container = container.parent();
        maxLevels--;
      }
      
      // 提取各字段（根据实际需求调整）
      const item: [Name]Item = {
        id: id,
        // ... 提取其他字段
      };
      
      items.push(item);
    });
    
    // 示例2：推文使用article标签
    // $('article').each((index, element) => {
    //   const article = $(element);
    //   const statusLink = article.find('a[href*="/status/"]').attr('href');
    //   if (statusLink) {
    //     items.push({
    //       id: statusLink,
    //       // ... 其他字段
    //     });
    //   }
    // });
    
    return items;
  }
  
  /**
   * 获取数据项的唯一标识符
   */
  getItemId(item: [Name]Item): string {
    return item.id;
  }
  
  /**
   * 构建最终返回结果
   */
  buildResult(): [Name]Result {
    const items = this.getItems();
    
    // 根据需要添加分类或统计
    console.log(`\n📊 收集统计:`);
    console.log(`  - 总数: ${items.length} 个`);
    
    return {
      url: this.url || '',
      items: items,
      count: items.length,
      extractedAt: new Date().toISOString()
    };
  }
  
  /**
   * 覆盖收集钩子以提供详细日志（可选）
   */
  protected onItemCollected(item: [Name]Item, id: string): void {
    console.log(`    ✅ 新增: ${id}`);
  }
}

/**
 * 导出便捷函数供其他模块使用
 */
export async function get[Name](
  param: string,
  options?: ScrapeOptions
): Promise<[Name]Result> {
  const scraper = new [Name]Scraper(param);
  const url = `https://x.com/${param}/[endpoint]`;
  return scraper.scrape(url, options);
}

// 命令行支持
if (process.argv[2]) {
  const param = process.argv[2];
  const scrollTimes = parseInt(process.argv[3]) || 10;
  const maxItems = process.argv[4] ? parseInt(process.argv[4]) : undefined;
  
  console.log(`\n🚀 获取[描述]: ${param}`);
  console.log(`   配置: 滚动${scrollTimes}次${maxItems ? `，最多${maxItems}个` : ''}\n`);
  
  get[Name](param, { scrollTimes, maxItems })
    .then(result => {
      console.log('\n✨ 完成！');
      console.log(`📊 提取了 ${result.count} 个项目`);
      
      // 输出摘要
      console.log('\n前5个项目:');
      result.items.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.id}`);
      });
      
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error.message);
      process.exit(1);
    });
}
```

#### 4.2 如果是单页数据（不需要滚动）

创建 `crawls/get-[name].ts`，使用以下模板：

```typescript
import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function get[Name](url: string) {
  const client = new PlaywrightClient('http://localhost:3103');
  const { pageId } = await client.createPage('[name]', '[Name]', url, 3000);
  
  await client.waitForTimeout(pageId, 3000);
  const htmlFile = await client.pageToHtmlFile(pageId, false);
  const html = fs.readFileSync(htmlFile.filePath, 'utf-8');
  
  // 提取数据
  const $ = cheerio.load(html);
  const data = {
    // 基于步骤2的分析提取数据
  };
  
  await client.closePage(pageId);
  return data;
}

// 导出供模块使用
export { get[Name] };

// 命令行支持
if (process.argv[2]) {
  get[Name](process.argv[2])
    .then(result => {
      console.log('提取完成:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error);
      process.exit(1);
    });
}
```

### 步骤5：测试验证

运行创建的爬虫：
```bash
tsx crawls/get-[name].ts [参数] 10 100
```

## 注意事项
- 文件命名使用连字符：`get-user-likes.ts` 而不是 `getUserLikes.ts`
- 导入路径：crawls目录下用 `../types/` 和 `../lib/`
- 去重机制已在ScraperBase中实现，不需要手动处理
- 使用emoji日志：📖打开 📸保存 ✅成功 🛑停止 📊统计

## 参考现有实现
- `crawls/get-post.ts` - 推文爬虫实现
- `crawls/get-followings.ts` - 关注列表爬虫实现
- `lib/scraper-base.ts` - 基类源码