-- 单表存储 X/Twitter 推文提取数据

CREATE TABLE IF NOT EXISTS extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- URL 信息
  url TEXT NOT NULL,
  
  -- 主推文作者信息
  author_name TEXT,
  author_handle TEXT,
  
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
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_extract_time ON extractions(extract_time DESC);
CREATE INDEX IF NOT EXISTS idx_post_date ON extractions(post_date DESC);
CREATE INDEX IF NOT EXISTS idx_author_handle ON extractions(author_handle);
CREATE INDEX IF NOT EXISTS idx_url ON extractions(url);