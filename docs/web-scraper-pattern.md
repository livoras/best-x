# Web Scraper Design Pattern

基于 PlaywrightClient 和 Cheerio 的可复用爬虫设计模式。

## 开发流程

### 第1步：保存HTML快照

使用 `lib/extract-html.ts` 工具保存目标页面的HTML：

```bash
# 示例：保存关注列表页面
tsx lib/extract-html.ts https://x.com/livoras/following --wait 5000
# 输出: /tmp/x-com-1756299773101.html

# 示例：保存推文页面
tsx lib/extract-html.ts https://x.com/user/status/123456 --wait 3000
# 输出: /tmp/x-com-1756299883201.html
```

### 第2步：分析HTML结构

读取保存的HTML文件，分析页面结构和数据位置：

**示例分析：关注列表页面**
```
读取 /tmp/x-com-1756299773101.html 后发现：
- 用户容器：每个关注按钮 [data-testid$="-follow"] 向上查找
- 唯一标识：data-testid="1913258409677512704-unfollow" 中的数字部分
- 用户名：a[href^="/"] 且匹配 /^\/[a-zA-Z0-9_]+$/
- 显示名称：用户链接附近的 span 标签
- 关注状态：按钮结尾是 -unfollow（互相关注）或 -follow（单向）
```

**示例分析：推文页面**
```
读取 /tmp/x-com-1756299883201.html 后发现：
- 推文容器：<article> 标签
- 唯一标识：a[href*="/status/"] 的链接
- 文本内容：[data-testid="tweetText"]
- 作者信息：a[href^="/"] 中 @开头的文本
```

### 第3步：设计数据结构

基于分析结果，创建TypeScript类型定义：

**示例：关注列表类型定义**
```typescript
// types/following.ts
interface FollowingUser {
  userId: string;        // "1913258409677512704"
  username: string;      // "JacksonAtkinsX"
  displayName: string;   // "Jackson Atkins"
  handle: string;        // "@JacksonAtkinsX"
  isFollowing: boolean;  // true (基于-unfollow)
  avatarUrl: string;
  bio: string;
}
```

**示例：推文类型定义**
```typescript
// types/tweet.ts
interface Tweet {
  author: {
    name: string;
    handle: string;      // "@username"
    avatar: string;
  };
  content: {
    text: string;        // HTML格式
    hasMore: boolean;
  };
  statusLink: string;    // "/user/status/123456"
  stats: {
    replies: string;
    likes: string;
    views: string;
  };
}
```

### 第4步：实现完整爬虫

#### 4.1 非列表页面（单页提取）

直接提取即可，无需滚动：

```typescript
// crawls/get-single-tweet.ts
async function getSingleTweet(url: string) {
  const client = new PlaywrightClient('http://localhost:3103');
  const { pageId } = await client.createPage('tweet', 'Tweet', url, 3000);
  
  const html = await client.pageToHtmlFile(pageId, false);
  const tweet = extractTweet(html);
  
  await client.closePage(pageId);
  return tweet;
}
```

#### 4.2 列表页面（使用框架）

继承 `ScraperBase` 处理滚动和去重：

```typescript
// crawls/get-followings.ts
class FollowingScraper extends ScraperBase<FollowingUser, FollowingsResult> {
  extractItems(html: string): FollowingUser[] {
    // 使用第2步分析的提取逻辑
    const $ = cheerio.load(html);
    const users = [];
    $('[data-testid$="-follow"]').each(/* ... */);
    return users;
  }
  
  getItemId(user: FollowingUser): string {
    return user.userId; // 第2步分析得出的唯一标识
  }
  
  buildResult(): FollowingsResult {
    const items = this.getItems();
    // 分类：互相关注 vs 单向关注
    const mutual = items.filter(u => u.isFollowing);
    const oneWay = items.filter(u => !u.isFollowing);
    return { users: items, mutual, oneWay };
  }
}

// 使用
const scraper = new FollowingScraper();
await scraper.scrape('https://x.com/user/following', {
  scrollTimes: 10,  // 滚动10次
  maxItems: 100     // 最多100个用户
});
```

