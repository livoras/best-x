import { ScraperBase, cheerio, ScrapeOptions } from '../lib/scraper-base';
import type { FollowingUser, FollowingsResult } from '../types/following';
import * as fs from 'fs';

/**
 * 关注列表爬虫（使用通用基类实现）
 */
class FollowingScraper extends ScraperBase<FollowingUser, FollowingsResult> {
  private username: string;
  
  constructor(username: string, serverUrl?: string) {
    super(serverUrl);
    this.username = username;
  }
  
  /**
   * 从HTML中提取用户信息
   */
  extractItems(html: string): FollowingUser[] {
    const $ = cheerio.load(html);
    const users: FollowingUser[] = [];
    
    // 查找所有 cellInnerDiv（这是包含用户信息的容器）
    const cellInnerDivs = $('[data-testid="cellInnerDiv"]');
    
    // 调试：记录找到的容器数量
    console.log(`    🔍 DEBUG: 找到 ${cellInnerDivs.length} 个 cellInnerDiv`);
    
    cellInnerDivs.each((index, element) => {
      const container = $(element);
      
      // 从 UserCell 容器中查找关注按钮
      const followButton = container.find('[data-testid$="-follow"], [data-testid$="-unfollow"]').first();
      
      if (!followButton.length) return;
      
      const followTestId = followButton.attr('data-testid') || '';
      const isFollowing = followTestId.endsWith('-unfollow');
      const userId = followTestId.replace(/-(un)?follow$/, '');
      
      // 提取用户名和链接
      const profileLinks = container.find('a[href^="/"][role="link"]');
      let username = '';
      let profileUrl = '';
      
      profileLinks.each((_, el) => {
        const href = $(el).attr('href') || '';
        if (/^\/[a-zA-Z0-9_]+$/.test(href) && !href.includes('/i/')) {
          username = href.substring(1);
          profileUrl = href;
          return false;
        }
      });
      
      if (!username) return;
      
      // 提取显示名称
      let displayName = '';
      const nameLink = container.find(`a[href="/${username}"]`).first();
      
      if (nameLink.length > 0) {
        const linkText = nameLink.find('span').first().text().trim();
        if (linkText && !linkText.startsWith('@')) {
          displayName = linkText;
        } else {
          const parentDiv = nameLink.parent();
          const spans = parentDiv.find('span');
          spans.each((_, el) => {
            const text = $(el).text().trim();
            if (text && !text.startsWith('@') && !displayName) {
              displayName = text;
              return false;
            }
          });
        }
      }
      
      // 如果还没找到，在容器中查找
      if (!displayName) {
        const allSpans = container.find('span');
        allSpans.each((_, el) => {
          const text = $(el).text().trim();
          if (text && !text.startsWith('@') && 
              text !== '关注' && text !== 'Following' && 
              text !== 'Follow' && text !== '正在关注' &&
              !displayName) {
            displayName = text;
            return false;
          }
        });
      }
      
      // 提取个人简介
      // 基于结构分析：Bio是容器中第二个 div[dir="auto"] 元素
      let bio = '';
      
      const allDivs = container.find('div[dir="auto"]');
      console.log(`        🔍 DEBUG [${username}]: 找到 ${allDivs.length} 个 div[dir="auto"]`);
      
      // 如果有至少2个 dir="auto" 元素，第二个是bio
      if (allDivs.length >= 2) {
        bio = $(allDivs[1]).text().trim();
        console.log(`        ✅ DEBUG [${username}]: Bio 提取成功: "${bio.substring(0, 80)}..."`);
      } else {
        console.log(`        ❌ DEBUG [${username}]: 容器中少于2个 div[dir="auto"]，无法提取bio`);
      }
      
      // 提取头像URL
      const avatarImg = container.find('img').filter((_, el) => {
        const src = $(el).attr('src') || '';
        return src.includes('profile_images') || src.includes('pbs.twimg.com');
      }).first();
      const avatarUrl = avatarImg.attr('src') || '';
      
      // 提取认证状态
      const verifiedBadge = container.find('svg[data-testid="icon-verified"], svg[aria-label*="认证"]');
      const isVerified = verifiedBadge.length > 0;
      // 检查是否为组织认证（金色徽章通常有linearGradient）
      // 注意：需要获取SVG的HTML内容来检查是否包含linearGradient
      let isOrganization = false;
      if (isVerified) {
        const svgHtml = verifiedBadge.html() || '';
        isOrganization = svgHtml.includes('linearGradient');
      }
      
      users.push({
        userId,
        username,
        handle: `@${username}`,
        displayName: displayName || username,
        bio,
        avatarUrl,
        profileUrl,
        isVerified,
        isOrganization,
        isFollowing,
        followButtonTestId: followTestId
      });
    });
    
    console.log(`    🔍 DEBUG: 成功提取 ${users.length} 个用户`);
    
    return users;
  }
  
