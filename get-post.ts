import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import type { Tweet, TweetResult, MediaItem } from './types/tweet';

async function getXPost(url?: string, options?: { scrollTimes?: number }): Promise<TweetResult> {
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
    
    // 用于去重的集合和保存所有articles的数组
    const seenTweets = new Set<string>();
    const allArticlesHtml: string[] = [];
    
    // 记录推荐内容的handles，用于持久过滤
    const recommendedHandles = new Set<string>();
    let foundDiscoverMore = false;
    
    // 初次加载，保存主推文和初始内容
    console.log('📸 保存初始内容（包括主推文）...');
    
    // 尝试点击"显示此对话"或类似按钮来展开连续推文
    try {
      // 查找可能的展开按钮
      const snapshot = await client.getPageSnapshot(pageId);
      
      // 检查是否有"显示此对话"按钮
      if (snapshot.includes('显示此对话') || snapshot.includes('Show this thread')) {
        console.log('🔄 发现"显示此对话"按钮，尝试点击展开...');
        
        // 查找并点击按钮
        const buttons = await client.getPageSnapshot(pageId);
        // 使用XPath或选择器查找按钮
        const showThreadBtn = buttons.match(/xp-\d+/g)?.find(xp => {
          return buttons.includes(`${xp}.*显示此对话`) || buttons.includes(`${xp}.*Show this thread`);
        });
        
        if (showThreadBtn) {
          await client.browserClick(pageId, showThreadBtn, 2000);
          console.log('✅ 已点击展开对话按钮');
          await client.waitForTimeout(pageId, 2000);
        }
      }
      
      // 检查是否有"显示更多回复"按钮
      if (snapshot.includes('显示更多回复') || snapshot.includes('Show more replies')) {
        console.log('🔄 发现"显示更多回复"按钮，尝试点击展开...');
        // 类似逻辑处理更多回复按钮
      }
    } catch (error) {
      console.log('⚠️ 尝试展开对话时出错:', error);
    }
    
    let htmlFile = await client.pageToHtmlFile(pageId, false);
    let htmlContent = fs.readFileSync(htmlFile.filePath, 'utf-8');
    let $ = cheerio.load(htmlContent);
    
    $('article').each((i, el) => {
      const $article = $(el);
      
      // 提取handle作为标识
      const handle = $article.find('a[href^="/"]')
        .filter((j, link) => $(link).text().startsWith('@'))
        .first().text();
      
      // 检查是否到达"发现更多"区域
      if (!foundDiscoverMore && $article.prevAll('div:has(h2:contains("发现更多"))').length > 0) {
        foundDiscoverMore = true;
      }
      
      // 如果已经发现"发现更多"，记录后续的所有handle为推荐内容
      if (foundDiscoverMore && handle) {
        recommendedHandles.add(handle);
        console.log(`  ⚠️  跳过推荐内容: ${handle}`);
        return;
      }
      
      // 检查是否是之前记录的推荐内容
      if (recommendedHandles.has(handle)) {
        console.log(`  ⚠️  跳过推荐内容（已记录）: ${handle}`);
        return;
      }
      
      // 提取状态链接作为唯一标识
      const statusLinks = $article.find('a[href*="/status/"]').map((j, link) => $(link).attr('href')).get();
      const mainStatusLink = statusLinks.find(link => !link?.includes('/photo/') && !link?.includes('/analytics')) || statusLinks[0];
      
      // 调试：记录所有找到的链接
      if (statusLinks.length > 0) {
        console.log(`    🔍 找到 ${statusLinks.length} 个status链接:`, statusLinks.slice(0, 3));
      } else {
        // 提取文本片段用于识别
        const textPreview = $article.find('[data-testid="tweetText"]').text().substring(0, 50);
        console.log(`    ⚠️  未找到status链接的article，文本预览: "${textPreview}..."`);
        
        // 尝试其他方式获取唯一标识
        const allLinks = $article.find('a[href]').map((j, link) => $(link).attr('href')).get();
        console.log(`    🔗 该article的所有链接:`, allLinks.slice(0, 5));
      }
      
      if (mainStatusLink && !seenTweets.has(mainStatusLink)) {
        seenTweets.add(mainStatusLink);
        allArticlesHtml.push($.html(el));
        console.log(`  ✅ 收集推文: ${mainStatusLink}`);
      } else if (!mainStatusLink) {
        // 没有status链接的article也保存（可能是特殊情况）
        allArticlesHtml.push($.html(el));
        console.log(`  ✅ 收集特殊推文（无status链接）`);
      } else {
        console.log(`  ⏭️  跳过重复: ${mainStatusLink}`);
      }
    });
    
    // 滚动加载更多内容，每次都收集新的articles
    const scrollTimes = options?.scrollTimes || 10;
    console.log(`🔄 滚动 ${scrollTimes} 次加载更多内容...`);
    let filteredCount = 0;
    
    for (let i = 0; i < scrollTimes; i++) {
      // 记录本次滚动前的推文数量
      const tweetsCountBefore = seenTweets.size;
      
      // 执行2次 PageDown 作为一次滚动
      await client.browserPressKey(pageId, 'PageDown', undefined, 300);
      await client.browserPressKey(pageId, 'PageDown', undefined, 300);
      await client.waitForTimeout(pageId, 500);
      
      // 每次滚动后都抓取当前的articles
      htmlFile = await client.pageToHtmlFile(pageId, false);
      htmlContent = fs.readFileSync(htmlFile.filePath, 'utf-8');
      $ = cheerio.load(htmlContent);
      
      console.log(`  📜 第 ${i + 1} 次滚动后...`);
      $('article').each((j, el) => {
        const $article = $(el);
        
        // 提取handle作为标识
        const handle = $article.find('a[href^="/"]')
          .filter((k, link) => $(link).text().startsWith('@'))
          .first().text();
        
        // 检查是否到达"发现更多"区域
        if (!foundDiscoverMore && $article.prevAll('div:has(h2:contains("发现更多"))').length > 0) {
          foundDiscoverMore = true;
        }
        
        // 如果已经发现"发现更多"，记录后续的所有handle为推荐内容
        if (foundDiscoverMore && handle) {
          if (!recommendedHandles.has(handle)) {
            recommendedHandles.add(handle);
            const filteredText = $article.find('span').toArray().map(span => $(span).text()).find(text => text.length > 30)?.substring(0, 50) || '';
            console.log(`    ⚠️  跳过推荐内容: ${handle} - ${filteredText}...`);
            filteredCount++;
          }
          return;
        }
        
        // 检查是否是之前记录的推荐内容
        if (recommendedHandles.has(handle)) {
          console.log(`    ⚠️  跳过推荐内容（已记录）: ${handle}`);
          filteredCount++;
          return;
        }
        
        const statusLinks = $article.find('a[href*="/status/"]').map((k, link) => $(link).attr('href')).get();
        const mainStatusLink = statusLinks.find(link => !link?.includes('/photo/') && !link?.includes('/analytics')) || statusLinks[0];
        
        // 调试：记录链接情况
        if (!mainStatusLink) {
          const textPreview = $article.find('[data-testid="tweetText"]').text().substring(0, 50);
          console.log(`    ⚠️  滚动后未找到status链接，文本: "${textPreview}..."`);
          // 尝试查找其他可能的唯一标识
          const timeEl = $article.find('time');
          const timeInfo = timeEl.length > 0 ? `时间: ${timeEl.attr('datetime')}` : '无时间';
          console.log(`        ${timeInfo}, handle: ${handle || '无'}`);
        }
        
        if (mainStatusLink && !seenTweets.has(mainStatusLink)) {
          seenTweets.add(mainStatusLink);
          allArticlesHtml.push($.html(el));
          console.log(`    ✅ 收集推文: ${mainStatusLink}`);
        } else if (!mainStatusLink) {
          // 没有status链接但可能是thread的一部分
          const uniqueId = `${handle}-${$article.find('time').attr('datetime')}-${$article.find('[data-testid="tweetText"]').text().substring(0, 20)}`;
          if (!seenTweets.has(uniqueId)) {
            seenTweets.add(uniqueId);
            allArticlesHtml.push($.html(el));
            console.log(`    ✅ 收集无链接推文（可能是thread）: ${uniqueId}`);
          }
        } else if (mainStatusLink) {
          console.log(`    ⏭️  跳过重复: ${mainStatusLink}`);
        }
      });
      
      // 检查本次滚动是否有新推文
      const tweetsCountAfter = seenTweets.size;
      const newTweetsCount = tweetsCountAfter - tweetsCountBefore;
      
      console.log(`    📊 本次新增: ${newTweetsCount} 条推文`);
      
      if (newTweetsCount === 0) {
        console.log(`  🛑 没有新推文，已到达底部，停止滚动`);
        break;
      }
    }
    
    // 输出统计信息
    console.log(`\n📊 收集统计:`)
    console.log(`  - 收集了 ${allArticlesHtml.length} 条真实评论`);
    console.log(`  - 过滤了 ${filteredCount} 条推荐内容`);
    
    // 合并所有收集到的articles
    const mergedHtml = `<div>${allArticlesHtml.join('\n')}</div>`;
    $ = cheerio.load(mergedHtml);
    
    // 提取所有article标签
    const articles = $('article');
    
    // 提取每个article的数据
    const tweets: Tweet[] = articles.map((i, el) => {
      const $article = $(el);
      
      // 提取作者信息
      const $links = $article.find('a[href^="/"]');
      const $imgs = $article.find('img');
      
      // 提取文本内容 - 使用 data-testid="tweetText" 选择器，保留HTML结构
      const tweetTextDiv = $article.find('[data-testid="tweetText"]');
      const textContent = tweetTextDiv.length > 0 
        ? tweetTextDiv.html()?.trim() || ''
        : '';
      
      // 提取 Twitter Card 信息
      let cardInfo: { url: string; title: string; description?: string; image?: string; domain?: string } | null = null;
      const cardWrapper = $article.find('[data-testid="card.wrapper"]');
      if (cardWrapper.length > 0) {
        // 提取卡片链接
        const cardLink = cardWrapper.find('a').first();
        const cardUrl = cardLink.attr('href') || '';
        
        // 提取卡片图片
        const cardImage = cardWrapper.find('img').first().attr('src') || '';
        
        // 提取卡片标题（通常在图片后的文本中）
        const cardTitle = cardWrapper.find('span').first().text() || '';
        
        // 提取域名（来自 "来自 domain.com" 这样的文本）
        const domainText = $article.find('a[href="' + cardUrl + '"]').last().text();
        const domainMatch = domainText.match(/来自\s+(.+)/);
        let domain = '';
        if (domainMatch) {
          domain = domainMatch[1];
        } else if (cardUrl) {
          try {
            domain = new URL(cardUrl).hostname;
          } catch (e) {
            domain = '';
          }
        }
        
        if (cardUrl) {
          cardInfo = {
            url: cardUrl,
            title: cardTitle,
            image: cardImage,
            domain: domain
          };
          console.log(`  📇 提取卡片: ${cardTitle.substring(0, 50)}... -> ${domain}`);
        }
      }
      
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
      
      // 按DOM顺序收集所有媒体项
      const mediaItems: MediaItem[] = [];
      const allMediaElements = $article.find('video[poster], img[src*="/media/"]');
      
      allMediaElements.each((idx, el) => {
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'video') {
          const poster = $(el).attr('poster');
          if (poster) {
            mediaItems.push({
              type: 'video',
              thumbnail: poster,
              position: idx
            });
          }
        } else if (tagName === 'img') {
          const src = $(el).attr('src') || '';
          if (src.includes('amplify_video_thumb')) {
            // 视频缩略图（作为视频处理）
            mediaItems.push({
              type: 'video',
              thumbnail: src,
              position: idx
            });
          } else if (src.includes('/media/')) {
            // 普通图片
            mediaItems.push({
              type: 'image',
              url: src,
              position: idx
            });
          }
        }
      });
      
      return {
        author: {
          name: $links.eq(1).text() || $links.eq(0).text(),
          handle: $links.filter((j, link) => $(link).text().startsWith('@')).first().text(),
          avatar: $imgs.first().attr('src') || ''
        },
        content: {
          text: textContent,
          hasMore: $article.find('button:contains("显示更多")').length > 0
        },
        media: {
          items: mediaItems        // 按原始顺序的媒体项
        },
        card: cardInfo,
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
    if (allArticlesHtml.length > 0) {
      articlesFile = `/tmp/articles-${Date.now()}.html`;
      fs.writeFileSync(articlesFile, allArticlesHtml.join('\n\n'), 'utf-8');
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
if (process.argv[2]) {
  const scrollTimes = parseInt(process.argv[3]) || 10;
  getXPost(process.argv[2], { scrollTimes })
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