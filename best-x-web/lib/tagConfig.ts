// 预定义标签配置
export const PREDEFINED_TAGS = {
  // 内容类型标签
  content_types: {
    'tech_share': '技术分享',
    'news': '新闻资讯',
    'tutorial': '教程指南',
    'opinion': '观点评论',
    'announcement': '产品发布',
    'discussion': '讨论交流',
    'resource': '资源分享',
    'case_study': '案例分析'
  },
  
  // 技术领域标签
  tech_domains: {
    'ai_ml': 'AI/机器学习',
    'frontend': '前端开发',
    'backend': '后端开发',
    'devops': 'DevOps',
    'database': '数据库',
    'security': '安全',
    'blockchain': '区块链',
    'mobile': '移动开发',
    'cloud': '云计算',
    'data_science': '数据科学'
  },
  
  // 内容深度标签
  depth: {
    'beginner': '入门级',
    'intermediate': '进阶',
    'advanced': '高级',
    'expert': '专家级'
  },
  
  // 情感倾向标签
  sentiment: {
    'positive': '积极正面',
    'negative': '消极负面',
    'neutral': '中立客观',
    'controversial': '争议性'
  },
  
  // 内容特征标签
  features: {
    'with_code': '包含代码',
    'with_demo': '包含演示',
    'with_data': '包含数据',
    'breaking_news': '突发新闻',
    'trending': '热门话题'
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
  
  for (const [categoryKey, tags] of Object.entries(PREDEFINED_TAGS)) {
    const categoryName = categoryKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    const tagList = Object.entries(tags)
      .map(([key, label]) => `  - ${key}: ${label}`)
      .join('\n');
    
    categories.push(`【${categoryName}】\n${tagList}`);
  }
  
  return categories.join('\n\n');
}