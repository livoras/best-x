// 标签中英文映射 - 用于前端显示
export const TAG_MAPPING: Record<string, string> = {
  // 内容形式
  'thread': '连续长推',
  'discussion': '讨论对话',
  'announcement': '公告发布',
  'sharing': '分享推荐',
  'tutorial': '教程指南',
  'analysis': '深度分析',
  'news_update': '新闻速报',
  'personal_story': '个人故事',
  
  // 内容领域
  'tech': '科技数码',
  'business': '商业财经',
  'culture': '文化艺术',
  'lifestyle': '生活方式',
  'politics': '政治时事',
  'science': '科学研究',
  'entertainment': '娱乐八卦',
  'sports': '体育运动',
  'education': '教育学习',
  'health': '健康医疗',
  'crypto': '加密货币',
  'gaming': '游戏电竞',
  
  // 内容价值
  'informative': '信息价值',
  'educational': '学习价值',
  'entertaining': '娱乐价值',
  'inspirational': '启发价值',
  'practical': '实用价值',
  
  // 观点立场
  'objective': '客观中立',
  'supportive': '支持赞同',
  'critical': '批判质疑',
  'humorous': '幽默讽刺',
  'promotional': '推广宣传',
  
  // 内容特征
  'viral': '病毒传播',
  'breaking': '突发新闻',
  'verified': '官方认证',
  'with_media': '包含媒体',
  'with_links': '包含链接',
  'controversial': '争议话题'
};

// 获取标签的中文名称
export function getTagLabel(tagKey: string): string {
  return TAG_MAPPING[tagKey] || tagKey;
}