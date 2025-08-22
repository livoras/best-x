'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { Tweet } from '@/types/tweet';
import Dashboard from '@/components/Dashboard';

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

// 任务接口
interface Task {
  task_id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  priority?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  elapsed?: number;
}

// 任务队列状态接口
interface QueueStatus {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  currentTask: {
    url: string;
    progress: number;
    message: string;
    elapsed: number;
  } | null;
  queue: Array<{
    position: number;
    url: string;
    estimatedTime: string;
  }>;
  recent: Array<{
    url: string;
    status: 'completed' | 'failed';
    completedAt: string;
    error?: string;
  }>;
  allTasks: Task[];
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
  
  // 队列状态
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    summary: { pending: 0, processing: 0, completed: 0, failed: 0 },
    currentTask: null,
    queue: [],
    recent: [],
    allTasks: []
  });
  
  // 筛选状态
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'processing' | 'pending' | 'completed' | 'failed'>('all');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchTweets = async () => {
    if (!url) {
      setError('请输入推文URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 提交任务到队列
      const res = await fetch('http://localhost:3001/api/fetch-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scrollTimes })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '添加任务失败');
      }

      // 任务已入队
      console.log(`任务已入队: ${data.taskId}`);
      setUrl(''); // 清空输入框
      setLoading(false); // 立即解除loading状态，允许继续提交
      
      // 显示成功消息（可选）
      // 队列状态会通过右侧栏的轮询自动更新显示
      
    } catch (err: any) {
      setError(err.message || '提交任务失败');
      setLoading(false);
    }
  };

  // 获取历史记录
  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/extractions?limit=20');
      const data = await res.json();
      const extractions = data.extractions || [];
      setHistory(extractions);
      return extractions; // 返回历史记录数据
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
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

  // 使用 ref 追踪上一次的完成数量
  const previousCompletedRef = useRef<number>(0);

  // 组件加载时获取历史记录和启动队列状态轮询
  useEffect(() => {
    fetchHistory();
    
    // 轮询队列状态
    const fetchQueueStatus = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/queue/status?page=${currentPage}&pageSize=${pageSize}&filter=${selectedFilter}`);
        const data = await res.json();
        
        // 检测是否有新任务完成
        if (data.summary.completed > previousCompletedRef.current && previousCompletedRef.current > 0) {
          // 有新任务完成，刷新历史记录并自动激活最新的
          const updatedHistory = await fetchHistory();
          if (updatedHistory.length > 0) {
            // 自动加载最新的历史记录（第一条）
            loadHistoryItem(updatedHistory[0].id);
          }
        }
        
        // 更新追踪的完成数量
        previousCompletedRef.current = data.summary.completed;
        
        setQueueStatus(data);
      } catch (error) {
        console.error('Failed to fetch queue status:', error);
      }
    };
    
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 2000); // 每2秒更新一次
    
    return () => clearInterval(interval);
  }, [currentPage, pageSize, selectedFilter]);

  // Format numbers like Twitter (1.2K, 3.5M, etc)
  const formatNumber = (num: string) => {
    const n = parseInt(num.replace(/,/g, ''));
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return num;
  };

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header - 横贯屏幕 */}
      <div className="w-full px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <h1 className="text-base font-bold text-gray-900">Best-X</h1>
          <span className="text-gray-400">·</span>
          <p className="text-xs text-gray-600">第一手高质量推文</p>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar - History */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
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

        {/* Middle Column - Tweets */}
        <div className="w-[600px] overflow-y-auto border-r border-gray-200">

      {/* Empty State */}
      {tweets.length === 0 && !loadingHistory ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <svg className="w-16 h-16 text-gray-300 mb-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            开始提取推文
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            在右侧输入推文URL开始提取，或从左侧选择历史记录查看
          </p>
        </div>
      ) : (
      /* Results Section */
      (tweets.length > 0 || loadingHistory) && (
        <div className="p-4">
          <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">
              {loadingHistory ? '加载中...' : `${tweets.length} Posts`}
            </h2>
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
      ))}
        </div>

        {/* Right Column - Dashboard */}
        <Dashboard
          url={url}
          setUrl={setUrl}
          scrollTimes={scrollTimes}
          setScrollTimes={setScrollTimes}
          loading={loading}
          loadingHistory={loadingHistory}
          error={error}
          fetchTweets={fetchTweets}
          queueStatus={queueStatus}
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </div>
    </main>
  );
}