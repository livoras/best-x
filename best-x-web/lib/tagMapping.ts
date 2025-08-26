// 标签中英文映射 - 用于前端显示
// 从 tagConfig 自动生成，避免重复维护

import { PREDEFINED_TAGS } from './tagConfig';

// 自动生成扁平化的标签映射
export const TAG_MAPPING: Record<string, string> = {};

// 从嵌套结构中提取所有标签
Object.values(PREDEFINED_TAGS).forEach(category => {
  Object.assign(TAG_MAPPING, category);
});

// 获取标签的中文名称
export function getTagLabel(tagKey: string): string {
  return TAG_MAPPING[tagKey] || tagKey;
}