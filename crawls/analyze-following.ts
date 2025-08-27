import * as fs from 'fs';
import * as cheerio from 'cheerio';

// 分析关注列表页面结构
function analyzeFollowingPage(filePath: string) {
  console.log('分析文件:', filePath);
  
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);
  
  console.log('\n=== 页面基本信息 ===');
  console.log('文件大小:', (html.length / 1024).toFixed(2), 'KB');
  console.log('标题:', $('title').text());
  
  console.log('\n=== 用户卡片分析 ===');
  // 查找所有包含用户信息的容器
  const userCells = $('[data-testid="UserCell"]');
  console.log('UserCell 数量:', userCells.length);
  
  // 查找关注/取消关注按钮
  const followButtons = $('[data-testid$="-follow"], [data-testid$="-unfollow"]');
  console.log('关注按钮数量:', followButtons.length);
  
  // 提取用户信息
  console.log('\n=== 用户列表 ===');
  const users: any[] = [];
  
  // 查找包含用户链接的 a 标签
  $('a[href^="/"][role="link"]').each((i, el) => {
    const href = $(el).attr('href');
    // 过滤出用户主页链接（不包含 /status、/following 等）
    if (href && /^\/[a-zA-Z0-9_]+$/.test(href) && !href.includes('/i/')) {
      const username = href.substring(1);
      const parent = $(el).parent().parent();
      const texts = parent.find('span').map((_, span) => $(span).text()).get();
      
      if (texts.length > 0 && !users.find(u => u.username === username)) {
        users.push({
          username,
          displayName: texts[0],
          handle: '@' + username
        });
      }
    }
  });
  
  console.log('找到用户数:', users.length);
  users.slice(0, 10).forEach(user => {
    console.log(`- ${user.displayName} (${user.handle})`);
  });
  
  console.log('\n=== 页面结构特征 ===');
  // 查找主要容器
  const mainContent = $('[aria-label*="Timeline"]');
  console.log('Timeline 容器:', mainContent.length > 0 ? '找到' : '未找到');
  
  const sections = $('section');
  console.log('Section 数量:', sections.length);
  
  // 查找无限滚动相关元素
  const scrollElements = $('[style*="position: absolute"]');
  console.log('绝对定位元素数量:', scrollElements.length, '(可能用于虚拟滚动)');
  
  console.log('\n=== 数据属性统计 ===');
  const dataTestIds = new Set<string>();
  $('[data-testid]').each((i, el) => {
    const testId = $(el).attr('data-testid');
    if (testId) dataTestIds.add(testId);
  });
  
  console.log('不同的 data-testid 数量:', dataTestIds.size);
  console.log('部分 data-testid:');
  Array.from(dataTestIds).slice(0, 20).forEach(id => {
    console.log('  -', id);
  });
}

// 命令行执行
if (process.argv[2]) {
  analyzeFollowingPage(process.argv[2]);
} else {
  // 查找最新的 following 文件
  const files = fs.readdirSync('/tmp').filter(f => f.startsWith('following-'));
  if (files.length > 0) {
    const latest = files.sort().pop();
    analyzeFollowingPage(`/tmp/${latest}`);
  } else {
    console.log('未找到关注列表文件');
  }
}