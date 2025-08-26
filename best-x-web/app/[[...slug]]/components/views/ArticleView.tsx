'use client';

import React from 'react';

interface ArticleContent {
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  tweets: Array<{
    text: string;
    time?: string;
    media: {
      images: string[];
      videos: Array<{ thumbnail: string }>;
      items?: Array<{
        type: 'image' | 'video';
        url: string;
        thumbnail?: string;
      }>;
    };
    card?: {
      url: string;
      domain: string;
      title: string;
      description?: string;
      image?: string;
    };
  }>;
  tweetCount: number;
  url: string;
}

interface ArticleViewProps {
  articleContent: ArticleContent;
  copied: boolean;
  setCopied: (value: boolean) => void;
  formatTweetTime: (time: string | undefined) => string;
}

export default function ArticleView({
  articleContent,
  copied,
  setCopied,
  formatTweetTime
}: ArticleViewProps) {
  return (
    <article className="bg-white rounded-xl border border-gray-100 p-6">
      {/* Author Header */}
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
            {articleContent.tweetCount} 条连续推文
          </div>
          <div className="text-xs text-gray-400">
            {formatTweetTime(articleContent.tweets[0]?.time)}
          </div>
        </div>
      </div>

      {/* Tweet Content with Media */}
      <div className="space-y-6">
        {articleContent.tweets.map((tweet, index) => (
          <div key={index} className={index > 0 ? "pt-4 border-t border-gray-100" : ""}>
            {/* Tweet Text */}
            <div 
              className="whitespace-pre-wrap text-gray-800 leading-relaxed mb-3 tweet-content"
              dangerouslySetInnerHTML={{ __html: tweet.text }}
            />
            
            {/* Tweet Media - 使用items数组按原始顺序渲染 */}
            {tweet.media?.items && tweet.media.items.length > 0 && (
              <div className={`grid gap-2 mb-3 ${
                tweet.media.items?.length === 1 
                  ? 'grid-cols-1' 
                  : tweet.media.items?.length <= 4 
                    ? 'grid-cols-2' 
                    : 'grid-cols-3'
              }`}>
                {tweet.media.items.map((item, itemIdx) => (
                  item.type === 'image' ? (
                    <img
                      key={`tweet-${index}-item-${itemIdx}`}
                      src={item.url}
                      alt={`Tweet ${index + 1} Image ${itemIdx + 1}`}
                      className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity object-cover"
                      style={{ 
                        maxHeight: tweet.media.items?.length === 1 ? '400px' : '200px' 
                      }}
                      onClick={() => window.open(item.url, '_blank')}
                    />
                  ) : (
                    <div key={`tweet-${index}-item-${itemIdx}`} className="relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
                         onClick={() => window.open(item.thumbnail, '_blank')}>
                      <img
                        src={item.thumbnail}
                        alt={`Tweet ${index + 1} Video ${itemIdx + 1}`}
                        className="w-full object-cover hover:opacity-90 transition-opacity"
                        style={{ maxHeight: tweet.media.items?.length === 1 ? '400px' : '200px' }}
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 group-hover:scale-110 transition-transform shadow-lg">
                          <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            
            {/* Twitter Card */}
            {tweet.card && (
              <a 
                href={tweet.card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 transition-colors mb-3"
              >
                {tweet.card.image && (
                  <img 
                    src={tweet.card.image}
                    alt={tweet.card.title}
                    className="w-full object-cover"
                    style={{ maxHeight: '300px' }}
                  />
                )}
                <div className="p-4">
                  <div className="text-sm text-gray-500 mb-1">
                    {tweet.card.domain}
                  </div>
                  <div className="text-gray-900 font-semibold text-lg">
                    {tweet.card.title}
                  </div>
                  {tweet.card.description && (
                    <div className="text-sm text-gray-600 mt-2">
                      {tweet.card.description}
                    </div>
                  )}
                </div>
              </a>
            )}
            
            {/* Time stamp for multiple tweets */}
            {articleContent.tweetCount > 1 && (
              <div className="text-xs text-gray-400 mt-2">
                {formatTweetTime(tweet.time)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Original Link */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
        <a
          href={articleContent.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-blue-500 hover:text-blue-600 transition-colors"
        >
          查看原始推文
          <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(articleContent.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`inline-flex items-center text-sm transition-colors ${
            copied ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {copied ? (
            <>
              <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制链接
            </>
          )}
        </button>
      </div>
    </article>
  );
}