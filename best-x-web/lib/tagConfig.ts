// 预定义标签配置 - 通用版本，适用于各领域内容
export const PREDEFINED_TAGS = {
  // 内容形式（8个）- 描述内容的呈现方式
  content_form: {
    'thread': '连续长推',
    'discussion': '讨论对话',
    'announcement': '公告发布',
    'sharing': '分享推荐',
    'tutorial': '教程指南',
    'analysis': '深度分析',
    'news_update': '新闻速报',
    'personal_story': '个人故事'
  },
  
  // 内容领域（12个）- 平衡各个领域
  domain: {
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
    'gaming': '游戏电竞'
  },
  
  // 内容价值（5个）- 对读者的价值
  value: {
    'informative': '信息价值',
    'educational': '学习价值',
    'entertaining': '娱乐价值',
    'inspirational': '启发价值',
    'practical': '实用价值'
  },
  
  // 观点立场（5个）- 内容的态度倾向
  stance: {
    'objective': '客观中立',
    'supportive': '支持赞同',
    'critical': '批判质疑',
    'humorous': '幽默讽刺',
    'promotional': '推广宣传'
  },
  
  // 内容特征（6个）- 特殊标记
  features: {
    'viral': '病毒传播',
    'breaking': '突发新闻',
    'verified': '官方认证',
    'with_media': '包含媒体',
    'with_links': '包含链接',
    'controversial': '争议话题'
  }
};

// 获取所有标签的平面列表
export function getAllTags(): Record<string, string> {
  const allTags: Record<string, string> = {};
  
  Object.values(PREDEFINED_TAGS).forEach(category => {
    Object.assign(allTags, category);
  });
  
  return allTags;
}

// 格式化标签用于 prompt
export function formatTagsForPrompt(): string {
  const categories = [];
  
  const categoryNames: Record<string, string> = {
    'content_form': '内容形式',
    'domain': '内容领域',
    'value': '内容价值',
    'stance': '观点立场',
    'features': '内容特征'
  };
  
  for (const [categoryKey, tags] of Object.entries(PREDEFINED_TAGS)) {
    const categoryName = categoryNames[categoryKey] || categoryKey;
    
    const tagList = Object.entries(tags)
      .map(([key, label]) => `  - ${key}: ${label}`)
      .join('\n');
    
    categories.push(`【${categoryName}】\n${tagList}`);
  }
  
  return categories.join('\n\n');
}