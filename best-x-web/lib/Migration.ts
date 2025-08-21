import { DB } from './DB';

// 迁移脚本的类型定义
export interface MigrationScript {
  name: string;
  up: string | string[];  // 支持单个语句或语句数组
  down: string;
}

export class Migration {
  private db: DB;
  private readonly MIGRATION_TABLE = 'migrations';

  constructor(db: DB) {
    this.db = db;
  }

  // 初始化迁移表
  public async init(): Promise<void> {
    const tableExists = await this.checkTableExists();
    if (tableExists) {
      return;
    }

    this.db.execute(`
      CREATE TABLE ${this.MIGRATION_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // 执行迁移
  public async apply(migrations: MigrationScript[]): Promise<void> {
    await this.init();
    
    // 获取已执行的迁移
    const appliedMigrations = this.db.query<{ name: string }>(
      `SELECT name FROM ${this.MIGRATION_TABLE} ORDER BY id`
    );
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    // 按顺序执行未执行的迁移
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        console.log(`Migration ${migration.name} already applied`);
        continue;
      }
      console.log(`Applying migration: ${migration.name}`);

      this.db.beginTransaction();
      
      try {
        // 执行迁移中的每个语句
        const statements = Array.isArray(migration.up) ? migration.up : [migration.up];
        for (const statement of statements) {
          if (statement.trim()) {
            this.db.execute(statement);
          }
        }
        
        // 记录迁移
        this.db.execute(
          `INSERT INTO ${this.MIGRATION_TABLE} (name) VALUES (?)`,
          [migration.name]
        );
        
        this.db.commit();
        console.log(`Applied migration: ${migration.name}`);
      } catch (error) {
        this.db.rollback();
        console.error(`Failed to apply migration ${migration.name}:`, error);
        throw error;
      }
    }
  }

  // 检查表是否存在
  private async checkTableExists(): Promise<boolean> {
    const result = this.db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [this.MIGRATION_TABLE]
    );
    return result.length > 0;
  }
} 