'use client';

import React from 'react';

interface Reply {
  text: string;
  time?: string;
  media: {
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
  } | null;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
}

interface RepliesViewProps {
  replies?: Reply[];
  formatTweetTime: (time: string | undefined) => string;
  formatNumber: (num: string | number) => string;
}

export default function RepliesView({
  replies,
  formatTweetTime,
  formatNumber
}: RepliesViewProps) {
  if (!replies || replies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg className="w-16 h-16 text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          暂无回复
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          这条推文还没有收到任何回复
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          {replies.length} 条回复
        </h2>
      </div>
      
      <div className="bg-white rounded-b-lg shadow-sm divide-y divide-gray-100">
        {replies.map((reply, index) => (
          <article 
            key={index}
            className="px-4 py-4 hover:bg-gray-50 transition-all cursor-pointer"
          >
            <div className="flex gap-3">
              {/* Avatar */}
              <img 
                src={reply.author.avatar} 
                alt={reply.author.name}
                className="w-10 h-10 rounded-full flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                {/* Author info */}
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="font-bold text-gray-900 hover:underline cursor-pointer">
                    {reply.author.name}
                  </span>
                  <span className="text-gray-500 text-sm">{reply.author.handle}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 text-sm hover:underline cursor-pointer">
                    {formatTweetTime(reply.time)}
                  </span>
                </div>
                
                {/* Reply content */}
                <div 
                  className="mt-1 text-gray-800 whitespace-pre-wrap break-words tweet-content"
                  dangerouslySetInnerHTML={{ __html: reply.text }}
                />
                
                {/* Media - 使用items数组按原始顺序渲染 */}
                {reply.media.items && reply.media.items.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${
                    reply.media.items.length === 1 ? 'grid-cols-1' :
                    reply.media.items.length === 2 ? 'grid-cols-2' :
                    reply.media.items.length === 3 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {reply.media.items.map((item, idx) => (
                      item.type === 'image' ? (
                        <img 
                          key={idx}
                          src={item.url} 
                          alt={`Reply ${index + 1} Image ${idx + 1}`}
                          className="w-full rounded-2xl border border-gray-200 object-cover"
                          style={{ 
                            maxHeight: reply.media.items!.length === 1 ? '500px' : '280px' 
                          }}
                        />
                      ) : (
                        <div key={idx} className="relative rounded-2xl overflow-hidden border border-gray-200 group shadow-md">
                          <img 
                            src={item.thumbnail} 
                            alt={`Reply ${index + 1} Video ${idx + 1}`}
                            className="w-full"
                            style={{ maxHeight: reply.media.items!.length === 1 ? '500px' : '250px', objectFit: 'cover' }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 group-hover:scale-110 transition-transform shadow-xl">
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
                {reply.card && (
                  <a 
                    href={reply.card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block border border-gray-200 rounded-xl overflow-hidden hover:bg-gray-50 transition-colors"
                  >
                    {reply.card.image && (
                      <img 
                        src={reply.card.image}
                        alt={reply.card.title}
                        className="w-full object-cover"
                        style={{ maxHeight: '250px' }}
                      />
                    )}
                    <div className="p-3">
                      <div className="text-sm text-gray-500 mb-1">
                        {reply.card.domain}
                      </div>
                      <div className="text-gray-900 font-medium line-clamp-2">
                        {reply.card.title}
                      </div>
                      {reply.card.description && (
                        <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {reply.card.description}
                        </div>
                      )}
                    </div>
                  </a>
                )}
                
                {/* Interaction buttons (placeholder for now) */}
                <div className="flex items-center gap-1 mt-3 -ml-2">
                  <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-blue-500 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-blue-500/10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-sm">回复</span>
                  </button>
                  
                  <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-green-500 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-green-500/10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <span className="text-sm">转发</span>
                  </button>
                  
                  <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-red-500 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-red-500/10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <span className="text-sm">喜欢</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}