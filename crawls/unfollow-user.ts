import { PlaywrightClient } from 'better-playwright-mcp';
import DB from '../best-x-web/lib/DB';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

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
      3000  // 等待页面加载
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
        // 没找到取消关注按钮，需要进一步验证
        console.log(`⚠️ 未找到取消关注按钮，检查是否已经未关注...`);
        
        // 检查是否存在follow按钮（不是unfollow）
        try {
          const followButtonSelector = '[data-testid$="-follow"]';
          await client.waitForSelector(pageId, followButtonSelector, { state: 'visible', timeout: 3000 });
          const buttonHtml = await client.getElementHTML(pageId, followButtonSelector);
          console.log(`🔍 找到按钮，检查类型...`);
          
          if (!buttonHtml.includes('-unfollow"')) {
            // 确实是follow按钮，用户已经未关注
            console.log(`✅ 找到关注按钮，用户已处于未关注状态`);
            
            // 更新数据库
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
          } else {
            // 找到的是unfollow按钮，但之前没检测到，可能是加载问题
            console.log(`❌ 检测到unfollow按钮，用户仍在关注中`);
            await client.closePage(pageId);
            return false;
          }
        } catch {
          // 完全找不到任何按钮
          console.log(`❌ 无法确定关注状态，不更新数据库`);
          await client.closePage(pageId);
          return false;
        }
      }
    }
    
    try {
      // 获取按钮的 HTML 以确认
      const buttonHtml = await client.getElementHTML(pageId, unfollowButtonSelector);
      console.log(`📋 按钮信息:`, typeof buttonHtml === 'string' ? buttonHtml.substring(0, 200) + '...' : buttonHtml);
      
      // 4. 点击取消关注按钮
      console.log(`👆 点击取消关注按钮...`);
      await client.browserClick(pageId, unfollowButtonSelector, 1000);
      
      // 5. 处理确认对话框（如果有）
      console.log(`⏳ 检查确认对话框...`);
      
      // 查找确认按钮 - 优先使用标准确认按钮
      const confirmSelectors = [
        '[data-testid="confirmationSheetConfirm"]',
        'span:has-text("取消关注")'
      ];
      
      let confirmFound = false;
      for (const selector of confirmSelectors) {
        try {
          await client.waitForSelector(pageId, selector, { state: 'visible', timeout: 1000 });
          console.log(`📋 发现确认对话框，点击确认...`);
          await client.browserClick(pageId, selector, 1000);
          console.log(`✅ 已点击确认按钮`);
          confirmFound = true;
          break;
        } catch {
          // 继续尝试下一个选择器
        }
      }
      
      if (!confirmFound) {
        console.log(`ℹ️ 没有确认对话框，直接取消关注`);
      }
      
      // 6. 验证是否成功
      console.log(`⏳ 验证取消关注结果...`);
      await client.waitForTimeout(pageId, 3000);
      
      // 检查按钮状态 - 使用和debug-unfollow.ts相同的方法
      let isUnfollowed = false;
      
      // 保存页面HTML并检查
      const htmlFile = await client.pageToHtmlFile(pageId, false);
      const htmlContent = fs.readFileSync(htmlFile.filePath, 'utf-8');
      
      // 检查按钮状态 - 与debug脚本相同的正则匹配
      const unfollowMatch = htmlContent.match(/data-testid="\d+-unfollow"/);
      const followMatch = htmlContent.match(/data-testid="\d+-follow"(?!-)/);
      
      if (!unfollowMatch && followMatch) {
        // 没有unfollow按钮，但有follow按钮 = 成功
        isUnfollowed = true;
        console.log(`✅ 检测到follow按钮，已取消关注`);
      } else if (unfollowMatch) {
        // 仍有unfollow按钮 = 失败
        isUnfollowed = false;
        console.log(`❌ 仍存在 unfollow 按钮，取消关注失败`);
      } else {
        // 没有找到任何按钮，再检查一次
        console.log(`⚠️ 未找到任何按钮，再等待检查...`);
        await client.waitForTimeout(pageId, 2000);
        
        try {
          const anyButtonSelector = '[data-testid$="-follow"]';
          const buttonHtml = await client.getElementHTML(pageId, anyButtonSelector);
          
          if (buttonHtml.includes('-unfollow"')) {
            isUnfollowed = false;
            console.log(`❌ 最终检查：仍在关注状态`);
          } else {
            isUnfollowed = true;
            console.log(`✅ 最终检查：已取消关注`);
          }
        } catch {
          // 真的找不到按钮
          isUnfollowed = false;
          console.log(`⚠️ 未找到任何关注按钮`);
        }
      }
      
      if (isUnfollowed) {
        console.log(`✅ 成功取消关注 @${username}！`);
        
        // 只有确认成功才更新数据库
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
        }
        
        await client.closePage(pageId);
        return true;
      } else {
        console.log(`❌ 取消关注失败！页面仍显示"正在关注"状态`);
        console.log(`⚠️ 未更新数据库，@${username} 仍在关注列表中`);
        
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
  const usernames = process.argv.slice(2).map(u => u.replace(/^@/, '')); // 移除开头的@符号
  
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