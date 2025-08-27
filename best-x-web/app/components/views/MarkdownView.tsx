'use client';

import React from 'react';

interface MarkdownViewProps {
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
  markdownCopied: boolean;
  copyMarkdown: () => void;
  formatTweetTime: (time: string | undefined) => string;
}

export default function MarkdownView({
  articleContent,
  markdownContent,
  loadingMarkdown,
  markdownCopied,
  copyMarkdown,
  formatTweetTime
}: MarkdownViewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 relative">
      {/* 复制按钮 - 绝对定位在右上角 */}
      <button
        onClick={copyMarkdown}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${
          markdownCopied 
            ? 'bg-green-100 text-green-600' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        title={markdownCopied ? '已复制' : '复制全部'}
      >
        {markdownCopied ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      
      {/* Header - 不受按钮影响 */}
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
      
      {/* Markdown Content */}
      {loadingMarkdown ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : markdownContent ? (
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed overflow-x-auto">
          {markdownContent}
        </pre>
      ) : (
        <div className="text-center py-12 text-gray-500">
          加载 Markdown 内容中...
        </div>
      )}
    </div>
  );
}