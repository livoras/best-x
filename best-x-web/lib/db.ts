import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { TweetResult } from '@/types/tweet';

// 数据库路径
const DB_PATH = join(process.cwd(), 'data', 'tweets.db');

// 初始化数据库连接
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化数据库结构
const initSchema = () => {
  const schemaPath = join(process.cwd(), 'lib', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
};

// 提取记录类型
export interface ExtractionRecord {
  id?: number;
  url: string;
  author_name: string;
  author_handle: string;
  tweet_count: number;
  scroll_times: number;
  filtered_count: number;
  main_tweet_text: string;
  post_time: string;
  post_date: string | null;
  extract_time?: string;
  data: string;
}

// 解析 Twitter 时间格式
function parseTwitterTime(timeStr: string): string | null {
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

// 数据库操作类
export class ExtractionsDB {
  constructor() {
    // 确保数据目录存在
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    // 初始化数据库结构
    initSchema();
  }

  // 保存提取结果
  saveExtraction(
    result: TweetResult, 
    scrollTimes: number = 3, 
    filteredCount: number = 0
  ): number {
    const mainTweet = result.tweets[0];
    if (!mainTweet) {
      throw new Error('No tweets found in result');
    }

    const stmt = db.prepare(`
      INSERT INTO extractions (
        url, author_name, author_handle,
        tweet_count, scroll_times, filtered_count,
        main_tweet_text, post_time, post_date, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      result.url,
      mainTweet.author.name,
      mainTweet.author.handle,
      result.count,
      scrollTimes,
      filteredCount,
      mainTweet.content.text.substring(0, 500), // 预览前500字符
      mainTweet.time,
      parseTwitterTime(mainTweet.time),
      JSON.stringify(result)
    );

    return info.lastInsertRowid as number;
  }

  // 获取提取记录列表
  getExtractions(limit: number = 20, offset: number = 0): ExtractionRecord[] {
    const stmt = db.prepare(`
      SELECT id, url, author_name, author_handle,
             tweet_count, scroll_times, filtered_count,
             main_tweet_text, post_time, post_date, extract_time
      FROM extractions
      ORDER BY extract_time DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as ExtractionRecord[];
  }

  // 获取单个提取记录（包含完整数据）
  getExtraction(id: number): TweetResult | null {
    const stmt = db.prepare('SELECT data FROM extractions WHERE id = ?');
    const row = stmt.get(id) as { data: string } | undefined;
    
    if (!row) return null;
    return JSON.parse(row.data);
  }

  // 获取提取记录元数据
  getExtractionMeta(id: number): ExtractionRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM extractions WHERE id = ?
    `);
    return stmt.get(id) as ExtractionRecord | null;
  }

  // 删除提取记录
  deleteExtraction(id: number): boolean {
    const stmt = db.prepare('DELETE FROM extractions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // 按 URL 搜索
  searchByUrl(urlPattern: string): ExtractionRecord[] {
    const stmt = db.prepare(`
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      WHERE url LIKE ?
      ORDER BY extract_time DESC
    `);
    return stmt.all(`%${urlPattern}%`) as ExtractionRecord[];
  }

  // 按作者搜索
  searchByAuthor(handle: string): ExtractionRecord[] {
    const stmt = db.prepare(`
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      WHERE author_handle = ?
      ORDER BY extract_time DESC
    `);
    return stmt.all(handle) as ExtractionRecord[];
  }

  // 按内容搜索
  searchByContent(keyword: string): ExtractionRecord[] {
    const stmt = db.prepare(`
      SELECT id, url, author_name, author_handle,
             tweet_count, main_tweet_text, extract_time
      FROM extractions
      WHERE main_tweet_text LIKE ?
      ORDER BY extract_time DESC
    `);
    return stmt.all(`%${keyword}%`) as ExtractionRecord[];
  }

  // 获取统计数据
  getStats() {
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(tweet_count) as total_tweets,
        SUM(filtered_count) as total_filtered,
        COUNT(DISTINCT author_handle) as unique_authors,
        MAX(extract_time) as last_extraction
      FROM extractions
    `).get() as any;
    
    return {
      totalExtractions: result.total_extractions || 0,
      totalTweets: result.total_tweets || 0,
      totalFiltered: result.total_filtered || 0,
      uniqueAuthors: result.unique_authors || 0,
      lastExtraction: result.last_extraction || null
    };
  }

  // 获取最近的提取记录
  getRecentExtractions(limit: number = 10): ExtractionRecord[] {
    const stmt = db.prepare(`
      SELECT id, url, author_name, author_handle,
             tweet_count, extract_time
      FROM extractions
      ORDER BY extract_time DESC
      LIMIT ?
    `);
    return stmt.all(limit) as ExtractionRecord[];
  }

  // 关闭数据库连接
  close() {
    db.close();
  }
}

// 导出单例实例
export const extractionsDB = new ExtractionsDB();