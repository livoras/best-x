'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { markdownComponents } from './TranslationView';

interface RenderedViewProps {
  articleContent: {
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
    tweets: Array<{ time?: string }>;
    tweetCount: number;
  };
  markdownContent: string | null;
  loadingMarkdown: boolean;
  formatTweetTime: (time: string | undefined) => string;
}

export default function RenderedView({
  articleContent,
  markdownContent,
  loadingMarkdown,
  formatTweetTime
}: RenderedViewProps) {
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
        <div className="ml-auto text-right pr-8">
          <div className="text-sm text-gray-500">
            {articleContent.tweetCount} 条连续推文
          </div>
          <div className="text-xs text-gray-400">
            {formatTweetTime(articleContent.tweets[0]?.time)}
          </div>
        </div>
      </div>
      
      {/* Rendered Markdown Content */}
      {loadingMarkdown ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : markdownContent ? (
        <div className="markdown-content">
          <ReactMarkdown components={markdownComponents}>
            {markdownContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          加载 Markdown 内容中...
        </div>
      )}
    </div>
  );
}