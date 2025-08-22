import BetterSqlite3 from 'better-sqlite3';
import type { Database as SQLiteDatabase } from 'better-sqlite3';

export class DB {
  private static instance: DB;
  private db: SQLiteDatabase;
  
  private constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    // 配置数据库
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  public static getInstance(dbPath?: string): DB {
    if (!DB.instance) {
      if (!dbPath) {
        throw new Error('DB instance not initialized. Please provide dbPath when getting instance for the first time.');
      }
      DB.instance = new DB(dbPath);
    }
    return DB.instance;
  }
  
  // 事务相关方法
  public beginTransaction(): void {
    this.db.prepare('BEGIN').run();
  }
  
  public commit(): void {
    this.db.prepare('COMMIT').run();
  }
  
  public rollback(): void {
    this.db.prepare('ROLLBACK').run();
  }
  
  // 查询方法
  public query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(params) as T[];
  }
  
  public execute(sql: string | string[], params: unknown[] = []): void {
    if (Array.isArray(sql)) {
      // 如果是语句数组，顺序执行每个语句
      for (const statement of sql) {
        if (statement.trim()) {
          this.db.prepare(statement).run(params);
        }
      }
    } else {
      // 单个语句直接执行
      this.db.prepare(sql).run(params);
    }
  }
  
  public close(): void {
    this.db.close();
  }
  
  // 获取原始数据库实例（用于 Model 类）
  public getDB(): SQLiteDatabase {
    return this.db;
  }
}

export default DB;