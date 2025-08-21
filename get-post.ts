import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import type { Tweet, TweetResult } from './types/tweet';

async function getXPost(url?: string): Promise<TweetResult> {
  try {
    // 获取推文URL
    const tweetUrl = url || process.argv[2];
    if (!tweetUrl) {
      throw new Error('请提供推文URL');
    }
    
    // 连接到 HTTP 服务器
    const client = new PlaywrightClient('http://localhost:3102');
    
    // 打开推文并等待加载
    console.log(`📖 获取推文: ${tweetUrl}`);
    const { pageId } = await client.createPage(
      'x-post',
      'X (Twitter) 推文',
      tweetUrl,
      3000
    );
    await client.waitForTimeout(pageId, 3000);
    
    // 保存精简版HTML
    const htmlFile = await client.pageToHtmlFile(pageId, true);
    
    // 读取并解析HTML
    const htmlContent = fs.readFileSync(htmlFile.filePath, 'utf-8');
    const $ = cheerio.load(htmlContent);
    
    // 提取所有article标签
    const articles = $('article');
    
    // 提取每个article的数据
    const tweets: Tweet[] = articles.map((i, el) => {
      const $article = $(el);
      
      // 提取作者信息
      const $links = $article.find('a[href^="/"]');
      const $imgs = $article.find('img');
      
      // 提取文本内容
      const textSpans = $article.find('span').toArray()
        .map(span => $(span).text())
        .filter(text => text.length > 30);
      
      // 提取互动数据
      const $statsGroup = $article.find('div[role="group"]');
      const ariaLabel = $statsGroup.attr('aria-label') || '';
      const buttons = $statsGroup.find('button');
      const $analyticsLink = $statsGroup.find('a[href*="/analytics"]');
      
      // 解析aria-label获取完整统计
      const parseStats = (label: string) => {
        const stats: any = {};
        // 匹配模式: "351 回复、1704 次转帖、9799 喜欢、12034 书签、1279922 次观看"
        const patterns = {
          replies: /(\d+(?:,\d+)*)\s*回复/,
          retweets: /(\d+(?:,\d+)*)\s*次?转帖/,
          likes: /(\d+(?:,\d+)*)\s*喜欢/,
          bookmarks: /(\d+(?:,\d+)*)\s*书签/,
          views: /(\d+(?:,\d+)*)\s*次?观看/
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = label.match(pattern);
          stats[key] = match ? match[1] : '0';
        }
        return stats;
      };
      
      const ariaStats = parseStats(ariaLabel);
      
      // 提取状态链接
      const statusLinks = $article.find('a[href*="/status/"]').map((j, el) => $(el).attr('href')).get();
      const mainStatusLink = statusLinks.find(link => !link?.includes('/photo/') && !link?.includes('/analytics')) || statusLinks[0] || '';
      
      // 提取视图数（可能在span或a标签中）
      let viewCount = ariaStats.views || '';
      if ($analyticsLink.length > 0) {
        viewCount = $analyticsLink.text() || viewCount;
      }
      
      // 检测视频
      const hasVideo = $article.find('img[src*="amplify_video_thumb"]').length > 0 
                    || $article.find('button[aria-label*="播放"]').length > 0;
      
      // 提取视频信息
      let videoInfo = null;
      if (hasVideo) {
        const thumbnail = $article.find('img[src*="amplify_video_thumb"]').attr('src');
        
        videoInfo = {
          thumbnail: thumbnail || ''
        };
      }
      
      // 提取普通图片（排除视频缩略图）
      const mediaImages = $imgs.filter((j, img) => {
        const src = $(img).attr('src') || '';
        return src.includes('/media/') && !src.includes('amplify_video_thumb');
      }).map((j, img) => $(img).attr('src') || '').get();
      
      return {
        author: {
          name: $links.eq(1).text() || $links.eq(0).text(),
          handle: $links.filter((j, link) => $(link).text().startsWith('@')).first().text(),
          avatar: $imgs.first().attr('src') || ''
        },
        content: {
          text: textSpans[0] || '',
          hasMore: $article.find('button:contains("显示更多")').length > 0
        },
        media: {
          images: mediaImages,
          video: videoInfo
        },
        time: $article.find('time').text(),
        statusLink: mainStatusLink,
        stats: {
          replies: buttons.eq(0).text() || ariaStats.replies || '0',
          retweets: buttons.eq(1).text() || ariaStats.retweets || '0',
          likes: buttons.eq(2).text() || ariaStats.likes || '0',
          bookmarks: buttons.eq(3).text() || ariaStats.bookmarks || '0',
          views: viewCount
        }
      };
    }).get();
    
    // 保存article HTML到文件
    let articlesFile = '';
    if (articles.length > 0) {
      articlesFile = `/tmp/articles-${Date.now()}.html`;
      const articlesHtml = articles.map((i, el) => $.html(el)).get().join('\n\n');
      fs.writeFileSync(articlesFile, articlesHtml, 'utf-8');
    }
    
    // 关闭页面
    await client.closePage(pageId);
    
    // 返回提取的数据
    return {
      url: tweetUrl,
      htmlFile: htmlFile.filePath,
      articlesFile,
      tweets,
      count: tweets.length
    };
    
  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  }
}

// 如果直接运行脚本
if (require.main === module || process.argv[1]?.includes('get-post')) {
  getXPost()
    .then(result => {
      console.log('\n✨ 完成！');
      console.log(`📄 HTML: ${result.htmlFile}`);
      console.log(`📰 提取了 ${result.count} 条推文`);
      
      // 输出简要信息而不是完整JSON
      console.log('\n📊 推文摘要:');
      result.tweets.forEach((tweet, i) => {
        console.log(`${i + 1}. ${tweet.author.handle}: ${tweet.content.text.substring(0, 60)}...`);
      });
      
      // 保存完整数据到文件
      const dataFile = `/tmp/tweet-data-${Date.now()}.json`;
      fs.writeFileSync(dataFile, JSON.stringify(result, null, 2));
      console.log(`\n💾 完整数据已保存到: ${dataFile}`);
    })
    .catch(error => {
      console.error('错误:', error.message);
      process.exit(1);
    });
}

// 导出函数
export { getXPost };