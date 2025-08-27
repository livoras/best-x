// 单个用户信息
export interface FollowingUser {
  // 基础信息
  userId: string;           // 用户ID（从 data-testid 中提取）
  username: string;         // 用户名（不带@）
  handle: string;           // @handle 格式
  displayName: string;      // 显示名称
  
  // 个人资料
  bio: string;              // 个人简介
  avatarUrl: string;        // 头像URL
  profileUrl: string;       // 个人主页链接 (/username)
  
  // 认证状态
  isVerified: boolean;      // 蓝勾认证
  isOrganization: boolean;  // 金勾组织认证
  
  // 关注状态
  isFollowing: boolean;     // 当前用户是否已关注该用户（互相关注）
  followButtonTestId: string; // 关注按钮的 data-testid
}

// 获取关注列表的选项
export interface GetFollowingsOptions {
  scrollTimes?: number;      // 滚动次数，默认10
  maxUsers?: number;         // 最大获取用户数，默认不限制
  skipVerified?: boolean;    // 是否跳过认证用户，默认false
}

// 关注列表提取结果
export interface FollowingsResult {
  // 基础信息
  url: string;                          // 页面URL
  username: string;                      // 页面所属用户（谁的关注列表）
  
  // 文件路径
  htmlFile: string;                      // 原始HTML文件路径
  usersFile: string;                     // 提取的用户数据文件路径
  
  // 用户数据
  users: FollowingUser[];                // 所有用户列表
  mainUserFollowings: FollowingUser[];   // 互相关注的用户
  oneWayFollowings: FollowingUser[];     // 单向关注的用户
  
  // 统计信息
  count: number;                         // 总用户数
  hasMore: boolean;                      // 是否还有更多（用于判断是否需要继续滚动）
  extractedAt: string;                   // 提取时间
}