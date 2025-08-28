import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import type { FollowingsResult, FollowingUser } from '../types/following';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 从关注列表 JSON 文件导入用户到数据库
 */
function importTwitterUsers(jsonFile: string, dbPath: string = path.join(__dirname, '../best-x-web/data/tweets.db')) {
  // 1. 验证文件存在
  if (!fs.existsSync(jsonFile)) {
    console.error(`文件不存在: ${jsonFile}`);
    process.exit(1);
  }

  // 2. 读取 JSON 数据
  const jsonData = fs.readFileSync(jsonFile, 'utf-8');
  const result: FollowingsResult = JSON.parse(jsonData);
  
  console.log(`读取到 ${result.users.length} 个用户`);

  // 3. 连接数据库
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 4. 准备 SQL 语句
  const upsertUser = db.prepare(`
    INSERT INTO twitter_users (
      user_id, username, handle, display_name,
      bio, avatar_url, profile_url,
      is_verified, is_organization
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      handle = excluded.handle,
      display_name = excluded.display_name,
      bio = excluded.bio,
      avatar_url = excluded.avatar_url,
      is_verified = excluded.is_verified,
      is_organization = excluded.is_organization,
      updated_at = CURRENT_TIMESTAMP
  `);

  // 5. 使用事务批量导入
  const importMany = db.transaction((users: FollowingUser[]) => {
    let inserted = 0;
    let updated = 0;
    
    for (const user of users) {
      const info = upsertUser.run(
        user.userId,
        user.username,
        user.handle,
        user.displayName || null,
        user.bio || null,
        user.avatarUrl || null,
        user.profileUrl || null,
        user.isVerified ? 1 : 0,
        user.isOrganization ? 1 : 0
      );
      
      // 判断是插入还是更新
      if (info.changes === 1) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    return { inserted, updated };
  });

  // 6. 执行导入
  console.log('开始导入...');
  const stats = importMany(result.users);
  
  // 7. 统计信息
  console.log(`导入完成:
  - 新增用户: ${stats.inserted}
  - 更新用户: ${stats.updated}
  - 总处理数: ${result.users.length}`);

  // 8. 查询验证
  const count = db.prepare('SELECT COUNT(*) as count FROM twitter_users').get() as { count: number };
  console.log(`数据库中总用户数: ${count.count}`);

  // 9. 关闭数据库
  db.close();
}

// 命令行支持
if (process.argv[2]) {
  const jsonFile = process.argv[2];
  const dbPath = process.argv[3];
  
  console.log(`导入文件: ${jsonFile}`);
  if (dbPath) {
    console.log(`数据库: ${dbPath}`);
  }
  
  importTwitterUsers(jsonFile, dbPath);
} else {
  console.log(`用法: tsx import-twitter-users.ts <json文件> [数据库路径]
示例: tsx import-twitter-users.ts /tmp/followings-livoras-1756311782861.json`);
  process.exit(1);
}

export { importTwitterUsers };