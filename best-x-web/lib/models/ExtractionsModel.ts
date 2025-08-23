import { DB } from '../DB';
import type { TweetResult } from '@/types/tweet';

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
    scrollTimes: number = 3, 
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
    mergedContent: string;
    tweetCount: number;
    firstTweetTime: string;
    lastTweetTime?: string;
    mediaUrls: string[];
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

    // 合并连续推文的内容
    const mergedContent = continuousTweets
      .map(tweet => tweet.content.text)
      .join('\n\n');

    // 收集所有媒体URL
    const mediaUrls: string[] = [];
    continuousTweets.forEach(tweet => {
      if (tweet.media.images && tweet.media.images.length > 0) {
        mediaUrls.push(...tweet.media.images);
      }
    });

    return {
      author: {
        name: firstAuthor.name,
        handle: firstAuthor.handle,
        avatar: firstAuthor.avatar
      },
      mergedContent,
      tweetCount: continuousTweets.length,
      firstTweetTime: firstTweet.time,
      lastTweetTime: continuousTweets.length > 1 
        ? continuousTweets[continuousTweets.length - 1].time 
        : undefined,
      mediaUrls,
      url: tweetResult.url
    };
  }
}