#### 4.3 双重用途设计（命令行 + 模块）

爬虫文件应同时支持命令行执行和作为模块被引入：

```typescript
// crawls/get-followings.ts

// 1. 导出主函数供其他模块使用
export async function getFollowings(
  username: string, 
  options?: ScrapeOptions
): Promise<FollowingsResult> {
  const scraper = new FollowingScraper(username);
  const url = `https://x.com/${username}/following`;
  return scraper.scrape(url, options);
}

// 2. 命令行入口（检测是否直接运行）
if (process.argv[2]) {
  const username = process.argv[2];
  const scrollTimes = parseInt(process.argv[3]) || 10;
  const maxUsers = process.argv[4] ? parseInt(process.argv[4]) : undefined;
  
  getFollowings(username, { scrollTimes, maxUsers })
    .then(result => {
      console.log(`📊 提取了 ${result.count} 个用户`);
      console.log(`💾 数据已保存到: ${result.usersFile}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error.message);
      process.exit(1);
    });
}
```

**使用方式：**

```bash
# 命令行执行
tsx crawls/get-followings.ts username 10 100

# 作为模块引入
import { getFollowings } from './crawls/get-followings';

const result = await getFollowings('elonmusk', { 
  scrollTimes: 5,
  maxUsers: 50 
});
```

## 核心技术点

### 去重机制
基于第2步分析的唯一标识进行去重：

```typescript
// 推文使用 statusLink
const seenTweets = new Set<string>();
if (!seenTweets.has(statusLink)) {
  seenTweets.add(statusLink);
  tweets.push(tweet);
}

// 用户使用 userId
const seenUsers = new Set<string>();
if (!seenUsers.has(userId)) {
  seenUsers.add(userId);
  users.push(user);
}
```

### 滚动终止条件
连续2次无新内容时停止：

```typescript
let noNewContentCount = 0;
for (let i = 0; i < scrollTimes; i++) {
  const countBefore = seenIds.size;
  // ... 滚动和提取 ...
  const countAfter = seenIds.size;
  
  if (countAfter === countBefore) {
    noNewContentCount++;
    if (noNewContentCount >= 2) {
      console.log('连续2次无新内容，停止');
      break;
    }
  } else {
    noNewContentCount = 0;
  }
}
```

## 实际案例对比

| 步骤 | 推文爬虫 (crawls/get-post.ts) | 关注列表爬虫 (crawls/get-followings.ts) |
|-----|----------------------|-------------------------------|
| **保存HTML** | `tsx lib/extract-html.ts https://x.com/user/status/123` | `tsx lib/extract-html.ts https://x.com/user/following` |
| **分析结构** | 容器：`<article>`<br>ID：statusLink | 容器：关注按钮向上<br>ID：userId |
| **数据结构** | Tweet（作者、内容、统计） | FollowingUser（用户信息、关注状态） |
| **完整实现** | 需要滚动、去重 | 需要滚动、去重 |

## 项目结构

```
best-x/
├── lib/
│   ├── extract-html.ts      # 步骤1：HTML保存工具
│   └── scraper-base.ts      # 步骤4：爬虫基类
├── types/
│   ├── tweet.ts             # 步骤3：推文类型
│   └── following.ts         # 步骤3：关注列表类型
├── crawls/
│   ├── get-post.ts              # 步骤4：推文爬虫实现
│   └── get-followings.ts # 步骤4：关注列表爬虫实现
```

## 快速开始

```bash
# 1. 保存HTML
tsx lib/extract-html.ts <url> --wait 5000

# 2-3. 分析并设计
# 读取HTML，分析结构，设计数据类型

# 4. 运行爬虫
tsx crawls/get-followings.ts username 10 100
```

## 最佳实践

- **分步验证**：每步都产出可验证的结果
- **HTML快照**：先保存HTML用于分析，避免重复访问网站
- **框架复用**：列表页面使用 `ScraperBase`，减少重复代码
- **清晰日志**：用emoji区分不同操作（📖打开 ✅成功 🛑停止）