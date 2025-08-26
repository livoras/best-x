import { PREDEFINED_TAGS } from './tagConfig';

// 根据标签类别返回对应的颜色类名
export const getTagColorClasses = (tagKey: string) => {
  // 内容形式 - 蓝色系
  if (PREDEFINED_TAGS.content_form[tagKey as keyof typeof PREDEFINED_TAGS.content_form]) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      hoverBg: 'hover:bg-blue-100'
    };
  }
  
  // 内容领域 - 紫色系
  if (PREDEFINED_TAGS.domain[tagKey as keyof typeof PREDEFINED_TAGS.domain]) {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      hoverBg: 'hover:bg-purple-100'
    };
  }
  
  // 内容价值 - 绿色系
  if (PREDEFINED_TAGS.value[tagKey as keyof typeof PREDEFINED_TAGS.value]) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      hoverBg: 'hover:bg-green-100'
    };
  }
  
  // 观点立场 - 橙色系
  if (PREDEFINED_TAGS.stance[tagKey as keyof typeof PREDEFINED_TAGS.stance]) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      hoverBg: 'hover:bg-orange-100'
    };
  }
  
  // 内容特征 - 红色系
  if (PREDEFINED_TAGS.features[tagKey as keyof typeof PREDEFINED_TAGS.features]) {
    return {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      hoverBg: 'hover:bg-red-100'
    };
  }
  
  // 默认 - 灰色系
  return {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    hoverBg: 'hover:bg-gray-100'
  };
};