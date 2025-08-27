import { DB } from '../DB';
import type { TweetResult, MediaItem } from '@/types/tweet';
import { DEFAULT_SCROLLS } from '../consts';

// 提取记录类型
export interface ExtractionRecord {
  id?: number;
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar?: string;
  tweet_count: number;
  scroll_times: number;
  filtered_count: number;
  main_tweet_text: string;
  post_time: string;
  post_date: string | null;
  extract_time?: string;
  data: string;
}

export class ExtractionsModel {
  private static instance: ExtractionsModel;
  private static db: DB;

  private constructor() {}

  public static setDB(db: DB): void {
    ExtractionsModel.db = db;
  }

  public static getInstance(): ExtractionsModel {
    if (!ExtractionsModel.db) {
      throw new Error('Database instance not set. Call setDB first.');
    }
    if (!ExtractionsModel.instance) {
      ExtractionsModel.instance = new ExtractionsModel();
    }
    return ExtractionsModel.instance;
  }

  // 解析 Twitter 时间格式
  private parseTwitterTime(timeStr: string): string | null {
    // 处理格式如 "上午4:11 · 2025年8月20日"
    const dateMatch = timeStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // 处理格式如 "8月20日"（假设当前年份）
    const monthDayMatch = timeStr.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const [, month, day] = monthDayMatch;
      const year = new Date().getFullYear();
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // 相对时间格式（如 "16小时"）返回 null
    return null;
  }

  // 保存提取结果
  public saveExtraction(
    result: TweetResult, 
    scrollTimes: number = DEFAULT_SCROLLS, 
    filteredCount: number = 0
  ): number {
    const mainTweet = result.tweets[0];
    if (!mainTweet) {
      throw new Error('No tweets found in result');
    }

    const sql = `
      INSERT INTO extractions (
        url, author_name, author_handle, author_avatar,
        tweet_count, scroll_times, filtered_count,
        main_tweet_text, post_time, post_date, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    ExtractionsModel.db.execute(sql, [
      result.url,
      mainTweet.author.name,
      mainTweet.author.handle,
      mainTweet.author.avatar,
      result.count,
      scrollTimes,
      filteredCount,
      mainTweet.content.text.substring(0, 500), // 预览前500字符
      mainTweet.time,
      this.parseTwitterTime(mainTweet.time),
      JSON.stringify(result)
    ]);

    // 获取最后插入的ID
    const lastRow = ExtractionsModel.db.query<{ id: number }>(
      'SELECT last_insert_rowid() as id'
    );
    return lastRow[0].id;
  }

  // 获取提取记录列表
  public getExtractions(limit: number = 20, offset: number = 0): ExtractionRecord[] {
    const sql = `
      SELECT id, url, author_name, author_handle, author_avatar,
             tweet_count, scroll_times, filtered_count,
             main_tweet_text, post_time, post_date, extract_time
      FROM extractions
      ORDER BY extract_time DESC
      LIMIT ? OFFSET ?
    `;
    return ExtractionsModel.db.query<ExtractionRecord>(sql, [limit, offset]);
  }

  // 获取单个提取记录（包含完整数据）
  public getExtraction(id: number): TweetResult | null {
    const rows = ExtractionsModel.db.query<{ data: string }>(
      'SELECT data FROM extractions WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].data);
  }

  // 获取提取记录元数据
  public getExtractionMeta(id: number): ExtractionRecord | null {
    const rows = ExtractionsModel.db.query<ExtractionRecord>(
      'SELECT * FROM extractions WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // 删除提取记录
  public deleteExtraction(id: number): boolean {
    ExtractionsModel.db.execute('DELETE FROM extractions WHERE id = ?', [id]);
    
    // 检查是否删除成功
    const checkRows = ExtractionsModel.db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM extractions WHERE id = ?',
      [id]
    );
    return checkRows[0].count === 0;
  }

  // 按 URL 搜索
  public searchByUrl(urlPattern: string): ExtractionRecord[] {
    const sql = `
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      WHERE url LIKE ?
      ORDER BY extract_time DESC
    `;
    return ExtractionsModel.db.query<ExtractionRecord>(sql, [`%${urlPattern}%`]);
  }

  // 按作者搜索
  public searchByAuthor(handle: string): ExtractionRecord[] {
    const sql = `
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      WHERE author_handle = ?
      ORDER BY extract_time DESC
    `;
    return ExtractionsModel.db.query<ExtractionRecord>(sql, [handle]);
  }

  // 按内容搜索
  public searchByContent(keyword: string): ExtractionRecord[] {
    const sql = `
      SELECT id, url, author_name, author_handle,
             tweet_count, main_tweet_text, extract_time
      FROM extractions
      WHERE main_tweet_text LIKE ?
      ORDER BY extract_time DESC
    `;
    return ExtractionsModel.db.query<ExtractionRecord>(sql, [`%${keyword}%`]);
  }

  // 获取统计数据
  public getStats() {
    const result = ExtractionsModel.db.query<{
      total_extractions: number;
      total_tweets: number;
      total_filtered: number;
      unique_authors: number;
      last_extraction: string | null;
    }>(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(tweet_count) as total_tweets,
        SUM(filtered_count) as total_filtered,
        COUNT(DISTINCT author_handle) as unique_authors,
        MAX(extract_time) as last_extraction
      FROM extractions
    `);
    
