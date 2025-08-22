'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Tweet } from '@/types/tweet';

interface ExtractionRecord {
  id: number;
  url: string;
  author_name: string;
  author_handle: string;
  author_avatar?: string;
  tweet_count: number;
  main_tweet_text: string;
  extract_time: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [scrollTimes, setScrollTimes] = useState(3);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ExtractionRecord[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchTweets = async () => {
    if (!url) {
      setError('请输入推文URL');
      return;
    }

    setLoading(true);
    setError('');
    setTweets([]);

    try {
      const res = await fetch('http://localhost:3001/api/fetch-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scrollTimes })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '获取失败');
      }

      setTweets(data.tweets || []);
      setSelectedHistoryId(null); // 清除历史选中状态
      fetchHistory(); // 刷新历史列表
    } catch (err: any) {
      setError(err.message || '获取推文失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取历史记录
  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/extractions?limit=20');
      const data = await res.json();
      setHistory(data.extractions || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // 加载历史记录的推文
  const loadHistoryItem = async (id: number) => {
    setLoadingHistory(true);
    setError('');
    setSelectedHistoryId(id);
    
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${id}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error('加载历史记录失败');
      }
      
      setTweets(data.tweets || []);
      setUrl(data.url || '');
    } catch (err: any) {
      setError(err.message || '加载历史记录失败');
    } finally {
      setLoadingHistory(false);
    }
  };

  // 组件加载时获取历史记录
  useEffect(() => {
    fetchHistory();
  }, []);

  // Format numbers like Twitter (1.2K, 3.5M, etc)
  const formatNumber = (num: string) => {
    const n = parseInt(num.replace(/,/g, ''));
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return num;
  };

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Layout with Sidebar */}
      <div className="flex h-screen">
        {/* Sidebar - History */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          {/* Logo Section */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <h1 className="text-lg font-bold text-gray-900">Post Extractor</h1>
            </div>
            <p className="text-xs text-gray-600 mt-2 ml-8">提取推文历史记录</p>
          </div>
          
          <div className="divide-y divide-gray-100">
            {history.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                暂无历史记录
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadHistoryItem(item.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${
                    selectedHistoryId === item.id ? 'bg-blue-50 border-l-blue-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex gap-3">
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
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">{item.author_name}</span>
                        <span className="text-gray-500 text-sm truncate">{item.author_handle}</span>
                      </div>
                      <div className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {item.main_tweet_text}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{item.tweet_count} 条推文</span>
                        <span>{new Date(item.extract_time).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Column - Input and Tweets */}
        <div className="w-[600px] overflow-y-auto border-r border-gray-200">
          {/* Input Section */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Post URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://x.com/user/status/123456789"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Load More Comments: <span className="text-blue-600 font-bold">{scrollTimes}</span> scrolls
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={scrollTimes}
                onChange={(e) => setScrollTimes(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gradient-to-r from-gray-200 to-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Less</span>
                <span>More</span>
              </div>
            </div>

            <button
              onClick={fetchTweets}
              disabled={loading || loadingHistory}
              className={`w-full py-2 rounded-md text-sm font-semibold transition-all transform shadow-sm ${
                loading || loadingHistory
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-[1.01] active:scale-[0.99] hover:shadow-md'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Extracting...
                </span>
              ) : 'Extract Posts'}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-start gap-2 text-sm">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {(tweets.length > 0 || loadingHistory) && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {loadingHistory ? '加载中...' : `${tweets.length} Posts ${selectedHistoryId ? '(历史记录)' : ''}`}
              </h2>
              {selectedHistoryId && (
                <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  历史数据
                </span>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-b-lg shadow-sm divide-y divide-gray-100">
            {tweets.map((tweet, index) => (
              <article 
                key={index}
                className="px-4 py-4 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <div className="flex gap-3">
                  {/* Avatar */}
                  <img 
                    src={tweet.author.avatar} 
                    alt={tweet.author.name}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Author info */}
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="font-bold text-gray-900 hover:underline">
                        {tweet.author.name}
                      </span>
                      <span className="text-gray-500 text-sm">{tweet.author.handle}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500 text-sm hover:underline">{tweet.time}</span>
                    </div>
                    
                    {/* Tweet content */}
                    <div className="mt-1 text-gray-800 whitespace-pre-wrap break-words">
                      {tweet.content.text}
                      {tweet.content.hasMore && (
                        <span className="text-blue-500 ml-1 hover:underline cursor-pointer">Show more</span>
                      )}
                    </div>
                    
                    {/* Media */}
                    {tweet.media.images.length > 0 && (
                      <div className={`mt-3 grid gap-1 rounded-2xl overflow-hidden border border-gray-200 ${
                        tweet.media.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}>
                        {tweet.media.images.map((img, i) => (
                          <img 
                            key={i}
                            src={img} 
                            alt=""
                            className="w-full h-full object-cover"
                            style={{ 
                              maxHeight: tweet.media.images.length === 1 ? '500px' : '280px' 
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {tweet.media.video && (
                      <div className="mt-3 relative rounded-2xl overflow-hidden border border-gray-200 group shadow-md">
                        <img 
                          src={tweet.media.video.thumbnail} 
                          alt="Video"
                          className="w-full"
                          style={{ maxHeight: '500px', objectFit: 'cover' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                          <div className="bg-white/90 backdrop-blur-sm rounded-full p-4 group-hover:scale-110 transition-transform shadow-xl">
                            <svg className="w-10 h-10 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Stats */}
                    <div className="flex items-center gap-1 mt-3 -ml-2">
                      <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-blue-500 group transition-colors">
                        <div className="p-1.5 rounded-full group-hover:bg-blue-500/10">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <span className="text-sm">{formatNumber(tweet.stats.replies)}</span>
                      </button>
                      
                      <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-green-500 group transition-colors">
                        <div className="p-1.5 rounded-full group-hover:bg-green-500/10">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                        <span className="text-sm">{formatNumber(tweet.stats.retweets)}</span>
                      </button>
                      
                      <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-red-500 group transition-colors">
                        <div className="p-1.5 rounded-full group-hover:bg-red-500/10">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </div>
                        <span className="text-sm">{formatNumber(tweet.stats.likes)}</span>
                      </button>
                      
                      <button className="flex items-center gap-2 p-2 text-gray-500 hover:text-blue-500 group transition-colors">
                        <div className="p-1.5 rounded-full group-hover:bg-blue-500/10">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </div>
                        <span className="text-sm">{formatNumber(tweet.stats.bookmarks)}</span>
                      </button>
                      
                      <div className="flex items-center gap-2 p-2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-sm">{formatNumber(tweet.stats.views)}</span>
                      </div>
                      
                      {tweet.statusLink && (
                        <a 
                          href={`https://x.com${tweet.statusLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto p-2 text-gray-400 hover:text-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
        </div>

        {/* Right Column - Additional Features */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">分析面板</h3>
              
              {tweets.length > 0 ? (
                <div className="space-y-4">
                  {/* Tweet Statistics */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">统计信息</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>总推文数</span>
                        <span className="font-medium">{tweets.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>总互动量</span>
                        <span className="font-medium">
                          {tweets.reduce((sum, t) => {
                            const likes = parseInt(t.stats.likes.replace(/,/g, '')) || 0;
                            const retweets = parseInt(t.stats.retweets.replace(/,/g, '')) || 0;
                            const replies = parseInt(t.stats.replies.replace(/,/g, '')) || 0;
                            return sum + likes + retweets + replies;
                          }, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>平均点赞数</span>
                        <span className="font-medium">
                          {Math.round(tweets.reduce((sum, t) => 
                            sum + (parseInt(t.stats.likes.replace(/,/g, '')) || 0), 0) / tweets.length).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">快速操作</h4>
                    <div className="space-y-2">
                      <button className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                        📊 生成分析报告
                      </button>
                      <button className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                        💾 导出为 JSON
                      </button>
                      <button className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                        📋 复制所有文本
                      </button>
                    </div>
                  </div>

                  {/* Top Engagement */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">最高互动推文</h4>
                    {(() => {
                      const topTweet = tweets.reduce((max, t) => {
                        const current = parseInt(t.stats.likes.replace(/,/g, '')) || 0;
                        const maxLikes = parseInt(max.stats.likes.replace(/,/g, '')) || 0;
                        return current > maxLikes ? t : max;
                      }, tweets[0]);
                      return (
                        <div className="text-sm text-gray-600">
                          <p className="line-clamp-2 mb-2">{topTweet.content.text}</p>
                          <p className="text-xs text-gray-500">
                            ❤️ {formatNumber(topTweet.stats.likes)} · 
                            🔄 {formatNumber(topTweet.stats.retweets)}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm">提取推文后将在此显示分析数据</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}