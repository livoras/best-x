/**
 * X (Twitter) 推文数据结构定义
 */

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
    images: string[];       // 图片URL数组
    video?: {               // 视频信息（可选）
      thumbnail: string;    // 视频缩略图
    } | null;
  };
  
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