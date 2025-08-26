'use client';

import React from 'react';
import Image from 'next/image';

interface HistoryItemProps {
  item: {
    id: number;
    author_name: string;
    author_handle: string;
    author_avatar?: string;
    main_tweet_text: string;
    tweet_count: number;
    extract_time: string;
  };
  isSelected: boolean;
  onClick: () => void;
  stripHtml: (html: string) => string;
}

export default function HistoryItem({
  item,
  isSelected,
  onClick,
  stripHtml
}: HistoryItemProps) {
  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${item.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang: '中文' })
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log('翻译任务已创建:', data.taskId);
      } else {
        console.error('创建翻译任务失败:', data.error);
      }
    } catch (error) {
      console.error('请求失败:', error);
    }
  };

  const handleTag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${item.id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log('标签任务已创建:', data.taskId);
      } else {
        console.error('创建标签任务失败:', data.error);
      }
    } catch (error) {
      console.error('请求失败:', error);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${
        isSelected ? 'bg-blue-50 border-l-blue-500' : 'border-transparent'
      }`}
    >
      {/* 环绕式布局 */}
      <div>
        {/* 第一行：头像 + 用户信息 */}
        <div className="flex gap-3 mb-2">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {item.author_avatar ? (
              <Image
                src={item.author_avatar}
                alt={item.author_name}
                width={40}
                height={40}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-500 text-sm font-medium">
                  {item.author_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          {/* 用户信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900 truncate">{item.author_name}</span>
              <span className="text-gray-500 text-sm truncate">{item.author_handle}</span>
            </div>
            {/* 推文数量和时间 - 移到头像右侧 */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{item.tweet_count} 条推文</span>
              <span>{new Date(item.extract_time).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        {/* 第二部分：推文内容 - 全宽度 */}
        <div className="text-sm text-gray-600 line-clamp-2 mb-2 pl-0">
          {stripHtml(item.main_tweet_text)}
        </div>
        
        {/* 第三部分：操作按钮 - 全宽度 */}
        <div className="flex items-center gap-2 pl-0">
          {/* 翻译按钮 */}
          <button
            onClick={handleTranslate}
            className="px-2 py-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-600 rounded transition-colors cursor-pointer"
            title="翻译为中文"
          >
            🌐 翻译
          </button>
          
          {/* 标签按钮 */}
          <button
            onClick={handleTag}
            className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors cursor-pointer"
            title="AI 标签分类"
          >
            🏷️ 标签
          </button>
        </div>
      </div>
    </div>
  );
}