    const stats = result[0];
    return {
      totalExtractions: stats.total_extractions || 0,
      totalTweets: stats.total_tweets || 0,
      totalFiltered: stats.total_filtered || 0,
      uniqueAuthors: stats.unique_authors || 0,
      lastExtraction: stats.last_extraction || null
    };
  }

  // 获取最近的提取记录
  public getRecentExtractions(limit: number = 10): ExtractionRecord[] {
    const sql = `
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      ORDER BY extract_time DESC
      LIMIT ?
    `;
    return ExtractionsModel.db.query<ExtractionRecord>(sql, [limit]);
  }

  // 获取连续同作者推文合并的文章内容
  public getPostContentByTweet(extractionId: number): {
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
    tweets: Array<{
      text: string;
      media: {
        items: MediaItem[];  // 按原始顺序的媒体项
      };
      card?: {
        url: string;
        title: string;
        description?: string;
        image?: string;
        domain?: string;
      } | null;
      time: string;
    }>;
    mainThread: Array<{
      text: string;
      media: {
        items: MediaItem[];
      };
      card?: {
        url: string;
        title: string;
        description?: string;
        image?: string;
        domain?: string;
      } | null;
      time: string;
    }>;
    replies: Array<{
      text: string;
      media: {
        items: MediaItem[];
      };
      card?: {
        url: string;
        title: string;
        description?: string;
        image?: string;
        domain?: string;
      } | null;
      time: string;
      author: {
        name: string;
        handle: string;
        avatar: string;
      };
    }>;
    tweetCount: number;
    url: string;
  } | null {
    // 获取完整的推文数据
    const tweetResult = this.getExtraction(extractionId);
    if (!tweetResult || !tweetResult.tweets || tweetResult.tweets.length === 0) {
      return null;
    }

    const tweets = tweetResult.tweets;
    const firstTweet = tweets[0];
    const firstAuthor = firstTweet.author;

    // 如果新数据结构已经存在，直接使用
    if (tweetResult.mainThread && tweetResult.replies) {
      const mainThreadFormatted = tweetResult.mainThread.map(tweet => this.formatTweetForArticle(tweet));
      const repliesFormatted = tweetResult.replies.map(tweet => ({
        ...this.formatTweetForArticle(tweet),
        author: tweet.author
      }));

      return {
        author: firstAuthor,
        tweets: mainThreadFormatted, // 保留以兼容旧代码
        mainThread: mainThreadFormatted,
        replies: repliesFormatted,
        tweetCount: tweetResult.mainThread.length,
        url: tweetResult.url
      };
    }

    // 向后兼容：如果是旧数据，使用原逻辑
    // 找出从开头开始连续的同一作者的推文
    let continuousTweets = [firstTweet];
    let lastContinuousIndex = 0;
    
    for (let i = 1; i < tweets.length; i++) {
      const currentTweet = tweets[i];
      // 检查是否为同一作者
      if (currentTweet.author.handle === firstAuthor.handle) {
        continuousTweets.push(currentTweet);
        lastContinuousIndex = i;
      } else {
        // 遇到不同作者，停止
        break;
      }
    }

    // 保留每条推文的独立结构
    const mergedTweets = continuousTweets.map(tweet => this.formatTweetForArticle(tweet));
    
    // 获取剩余的推文作为回复
    const remainingTweets = tweets.slice(lastContinuousIndex + 1);
    const replies = remainingTweets.map(tweet => ({
      ...this.formatTweetForArticle(tweet),
      author: tweet.author
    }));

    return {
      author: {
        name: firstAuthor.name,
        handle: firstAuthor.handle,
        avatar: firstAuthor.avatar
      },
      tweets: mergedTweets, // 保留以兼容旧代码
      mainThread: mergedTweets,
      replies: replies,
      tweetCount: continuousTweets.length,
      url: tweetResult.url
    };
  }

  // 格式化单个推文为文章内容
  private formatTweetForArticle(tweet: any): {
    text: string;
    media: {
      items: MediaItem[];
    };
    card?: {
      url: string;
      title: string;
      description?: string;
      image?: string;
      domain?: string;
    } | null;
    time: string;
  } {
    return {
      text: tweet.content.text,
      media: {
        items: tweet.media.items || []
      },
      card: tweet.card || null,
      time: tweet.time
    };
  }

  // 自定义 Twitter HTML 到 Markdown 转换器
  private convertTwitterHtmlToMarkdown(html: string): string {
    
    // 1. 移除 HTML 标签但保留内容和结构
    let text = html;
    
    // 处理表情符号图片
    text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1');
    
    // 处理链接 - 保留 @提及和 #标签
    text = text.replace(/<a[^>]*>(@[^<]+)<\/a>/g, '$1');
    text = text.replace(/<a[^>]*>(#[^<]+)<\/a>/g, '$1');
    
    // 处理其他链接 - 改进版本，支持嵌套 HTML
    // 使用更复杂的处理来提取嵌套内容
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>((?:[^<]|<(?!\/a>))*)<\/a>/g, (match, href, content) => {
      // 移除内容中的所有 HTML 标签，只保留文本
      const cleanContent = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      // 如果是 @提及或 #标签，保持原样
      if (cleanContent.startsWith('@') || cleanContent.startsWith('#')) {
        return cleanContent;
      }
      // 其他情况转换为 Markdown 链接
      return `[${cleanContent}](${href})`;
    });
    
    // 移除所有其他 HTML 标签但保留内容
    text = text.replace(/<[^>]+>/g, '');
    
    // 2. 处理 HTML 实体
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // 3. 处理换行和列表
    // 保留原始换行
    const lines = text.split('\n');
    
    const processedLines = lines.map(line => {
      const trimmedLine = line.trim();
      
      // 识别列表项（以 • 开头）
      if (trimmedLine.startsWith('•')) {
        // 转换为 Markdown 列表格式
        return '- ' + trimmedLine.substring(1).trim();
      }
      
      // 识别数字列表（如 "1. " 或 "1) "）
      const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)/);
      if (numberedMatch) {
        return `${numberedMatch[1]}. ${numberedMatch[2]}`;
      }
      
      return trimmedLine;
    });
    
    // 4. 合并处理后的行
    // 保留空行作为段落分隔
    let result = '';
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const nextLine = processedLines[i + 1];
      
      if (line === '') {
        // 空行保留为段落分隔
        result += '\n\n';
      } else if (line.startsWith('- ')) {
        // 列表项
        result += line;
        // 如果下一行也是列表项，添加单个换行
        if (nextLine && nextLine.startsWith('- ')) {
          result += '\n';
        } else {
          result += '\n\n';
        }
      } else {
        // 普通文本
        result += line;
        // 如果下一行不是空行且不是列表，添加两个空格（硬换行）
        if (nextLine && nextLine !== '' && !nextLine.startsWith('- ')) {
          result += '  \n';
        } else if (nextLine) {
          result += '\n';
        }
      }
    }
    
    return result.trim();
  }

  // 获取 Markdown 格式的文章内容
  public getPostContentAsMarkdown(extractionId: number): {
    markdown: string;
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
    tweetCount: number;
    url: string;
  } | null {
    // 先获取 HTML 格式的文章内容
    const articleContent = this.getPostContentByTweet(extractionId);
    if (!articleContent) {
      return null;
    }

    // 转换每条推文并拼接
    const markdownParts: string[] = [];
    
    for (let i = 0; i < articleContent.tweets.length; i++) {
      const tweet = articleContent.tweets[i];
      let tweetMarkdown = '';
      
      // 1. 使用自定义转换器转换 HTML 文本到 Markdown
      const markdownText = this.convertTwitterHtmlToMarkdown(tweet.text);
      tweetMarkdown += markdownText;
      
      // 2. 添加媒体内容（图片和视频）
      if (tweet.media && tweet.media.items && tweet.media.items.length > 0) {
        tweetMarkdown += '\n\n';
        for (const item of tweet.media.items) {
          if (item.type === 'image') {
            // 添加图片
            tweetMarkdown += `![Image](${item.url})\n`;
          } else if (item.type === 'video' && item.thumbnail) {
            // 添加视频缩略图（因为视频本身无法在 Markdown 中直接播放）
            tweetMarkdown += `![Video](${item.thumbnail})\n`;
            tweetMarkdown += `*[视频内容]*\n`;
          }
        }
      }
      
      // 3. 添加 Twitter Card（链接预览）
      if (tweet.card) {
        tweetMarkdown += '\n\n';
        if (tweet.card.image) {
          tweetMarkdown += `[![${tweet.card.title}](${tweet.card.image})](${tweet.card.url})\n`;
        }
        tweetMarkdown += `**[${tweet.card.title}](${tweet.card.url})**\n`;
        if (tweet.card.description) {
          tweetMarkdown += `${tweet.card.description}\n`;
        }
        if (tweet.card.domain) {
          tweetMarkdown += `*${tweet.card.domain}*\n`;
        }
      }
      
      // 添加到数组
      markdownParts.push(tweetMarkdown);
      
      // 如果不是最后一条推文，添加分隔符
      if (i < articleContent.tweets.length - 1) {
        markdownParts.push('\n\n---\n\n');
      }
    }

    // 拼接所有推文
    const fullMarkdown = markdownParts.join('');

    return {
      markdown: fullMarkdown,
      author: articleContent.author,
      tweetCount: articleContent.tweetCount,
      url: articleContent.url
    };
  }
}