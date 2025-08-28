import { MigrationScript } from './Migration';

const migrations: MigrationScript[] = [
  {
    name: '001_create_extractions_table',
    up: `
      CREATE TABLE IF NOT EXISTS extractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- URL 信息
        url TEXT NOT NULL,
        
        -- 主推文作者信息
        author_name TEXT,
        author_handle TEXT,
        author_avatar TEXT,
        
        -- 提取统计
        tweet_count INTEGER,
        scroll_times INTEGER,
        filtered_count INTEGER,
        
        -- 主推文内容预览（用于搜索和显示）
        main_tweet_text TEXT,
        
        -- 时间信息
        post_time TEXT,                              -- 原始时间格式
        post_date DATE,                              -- 解析后的日期（方便查询）
        extract_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 完整数据（JSON）
        data TEXT NOT NULL
      )
    `,
    down: 'DROP TABLE IF EXISTS extractions'
  },
  {
    name: '002_create_extractions_indexes',
    up: [
      'CREATE INDEX IF NOT EXISTS idx_extract_time ON extractions(extract_time DESC)',
      'CREATE INDEX IF NOT EXISTS idx_post_date ON extractions(post_date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_author_handle ON extractions(author_handle)',
      'CREATE INDEX IF NOT EXISTS idx_url ON extractions(url)'
    ],
    down: [
      'DROP INDEX IF EXISTS idx_extract_time',
      'DROP INDEX IF EXISTS idx_post_date',
      'DROP INDEX IF EXISTS idx_author_handle',
      'DROP INDEX IF EXISTS idx_url'
    ]
  },
  {
    name: '003_create_task_queue_table',
    up: `
      CREATE TABLE IF NOT EXISTS task_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- 任务标识
        task_id TEXT UNIQUE NOT NULL,
        
        -- 任务参数
        url TEXT NOT NULL,
        scroll_times INTEGER DEFAULT 3,
        
        -- 任务状态: pending, processing, completed, failed, cancelled
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER DEFAULT 0,  -- 数字越小越优先
        
        -- 执行信息
        retry_count INTEGER DEFAULT 0,
        worker_id TEXT,  -- 处理器标识
        
        -- 进度信息
        progress INTEGER DEFAULT 0,  -- 进度百分比 0-100
        progress_message TEXT,  -- 进度描述
        
        -- 时间信息
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        
        -- 结果信息
        error_message TEXT,
        result_id INTEGER,  -- 关联到 extractions 表的 id
        
        -- 用户信息（可选）
        user_id TEXT
      )
    `,
    down: 'DROP TABLE IF EXISTS task_queue'
  },
  {
    name: '004_create_task_queue_indexes',
    up: [
      'CREATE INDEX IF NOT EXISTS idx_task_status ON task_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_task_priority ON task_queue(priority, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_task_id ON task_queue(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_created ON task_queue(created_at DESC)'
    ],
    down: [
      'DROP INDEX IF EXISTS idx_task_status',
      'DROP INDEX IF EXISTS idx_task_priority',
      'DROP INDEX IF EXISTS idx_task_id',
      'DROP INDEX IF EXISTS idx_task_created'
    ]
  },
  {
    name: '008_add_params_to_task_queue',
    up: [
      // 添加 params 列存储 JSON 格式的参数（type 列已经存在）
      "ALTER TABLE task_queue ADD COLUMN params TEXT",
      // 将现有的 url 和 scroll_times 迁移到 params
      `UPDATE task_queue 
       SET params = json_object('url', url, 'scrollTimes', scroll_times) 
       WHERE type = 'extract' AND url IS NOT NULL`
    ],
    down: [
      // SQLite 不支持 DROP COLUMN，需要重建表
      // 注意：这里简化了回滚，实际生产环境需要更复杂的处理
    ]
  },
  {
    name: '009_create_twitter_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS twitter_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- 用户唯一标识
        user_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        
        -- 用户基础信息
        handle TEXT NOT NULL,
        display_name TEXT,
        
        -- 个人资料
        bio TEXT,
        avatar_url TEXT,
        profile_url TEXT,
        
        -- 认证状态
        is_verified BOOLEAN DEFAULT 0,
        is_organization BOOLEAN DEFAULT 0,
        
        -- 时间戳
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    down: 'DROP TABLE IF EXISTS twitter_users'
  },
  {
    name: '010_create_twitter_users_indexes',
    up: [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_id ON twitter_users(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_username ON twitter_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_verified ON twitter_users(is_verified)',
      'CREATE INDEX IF NOT EXISTS idx_organization ON twitter_users(is_organization)'
    ],
    down: [
      'DROP INDEX IF EXISTS idx_user_id',
      'DROP INDEX IF EXISTS idx_username',
      'DROP INDEX IF EXISTS idx_verified',
      'DROP INDEX IF EXISTS idx_organization'
    ]
  },
  {
    name: '011_add_tags_to_twitter_users',
    up: `
      ALTER TABLE twitter_users 
      ADD COLUMN tags TEXT DEFAULT NULL
    `,
    down: `
      -- SQLite 不支持 DROP COLUMN，需要重建表
      -- 这里简化了回滚
    `
  },
  {
    name: '012_create_twitter_users_tags_index',
    up: 'CREATE INDEX IF NOT EXISTS idx_tags ON twitter_users(tags)',
    down: 'DROP INDEX IF EXISTS idx_tags'
  },
  {
    name: '013_add_unfollowed_to_twitter_users',
    up: `
      ALTER TABLE twitter_users 
      ADD COLUMN unfollowed BOOLEAN DEFAULT 0
    `,
    down: `
      -- SQLite 不支持 DROP COLUMN，需要重建表
      -- 这里简化了回滚
    `
  },
  {
    name: '014_add_unfollowed_at_to_twitter_users',
    up: `
      ALTER TABLE twitter_users 
      ADD COLUMN unfollowed_at DATETIME DEFAULT NULL
    `,
    down: `
      -- SQLite 不支持 DROP COLUMN，需要重建表
      -- 这里简化了回滚
    `
  }
];

export { migrations };
