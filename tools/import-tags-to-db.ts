import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径
const dbPath = path.join(__dirname, '../best-x-web/data/tweets.db');
const db = new Database(dbPath);

interface TagData {
  [userId: string]: string[];
}

async function importTags() {
  console.log('开始导入标签数据...\n');
  
  // 获取所有标签文件
  const tmpDir = '/tmp';
  const tagFiles = fs.readdirSync(tmpDir)
    .filter(f => f.endsWith('-tags.json'))
    .sort();
  
  console.log(`找到 ${tagFiles.length} 个标签文件\n`);
  
  // 准备更新语句
  const updateStmt = db.prepare(`
    UPDATE twitter_users 
    SET tags = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);
  
  let totalUpdated = 0;
  let totalFailed = 0;
  const failedUsers: string[] = [];
  
  // 开始事务
  const updateAll = db.transaction(() => {
    for (const file of tagFiles) {
      const filePath = path.join(tmpDir, file);
      console.log(`处理文件: ${file}`);
      
      // 读取标签数据
      const content = fs.readFileSync(filePath, 'utf-8');
      const tags: TagData = JSON.parse(content);
      
      let fileUpdated = 0;
      let fileFailed = 0;
      
      // 更新每个用户的标签
      for (const [userId, userTags] of Object.entries(tags)) {
        try {
          const result = updateStmt.run(JSON.stringify(userTags), userId);
          if (result.changes > 0) {
            fileUpdated++;
            totalUpdated++;
          } else {
            // 用户不存在于数据库
            fileFailed++;
            totalFailed++;
            failedUsers.push(userId);
          }
        } catch (error) {
          console.error(`  更新用户 ${userId} 失败:`, error);
          fileFailed++;
          totalFailed++;
          failedUsers.push(userId);
        }
      }
      
      console.log(`  ✅ 成功更新 ${fileUpdated} 个用户`);
      if (fileFailed > 0) {
        console.log(`  ⚠️  失败 ${fileFailed} 个用户`);
      }
    }
  });
  
  try {
    updateAll();
    console.log('\n=== 导入完成 ===');
    console.log(`✅ 成功更新: ${totalUpdated} 个用户`);
    
    if (totalFailed > 0) {
      console.log(`⚠️  失败: ${totalFailed} 个用户`);
      console.log('失败的用户 ID (前10个):');
      failedUsers.slice(0, 10).forEach(id => console.log(`  - ${id}`));
      if (failedUsers.length > 10) {
        console.log(`  ... 还有 ${failedUsers.length - 10} 个`);
      }
    }
    
    // 验证结果
    console.log('\n=== 验证结果 ===');
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM twitter_users').get() as { count: number };
    const taggedUsers = db.prepare('SELECT COUNT(*) as count FROM twitter_users WHERE tags IS NOT NULL').get() as { count: number };
    
    console.log(`数据库总用户数: ${totalUsers.count}`);
    console.log(`已标记用户数: ${taggedUsers.count}`);
    
    // 统计各标签数量
    console.log('\n=== 标签统计 ===');
    const allTags = db.prepare('SELECT tags FROM twitter_users WHERE tags IS NOT NULL').all() as { tags: string }[];
    
    const tagCounts: Record<string, number> = {};
    allTags.forEach(row => {
      const tags = JSON.parse(row.tags) as string[];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count} 个用户`);
      });
    
  } catch (error) {
    console.error('导入失败:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// 执行导入
importTags().catch(console.error);