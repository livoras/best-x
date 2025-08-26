'use client';

import React from 'react';
import { getTagLabel } from '@/lib/tagMapping';

interface TagsViewProps {
  articleContent: {
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
  };
  tagsContent: {
    tags?: string[];
    reasons?: Record<string, string>;
    taggedAt?: string;
  } | null;
  loadingTags: boolean;
  selectedHistoryId: number | null;
  checkTagsAvailable: (id: number) => void;
}

export default function TagsView({
  articleContent,
  tagsContent,
  loadingTags,
  selectedHistoryId,
  checkTagsAvailable
}: TagsViewProps) {
  const handleGenerateTags = async () => {
    if (!selectedHistoryId) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${selectedHistoryId}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (res.ok) {
        console.log('标签任务已创建:', data.taskId);
        // 等待一段时间后检查结果
        setTimeout(() => {
          checkTagsAvailable(selectedHistoryId);
        }, 5000);
      } else {
        console.error('创建标签任务失败:', data.error);
      }
    } catch (error) {
      console.error('请求失败:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      {/* Header - 与其他视图保持一致 */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <img
          src={articleContent.author.avatar}
          alt={articleContent.author.name}
          className="w-12 h-12 rounded-full"
        />
        <div>
          <div className="font-semibold text-gray-900">{articleContent.author.name}</div>
          <div className="text-sm text-gray-500">{articleContent.author.handle}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm text-gray-500">
            AI 标签分类
          </div>
          <div className="text-xs text-gray-400">
            智能识别内容标签
          </div>
        </div>
      </div>
      
      {/* Tags Content */}
      {loadingTags ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : tagsContent ? (
        <div className="space-y-6">
          {/* 标签列表 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">识别的标签</h3>
            <div className="flex flex-wrap gap-2">
              {tagsContent.tags && tagsContent.tags.map((tag: string) => (
                <span 
                  key={tag}
                  className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200"
                >
                  {getTagLabel(tag)}
                </span>
              ))}
            </div>
          </div>
          
          {/* 标签理由 */}
          {tagsContent.reasons && Object.keys(tagsContent.reasons).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">分类理由</h3>
              <div className="space-y-2">
                {Object.entries(tagsContent.reasons).map(([tag, reason]) => (
                  <div key={tag} className="flex items-start gap-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-mono" title={tag}>
                      {getTagLabel(tag)}
                    </span>
                    <span className="text-sm text-gray-600 flex-1">
                      {reason as string}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 标签时间 */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              标签生成时间: {new Date(tagsContent.taggedAt || '').toLocaleString()}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">暂无标签数据</p>
          <button
            onClick={handleGenerateTags}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            生成标签
          </button>
        </div>
      )}
    </div>
  );
}