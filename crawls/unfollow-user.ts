import { PlaywrightClient } from 'better-playwright-mcp';
import DB from '../best-x-web/lib/DB';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 取消关注指定的 Twitter/X 用户
 * @param username 要取消关注的用户名（不包含@）
 * @param serverUrl Playwright 服务器地址
 */
export async function unfollowUser(
  username: string,
  serverUrl: string = 'http://localhost:3103'
): Promise<boolean> {
  const client = new PlaywrightClient(serverUrl);
  
  try {
    console.log(`\n🚀 开始取消关注用户: @${username}`);
    
    // 1. 打开用户主页
    const url = `https://x.com/${username}`;
    console.log(`📖 打开用户主页: ${url}`);
    
    const { pageId } = await client.createPage(
      'unfollow',
      `Unfollow ${username}`,
      url,
      1500  // 等待页面加载
    );
    
    // 2. 跳过额外等待
    
    // 3. 查找取消关注按钮
    console.log(`🔍 查找取消关注按钮...`);
    
    // 使用 aria-label 选择器查找包含"取消关注"的按钮
    let unfollowButtonSelector = '[aria-label*="取消关注"]';
    
    try {
      // 等待按钮出现
      await client.waitForSelector(pageId, unfollowButtonSelector, { state: 'visible', timeout: 1500 });
      console.log(`✅ 找到取消关注按钮`);
    } catch {
      // 如果没找到 aria-label 按钮，尝试 data-testid
      unfollowButtonSelector = '[data-testid$="-unfollow"]';
      try {
        await client.waitForSelector(pageId, unfollowButtonSelector, { state: 'visible', timeout: 1500 });
        console.log(`✅ 找到取消关注按钮 (使用 data-testid)`);
      } catch {
        // 没找到取消关注按钮，可能用户未被关注
        console.log(`ℹ️ 未找到取消关注按钮，用户可能未被关注`);
        
        // 更新数据库标记为未关注
        try {
          const dbPath = path.join(__dirname, '../best-x-web/data/tweets.db');
          // @ts-ignore
          const DBClass = DB.DB || DB.default || DB;
          const db = DBClass.getInstance(dbPath);
          
          db.execute(
            `UPDATE twitter_users 
             SET unfollowed = 1, 
                 unfollowed_at = datetime('now') 
             WHERE handle = ?`,
            [`@${username}`]
          );
          
          console.log(`💾 已在数据库中标记用户 @${username} 为未关注状态`);
        } catch (dbError) {
          console.error(`⚠️ 更新数据库失败:`, dbError);
        }
        
        await client.closePage(pageId);
        return true;
      }
    }
    
    try {
      // 获取按钮的 HTML 以确认
      const buttonHtml = await client.getElementHTML(pageId, unfollowButtonSelector);
      console.log(`📋 按钮信息:`, typeof buttonHtml === 'string' ? buttonHtml.substring(0, 200) + '...' : buttonHtml);
      
      // 4. 点击取消关注按钮
      console.log(`👆 点击取消关注按钮...`);
      await client.browserClick(pageId, unfollowButtonSelector, 200);
      
      // 5. 处理确认对话框（如果有）
      console.log(`⏳ 检查确认对话框...`);
      // 不等待，直接查找确认框
      
      // 查找确认按钮 - 先尝试包含"取消关注"的span
      let confirmButtonSelector = 'span:has-text("取消关注")';
      
      try {
        await client.waitForSelector(pageId, confirmButtonSelector, { state: 'visible', timeout: 300 });
        console.log(`📋 发现确认对话框，点击取消关注...`);
        await client.browserClick(pageId, confirmButtonSelector, 200);
        console.log(`✅ 已点击确认按钮`);
      } catch (error) {
        // 尝试标准的确认按钮
        confirmButtonSelector = '[data-testid="confirmationSheetConfirm"]';
        try {
          await client.waitForSelector(pageId, confirmButtonSelector, { state: 'visible', timeout: 300 });
          console.log(`📋 发现标准确认对话框，点击确认...`);
          await client.browserClick(pageId, confirmButtonSelector, 200);
          console.log(`✅ 已点击确认按钮`);
        } catch {
          // 可能没有确认对话框，这是正常的
          console.log(`ℹ️ 没有确认对话框，直接取消关注`);
        }
      }
      
      // 6. 验证是否成功
      console.log(`⏳ 验证取消关注结果...`);
      await client.waitForTimeout(pageId, 300);
      
      // 检查按钮是否变为 "关注" 状态
      try {
        // 查找关注按钮（不是取消关注按钮）
        const followButtonSelector = '[data-testid$="-follow"]:not([data-testid$="-unfollow"])';
        await client.waitForSelector(pageId, followButtonSelector, { state: 'visible', timeout: 1000 });
        console.log(`✅ 成功取消关注 @${username}！`);
        
        // 更新数据库标记
        try {
          const dbPath = path.join(__dirname, '../best-x-web/data/tweets.db');
          // @ts-ignore
          const DBClass = DB.DB || DB.default || DB;
          const db = DBClass.getInstance(dbPath);
          
          db.execute(
            `UPDATE twitter_users 
             SET unfollowed = 1, 
                 unfollowed_at = datetime('now') 
             WHERE handle = ?`,
            [`@${username}`]
          );
          
          console.log(`💾 已在数据库中标记用户 @${username} 为已取消关注`);
        } catch (dbError) {
          console.error(`⚠️ 更新数据库失败:`, dbError);
          // 不影响取消关注的返回结果
        }
        
        await client.closePage(pageId);
        return true;
      } catch (error) {
        console.log(`⚠️ 未找到关注按钮，可能取消关注未成功`);
        
        await client.closePage(pageId);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ 操作失败:`, error);
      
      await client.closePage(pageId);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ 初始化失败:`, error);
    return false;
  }
}

/**
 * 批量取消关注多个用户
 * @param usernames 用户名列表
 * @param delay 每个操作之间的延迟（毫秒）
 */
export async function unfollowMultipleUsers(
  usernames: string[],
  delay: number = 3000
): Promise<{ success: string[], failed: string[] }> {
  const results = {
    success: [] as string[],
    failed: [] as string[]
  };
  
  console.log(`\n📋 准备取消关注 ${usernames.length} 个用户`);
  console.log(`⏱️ 每个操作间隔: ${delay}ms\n`);
  
  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    console.log(`\n[${i + 1}/${usernames.length}] 处理用户: @${username}`);
    console.log('─'.repeat(50));
    
    const success = await unfollowUser(username);
    
    if (success) {
      results.success.push(username);
    } else {
      results.failed.push(username);
    }
    
    // 如果不是最后一个，等待一段时间
    if (i < usernames.length - 1) {
      console.log(`\n⏳ 等待 ${delay}ms 后继续...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 取消关注总结:');
  console.log(`✅ 成功: ${results.success.length} 个`);
  if (results.success.length > 0) {
    console.log(`   ${results.success.join(', ')}`);
  }
  console.log(`❌ 失败: ${results.failed.length} 个`);
  if (results.failed.length > 0) {
    console.log(`   ${results.failed.join(', ')}`);
  }
  
  return results;
}

// 命令行支持
if (process.argv[2]) {
  const usernames = process.argv.slice(2);
  
  if (usernames.length === 1) {
    // 单个用户
    unfollowUser(usernames[0])
      .then(success => {
        if (success) {
          console.log('\n✨ 操作完成！');
          process.exit(0);
        } else {
          console.log('\n❌ 操作失败！');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('\n❌ 发生错误:', error);
        process.exit(1);
      });
  } else {
    // 多个用户
    unfollowMultipleUsers(usernames)
      .then(results => {
        console.log('\n✨ 批量操作完成！');
        process.exit(results.failed.length === 0 ? 0 : 1);
      })
      .catch(error => {
        console.error('\n❌ 发生错误:', error);
        process.exit(1);
      });
  }
} else {
  console.log('使用方法:');
  console.log('  取消关注单个用户: tsx unfollow-user.ts <username>');
  console.log('  批量取消关注: tsx unfollow-user.ts <username1> <username2> ...');
  console.log('\n示例:');
  console.log('  tsx unfollow-user.ts bitbird2014');
  console.log('  tsx unfollow-user.ts user1 user2 user3');
}