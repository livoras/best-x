/**
 * X (Twitter) 推文数据结构定义
 */

/**
 * 媒体项接口 - 统一表示图片和视频
 */
export interface MediaItem {
  type: 'image' | 'video';   // 媒体类型
  url?: string;               // 图片URL（仅image类型）
  thumbnail?: string;         // 视频缩略图（仅video类型）
  position?: number;          // 原始DOM中的位置（用于排序）
}

export interface Tweet {
  // 作者信息
  author: {
    name: string;           // 显示名称 (e.g., "Shruti")
    handle: string;         // 用户名 (e.g., "@heyshrutimishra")
    avatar: string;         // 头像URL
  };
  
  // 内容信息
  content: {
    text: string;           // 推文正文HTML（保留链接、@提及、#标签等结构）
    hasMore: boolean;       // 是否有"显示更多"按钮（内容被截断）
  };
  
  // 媒体内容
  media: {
    items: MediaItem[];     // 按原始顺序存储的媒体项
  };
  
  // Twitter Card（链接预览卡片）
  card?: {
    url: string;            // 卡片链接
    title: string;          // 卡片标题
    description?: string;   // 卡片描述
    image?: string;         // 预览图片URL
    domain?: string;        // 来源域名
  } | null;
  
  // 时间
  time: string;             // 显示时间 (e.g., "8月1日" 或 "下午6:39 · 2025年8月1日")
  
  // 推文链接
  statusLink: string;       // 推文状态链接 (e.g., "/heyshrutimishra/status/123456")
  
  // 互动统计
  stats: {
    replies: string;        // 回复数
    retweets: string;       // 转发数
    likes: string;          // 喜欢数
    bookmarks: string;      // 书签数
    views: string;          // 查看数
  };
}

/**
 * 获取推文函数的返回结果
 */
export interface TweetResult {
  url: string;              // 原始推文URL
  htmlFile: string;         // 保存的HTML文件路径
  articlesFile: string;     // 提取的article标签HTML文件路径
  tweets: Tweet[];          // 提取的推文数据数组
  count: number;            // 推文数量
}