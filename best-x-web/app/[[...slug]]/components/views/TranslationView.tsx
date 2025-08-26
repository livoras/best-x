'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface TranslationViewProps {
  articleContent: {
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
    tweets: Array<{ time?: string }>;
    tweetCount: number;
  };
  translationContent: string | null;
  loadingTranslation: boolean;
  translationCopied: boolean;
  copyTranslation: () => void;
  formatTweetTime: (time: string | undefined) => string;
}

// 导出 Markdown 组件配置，供其他组件复用
export const markdownComponents = {
  p: ({children}: any) => {
    const processChildren = (child: any): any => {
      if (typeof child === 'string') {
        const lines = child.split('\n');
        return lines.map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ));
      }
      if (Array.isArray(child)) {
        return child.map((c, i) => (
          <React.Fragment key={i}>{processChildren(c)}</React.Fragment>
        ));
      }
      return child;
    };
    
    return (
      <p className="text-gray-800 leading-relaxed mb-6 text-base whitespace-pre-line">
        {processChildren(children)}
      </p>
    );
  },
  img: ({src, alt}: any) => {
    const isVideo = alt === 'Video';
    const isEmoji = src?.includes('emoji');
    
    if (isEmoji) {
      return <img src={src} alt={alt} className="inline-block w-5 h-5 mx-1" />;
    }
    
    if (isVideo) {
      return (
        <div className="relative my-6 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
          <img 
            src={src} 
            alt={alt}
            className="w-full object-cover"
            style={{ maxHeight: '500px' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 hover:bg-black/70 transition-colors">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <img 
        src={src} 
        alt={alt}
        className="rounded-xl my-6 w-full object-cover shadow-lg border border-gray-100"
        style={{ maxHeight: '600px' }}
      />
    );
  },
  a: ({href, children}: any) => (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400 transition-colors"
    >
      {children}
    </a>
  ),
  hr: () => (
    <div className="my-8 flex items-center">
      <div className="flex-1 border-t border-gray-200"></div>
      <div className="px-4">
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="2"/>
          <circle cx="6" cy="12" r="2"/>
          <circle cx="18" cy="12" r="2"/>
        </svg>
      </div>
      <div className="flex-1 border-t border-gray-200"></div>
    </div>
  ),
  strong: ({children}: any) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({children}: any) => {
    const text = String(children);
    if (text.includes('[视频内容]')) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>视频内容</span>
        </div>
      );
    }
    if (text.includes('.app') || text.includes('.com') || text.includes('.org')) {
      return <span className="text-sm text-gray-500">{children}</span>;
    }
    return <em className="italic text-gray-700">{children}</em>;
  },
  ul: ({children}: any) => (
    <ul className="my-6 ml-6 list-disc space-y-3 text-gray-700">
      {children}
    </ul>
  ),
  ol: ({children}: any) => (
    <ol className="my-6 ml-6 list-decimal space-y-3 text-gray-700">
      {children}
    </ol>
  ),
  li: ({children}: any) => (
    <li className="leading-relaxed pl-2">
      <span className="block">{children}</span>
    </li>
  ),
  code: ({children}: any) => (
    <code className="px-2 py-1 bg-gray-100 text-pink-600 rounded text-sm font-mono">
      {children}
    </code>
  ),
  blockquote: ({children}: any) => (
    <blockquote className="border-l-4 border-blue-400 pl-4 my-6 text-gray-700 italic">
      {children}
    </blockquote>
  ),
  h1: ({children}: any) => (
    <h1 className="text-3xl font-bold text-gray-900 mb-6 mt-8">{children}</h1>
  ),
  h2: ({children}: any) => (
    <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-6">{children}</h2>
  ),
  h3: ({children}: any) => (
    <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">{children}</h3>
  ),
  h4: ({children}: any) => (
    <h4 className="text-lg font-semibold text-gray-800 mb-2 mt-3">{children}</h4>
  ),
  h5: ({children}: any) => (
    <h5 className="text-base font-medium text-gray-800 mb-2 mt-2">{children}</h5>
  ),
  h6: ({children}: any) => (
    <h6 className="text-sm font-medium text-gray-700 mb-1 mt-2">{children}</h6>
  ),
};

export default function TranslationView({
  articleContent,
  translationContent,
  loadingTranslation,
  translationCopied,
  copyTranslation,
  formatTweetTime
}: TranslationViewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 relative">
      {/* 复制按钮 - 绝对定位在右上角 */}
      <button
        onClick={copyTranslation}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${
          translationCopied 
            ? 'bg-green-100 text-green-600' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        title={translationCopied ? '已复制' : '复制翻译'}
      >
        {translationCopied ? (
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
      
      {/* Translation Content */}
      {loadingTranslation ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : translationContent ? (
        <div className="markdown-content">
          <ReactMarkdown components={markdownComponents}>
            {translationContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          加载翻译内容中...
        </div>
      )}
    </div>
  );
}