  /**
   * 获取用户的唯一标识符
   */
  getItemId(user: FollowingUser): string {
    return user.userId;
  }
  
  /**
   * 构建最终返回结果
   */
  buildResult(): FollowingsResult {
    const items = this.getItems();
    
    // 分类用户：互相关注 vs 单向关注
    const mainUserFollowings = items.filter(u => u.isFollowing);
    const oneWayFollowings = items.filter(u => !u.isFollowing);
    
    // 统计信息
    const verifiedCount = items.filter(u => u.isVerified).length;
    
    console.log(`\n📊 分类统计:`);
    console.log(`  - 互相关注: ${mainUserFollowings.length} 个`);
    console.log(`  - 单向关注: ${oneWayFollowings.length} 个`);
    console.log(`  - 认证用户: ${verifiedCount} 个`);
    
    return {
      url: this.url || '',
      username: this.username,
      htmlFile: '', // 如果需要可以在基类中暴露
      usersFile: '', // 如果需要可以保存到文件
      users: items,
      mainUserFollowings,
      oneWayFollowings,
      count: items.length,
      hasMore: items.length > 0,
      extractedAt: new Date().toISOString()
    };
  }
  
  /**
   * 覆盖收集钩子以提供详细日志
   */
  protected onItemCollected(user: FollowingUser, id: string): void {
    console.log(`    ✅ 新用户: ${user.displayName} (${user.handle})`);
  }
  
  protected onDuplicateItem(user: FollowingUser, id: string): void {
    // 调试：记录重复项
    console.log(`    ⏭️  DEBUG: 重复用户 ${id}`);
  }
}

/**
 * 导出便捷函数
 */
export async function getFollowings(
  username: string, 
  options?: ScrapeOptions
): Promise<FollowingsResult> {
  const scraper = new FollowingScraper(username);
  const url = `https://x.com/${username}/following`;
  return scraper.scrape(url, options);
}

// 命令行支持
if (process.argv[2]) {
  const username = process.argv[2];
  const scrollTimes = parseInt(process.argv[3]) || 10;
  const maxUsers = process.argv[4] ? parseInt(process.argv[4]) : undefined;
  
  // 创建日志文件
  const logFile = `/tmp/followings-${username}-${Date.now()}.log`;
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  // 重定向 console.log 到文件
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    originalLog(message);  // 同时输出到控制台
    logStream.write(message + '\n');  // 写入文件
  };
  
  console.log(`\n🚀 获取关注列表: @${username}`);
  console.log(`   配置: 滚动${scrollTimes}次${maxUsers ? `，最多${maxUsers}个用户` : ''}`);
  console.log(`   日志文件: ${logFile}\n`);
  
  getFollowings(username, { scrollTimes, maxUsers })
    .then(result => {
      console.log('\n✨ 完成！');
      console.log(`📊 提取了 ${result.count} 个用户`);
      
      // 输出摘要
      console.log('\n互相关注的用户:');
      result.mainUserFollowings.slice(0, 5).forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.displayName} (${user.handle})${user.isVerified ? ' ✓' : ''}`);
      });
      if (result.mainUserFollowings.length > 5) {
        console.log(`  ... 还有 ${result.mainUserFollowings.length - 5} 个`);
      }
      
      console.log('\n单向关注的用户:');
      result.oneWayFollowings.slice(0, 5).forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.displayName} (${user.handle})${user.isVerified ? ' ✓' : ''}`);
      });
      if (result.oneWayFollowings.length > 5) {
        console.log(`  ... 还有 ${result.oneWayFollowings.length - 5} 个`);
      }
      
      // 保存结果到JSON文件
      const resultFile = `/tmp/followings-${username}-${Date.now()}.json`;
      fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
      console.log(`\n📁 结果已保存到: ${resultFile}`);
      
      logStream.end();
      process.exit(0);
    })
    .catch(error => {
      console.error('错误:', error.message);
      logStream.end();
      process.exit(1);
    });
}