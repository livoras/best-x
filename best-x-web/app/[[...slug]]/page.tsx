'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Tweet } from '@/types/tweet';
import ResizablePane from '@/components/ResizablePane';
import { DEFAULT_SCROLLS, MAX_SCROLLS } from '@/lib/consts';
import ReactMarkdown from 'react-markdown';

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

interface ArticleContent {
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  tweets: Array<{
    text: string;
    media: {
      images: string[];
      videos: Array<{ thumbnail: string }>;
    };
    time: string;
  }>;
  tweetCount: number;
  url: string;
}

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export default function Home({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [history, setHistory] = useState<ExtractionRecord[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [articleContent, setArticleContent] = useState<ArticleContent | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Tab 切换和 Markdown 内容状态
  const [activeTab, setActiveTab] = useState<'translation' | 'article' | 'markdown' | 'rendered'>('article');
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  
  // 翻译内容状态
  const [translationContent, setTranslationContent] = useState<string | null>(null);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [translationCopied, setTranslationCopied] = useState(false);
  const [hasTranslation, setHasTranslation] = useState(false);
  
  // 快速提取模态框状态
  const [showQuickExtract, setShowQuickExtract] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickScrollTimes, setQuickScrollTimes] = useState(DEFAULT_SCROLLS);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');
  
  
  // 辅助函数：去除HTML标签
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  
  // 格式化推文时间为 YYYY/MM/DD HH:mm
  const formatTweetTime = (timeStr: string | undefined) => {
    if (!timeStr) return '';
    
    // Twitter 时间格式示例: "下午12:25 · 2025年8月23日" 或 "12:25 PM · Aug 23, 2025"
    // 提取日期和时间部分
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(上午|下午|AM|PM)?\s*·\s*(\d{4})年?(\d{1,2})月?(\d{1,2})/);
    const englishMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*·\s*(\w+)\s+(\d{1,2}),\s*(\d{4})/);
    
    if (match) {
      // 中文格式
      let [_, hour, minute, period, year, month, day] = match;
      let h = parseInt(hour);
      
      if (period === '下午' || period === 'PM') {
        if (h !== 12) h += 12;
      } else if ((period === '上午' || period === 'AM') && h === 12) {
        h = 0;
      }
      
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')} ${h.toString().padStart(2, '0')}:${minute}`;
    } else if (englishMatch) {
      // 英文格式
      let [_, hour, minute, period, monthStr, day, year] = englishMatch;
      let h = parseInt(hour);
      
      if (period === 'PM' && h !== 12) h += 12;
      else if (period === 'AM' && h === 12) h = 0;
      
      const months: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      const month = months[monthStr] || '01';
      
      return `${year}/${month}/${day.padStart(2, '0')} ${h.toString().padStart(2, '0')}:${minute}`;
    }
    
    // 如果无法解析，返回原始字符串
    return timeStr;
  };
  
  // 队列状态 - 仅用于检测新任务完成
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    summary: { pending: 0, processing: 0, completed: 0, failed: 0 },
    currentTask: null,
    queue: [],
    recent: [],
    allTasks: []
  });

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

  // 加载提取内容（不更新路由）
  const loadExtractionContent = async (id: number) => {
    setLoadingHistory(true);
    setLoadingArticle(true);
    setError('');
    
    try {
      // 并行请求推文数据和文章内容
      const [tweetsRes, articleRes] = await Promise.all([
        fetch(`http://localhost:3001/api/extractions/${id}`),
        fetch(`http://localhost:3001/api/extractions/${id}/article`)
      ]);
      
      const tweetsData = await tweetsRes.json();
      const articleData = await articleRes.json();
      
      if (!tweetsRes.ok) {
        throw new Error('加载历史记录失败');
      }
      
      setTweets(tweetsData.tweets || []);
      setUrl(tweetsData.url || '');
      
      if (articleRes.ok) {
        setArticleContent(articleData);
      } else {
        setArticleContent(null);
      }
      
      // 重置 Markdown 和翻译相关状态
      setMarkdownContent(null);
      setTranslationContent(null);
      setHasTranslation(false);
      setActiveTab('article');
      
      // 检查是否有翻译
      checkTranslationAvailable(id);
    } catch (err: any) {
      setError(err.message || '加载历史记录失败');
      setArticleContent(null);
    } finally {
      setLoadingHistory(false);
      setLoadingArticle(false);
    }
  };

  // 加载历史记录的推文（会更新路由）
  const loadHistoryItem = async (id: number) => {
    setSelectedHistoryId(id);
    // 使用 window.history.pushState 避免页面重新加载
    window.history.pushState({}, '', `/extraction/${id}`);
    // 加载内容
    await loadExtractionContent(id);
  };

  // 使用 ref 追踪上一次的完成数量
  const previousCompletedRef = useRef<number>(0);

  // 处理路由参数中的extraction ID
  useEffect(() => {
    // 检查是否是 /extraction/ID 路由
    if (params.slug && params.slug[0] === 'extraction' && params.slug[1]) {
      const id = parseInt(params.slug[1]);
      if (!isNaN(id) && id !== selectedHistoryId && history.length > 0) {
        // 检查这个ID是否存在于历史记录中
        const exists = history.some(item => item.id === id);
        if (exists) {
          // 直接加载内容，不再调用loadHistoryItem以避免循环
          setSelectedHistoryId(id);
          loadExtractionContent(id);
        }
      }
    }
  }, [params.slug, history]);

  // 处理浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/extraction\/(\d+)$/);
      if (match) {
        const id = parseInt(match[1]);
        if (!isNaN(id) && history.some(item => item.id === id)) {
          setSelectedHistoryId(id);
          loadExtractionContent(id);
        }
      } else if (path === '/') {
        // 返回主页时清空选中状态
        setSelectedHistoryId(null);
        setTweets([]);
        setArticleContent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [history]);

  // 获取 Markdown 内容
  const fetchMarkdownContent = async () => {
    if (!selectedHistoryId || markdownContent) return;
    
    setLoadingMarkdown(true);
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${selectedHistoryId}/article-markdown`);
      if (res.ok) {
        const data = await res.json();
        setMarkdownContent(data.markdown);
      }
    } catch (err) {
      console.error('Failed to fetch markdown:', err);
    } finally {
      setLoadingMarkdown(false);
    }
  };
  
  // 检查是否有翻译可用
  const checkTranslationAvailable = async (extractionId: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${extractionId}/translation`);
      setHasTranslation(res.ok);
      // 如果有翻译，自动切换到翻译 tab
      if (res.ok) {
        setActiveTab('translation');
        // 直接加载翻译内容
        const translationRes = await fetch(`http://localhost:3001/api/extractions/${extractionId}/translation`);
        if (translationRes.ok) {
          const data = await translationRes.json();
          setTranslationContent(data.translationContent);
        }
      }
    } catch (err) {
      setHasTranslation(false);
    }
  };
  
  // 获取翻译内容
  const fetchTranslationContent = async () => {
    if (!selectedHistoryId || translationContent) return;
    
    setLoadingTranslation(true);
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${selectedHistoryId}/translation`);
      if (res.ok) {
        const data = await res.json();
        setTranslationContent(data.translationContent);
      }
    } catch (err) {
      console.error('Failed to fetch translation:', err);
    } finally {
      setLoadingTranslation(false);
    }
  };

  // 复制 Markdown 内容
  const copyMarkdown = () => {
    if (markdownContent) {
      navigator.clipboard.writeText(markdownContent);
      setMarkdownCopied(true);
      setTimeout(() => setMarkdownCopied(false), 2000);
    }
  };
  
  // 复制翻译内容
  const copyTranslation = () => {
    if (translationContent) {
      navigator.clipboard.writeText(translationContent);
      setTranslationCopied(true);
      setTimeout(() => setTranslationCopied(false), 2000);
    }
  };

  // 组件加载时获取历史记录和启动队列状态轮询
  useEffect(() => {
    fetchHistory();
    
    // 轮询队列状态
    const fetchQueueStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/queue/status');
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
      {/* Header - 横贯屏幕 */}
      <div className="w-full px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <h1 className="text-base font-bold text-gray-900">Best-X</h1>
            <span className="text-gray-400">·</span>
            <p className="text-xs text-gray-600">第一手高质量信息</p>
          </div>
          <nav className="flex gap-4 items-center">
            <Link 
              href="/" 
              className="text-sm font-medium text-blue-600 flex items-center border-b-2 border-blue-600 cursor-pointer"
            >
              主页
            </Link>
            <Link 
              href="/dashboard" 
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1.5 border-b-2 border-transparent cursor-pointer"
            >
              控制台
              {queueStatus.summary.processing > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {queueStatus.summary.processing}
                </span>
              )}
            </Link>
            <div className="w-px h-4 bg-gray-300 mx-2"></div>
            <button
              onClick={() => setShowQuickExtract(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              快速提取
            </button>
          </nav>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar - History */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
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
                        {stripHtml(item.main_tweet_text)}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{item.tweet_count} 条推文</span>
                          <span>{new Date(item.extract_time).toLocaleDateString()}</span>
                        </div>
                        {/* 翻译按钮 */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation(); // 防止触发loadHistoryItem
                            try {
                              const res = await fetch(`http://localhost:3001/api/extractions/${item.id}/translate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ targetLang: '中文' })
                              });
                              
                              const data = await res.json();
                              if (res.ok) {
                                console.log('翻译任务已创建:', data.taskId);
                                // 可以显示一个提示消息
                              } else {
                                console.error('创建翻译任务失败:', data.error);
                              }
                            } catch (error) {
                              console.error('请求失败:', error);
                            }
                          }}
                          className="px-2 py-0.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-600 rounded transition-colors"
                          title="翻译为中文"
                        >
                          🌐 翻译
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 使用可调节宽度的面板 - 文章视图在左，推文列表在右 */}
        <ResizablePane
          rightPane={
            <>
              {/* Empty State */}
              {tweets.length === 0 && !loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <svg className="w-16 h-16 text-gray-300 mb-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    选择历史记录
                  </h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    从左侧选择历史记录查看推文，或访问控制台提取新推文
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
                              <span className="font-bold text-gray-900 hover:underline cursor-pointer">
                                {tweet.author.name}
                              </span>
                              <span className="text-gray-500 text-sm">{tweet.author.handle}</span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-500 text-sm hover:underline cursor-pointer">{formatTweetTime(tweet.time)}</span>
                            </div>
                            
                            {/* Tweet content */}
                            <div 
                              className="mt-1 text-gray-800 whitespace-pre-wrap break-words tweet-content"
                              dangerouslySetInnerHTML={{ __html: tweet.content.text }}
                            />
                            {tweet.content.hasMore && (
                              <span className="text-blue-500 ml-1 hover:underline cursor-pointer">Show more</span>
                            )}
                            
                            {/* Media - 使用items数组按原始顺序渲染 */}
                            {tweet.media.items && tweet.media.items.length > 0 && (
                              <div className={`mt-3 grid gap-2 ${
                                tweet.media.items.length === 1 ? 'grid-cols-1' :
                                tweet.media.items.length === 2 ? 'grid-cols-2' :
                                tweet.media.items.length === 3 ? 'grid-cols-2' :
                                'grid-cols-2'
                              }`}>
                                {tweet.media.items.map((item, idx) => (
                                  item.type === 'image' ? (
                                    <img 
                                      key={idx}
                                      src={item.url} 
                                      alt={`Image ${idx + 1}`}
                                      className="w-full rounded-2xl border border-gray-200 object-cover"
                                      style={{ 
                                        maxHeight: tweet.media.items.length === 1 ? '500px' : '280px' 
                                      }}
                                    />
                                  ) : (
                                    <div key={idx} className="relative rounded-2xl overflow-hidden border border-gray-200 group shadow-md">
                                      <img 
                                        src={item.thumbnail} 
                                        alt={`Video ${idx + 1}`}
                                        className="w-full"
                                        style={{ maxHeight: tweet.media.items.length === 1 ? '500px' : '250px', objectFit: 'cover' }}
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
                            {tweet.card && (
                              <a 
                                href={tweet.card.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 block border border-gray-200 rounded-xl overflow-hidden hover:bg-gray-50 transition-colors"
                              >
                                {tweet.card.image && (
                                  <img 
                                    src={tweet.card.image}
                                    alt={tweet.card.title}
                                    className="w-full object-cover"
                                    style={{ maxHeight: '250px' }}
                                  />
                                )}
                                <div className="p-3">
                                  <div className="text-sm text-gray-500 mb-1">
                                    {tweet.card.domain}
                                  </div>
                                  <div className="text-gray-900 font-medium line-clamp-2">
                                    {tweet.card.title}
                                  </div>
                                  {tweet.card.description && (
                                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {tweet.card.description}
                                    </div>
                                  )}
                                </div>
                              </a>
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
            </>
          }
          leftPane={
            <div className="h-full flex flex-col">
              {/* Tab 切换按钮 */}
              {articleContent && (
                <div className="flex border-b border-gray-200 bg-white px-6 pt-4">
                  {hasTranslation && (
                    <button
                      onClick={() => {
                        setActiveTab('translation');
                        fetchTranslationContent();
                      }}
                      className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'translation'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      翻译
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('article')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'article'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    文章视图
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('markdown');
                      fetchMarkdownContent();
                    }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'markdown'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('rendered');
                      fetchMarkdownContent();
                    }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'rendered'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    渲染视图
                  </button>
                </div>
              )}
              
              {/* 内容区域 */}
              <div className="flex-1 p-6 overflow-y-auto">
                {loadingArticle ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-500">加载文章内容...</p>
                    </div>
                  </div>
                ) : articleContent ? (
                  (() => {
                    switch (activeTab) {
                      case 'article':
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
                        {tweet.media.items && tweet.media.items.length > 0 && (
                          <div className={`grid gap-2 mb-3 ${
                            tweet.media.items.length === 1 
                              ? 'grid-cols-1' 
                              : tweet.media.items.length <= 4 
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
                                    maxHeight: tweet.media.items.length === 1 ? '400px' : '200px' 
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
                                    style={{ maxHeight: tweet.media.items.length === 1 ? '400px' : '200px' }}
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
                      case 'markdown':
                        return (
                    // Markdown 视图
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
                      case 'rendered':
                        return (
                    // 渲染视图
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
                          <ReactMarkdown
                            components={{
                              // 自定义段落样式 - 处理换行
                              p: ({children}) => {
                                // 处理包含换行的文本
                                const processChildren = (child: any): any => {
                                  if (typeof child === 'string') {
                                    // 将双换行转换为分段，单换行保留为<br/>
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
                              // 自定义图片样式
                              img: ({src, alt}) => {
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
                              // 自定义链接样式
                              a: ({href, children}) => (
                                <a 
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-400 transition-colors"
                                >
                                  {children}
                                </a>
                              ),
                              // 自定义分隔线
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
                              // 自定义强调文本
                              strong: ({children}) => (
                                <strong className="font-semibold text-gray-900">{children}</strong>
                              ),
                              // 自定义斜体文本（用于视频标记）
                              em: ({children}) => {
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
                              // 自定义列表
                              ul: ({children}) => (
                                <ul className="my-6 ml-6 list-disc space-y-3 text-gray-700">
                                  {children}
                                </ul>
                              ),
                              ol: ({children}) => (
                                <ol className="my-6 ml-6 list-decimal space-y-3 text-gray-700">
                                  {children}
                                </ol>
                              ),
                              // 自定义列表项
                              li: ({children}) => (
                                <li className="leading-relaxed pl-2">
                                  <span className="block">{children}</span>
                                </li>
                              ),
                              // 自定义代码块
                              code: ({children}) => (
                                <code className="px-2 py-1 bg-gray-100 text-pink-600 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ),
                              // 自定义引用块
                              blockquote: ({children}) => (
                                <blockquote className="border-l-4 border-blue-400 pl-4 my-6 text-gray-700 italic">
                                  {children}
                                </blockquote>
                              ),
                              // 自定义标题
                              h1: ({children}) => (
                                <h1 className="text-3xl font-bold text-gray-900 mb-6 mt-8">{children}</h1>
                              ),
                              h2: ({children}) => (
                                <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-6">{children}</h2>
                              ),
                              h3: ({children}) => (
                                <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">{children}</h3>
                              ),
                              h4: ({children}) => (
                                <h4 className="text-lg font-semibold text-gray-800 mb-2 mt-3">{children}</h4>
                              ),
                              h5: ({children}) => (
                                <h5 className="text-base font-medium text-gray-800 mb-2 mt-2">{children}</h5>
                              ),
                              h6: ({children}) => (
                                <h6 className="text-sm font-medium text-gray-700 mb-1 mt-2">{children}</h6>
                              ),
                            }}
                          >
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
                      case 'translation':
                        return (
                    // 翻译视图
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
                            翻译内容
                          </div>
                          <div className="text-xs text-gray-400">
                            目标语言：中文
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
                          <ReactMarkdown
                            components={{
                              // 复用渲染视图的组件样式
                              p: ({children}) => {
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
                              img: ({src, alt}) => {
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
                              a: ({href, children}) => (
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
                              strong: ({children}) => (
                                <strong className="font-semibold text-gray-900">{children}</strong>
                              ),
                              em: ({children}) => {
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
                              ul: ({children}) => (
                                <ul className="my-6 ml-6 list-disc space-y-3 text-gray-700">
                                  {children}
                                </ul>
                              ),
                              ol: ({children}) => (
                                <ol className="my-6 ml-6 list-decimal space-y-3 text-gray-700">
                                  {children}
                                </ol>
                              ),
                              li: ({children}) => (
                                <li className="leading-relaxed pl-2">
                                  <span className="block">{children}</span>
                                </li>
                              ),
                              code: ({children}) => (
                                <code className="px-2 py-1 bg-gray-100 text-pink-600 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ),
                              blockquote: ({children}) => (
                                <blockquote className="border-l-4 border-blue-400 pl-4 my-6 text-gray-700 italic">
                                  {children}
                                </blockquote>
                              ),
                              h1: ({children}) => (
                                <h1 className="text-3xl font-bold text-gray-900 mb-6 mt-8">{children}</h1>
                              ),
                              h2: ({children}) => (
                                <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-6">{children}</h2>
                              ),
                              h3: ({children}) => (
                                <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">{children}</h3>
                              ),
                              h4: ({children}) => (
                                <h4 className="text-lg font-semibold text-gray-800 mb-2 mt-3">{children}</h4>
                              ),
                              h5: ({children}) => (
                                <h5 className="text-base font-medium text-gray-800 mb-2 mt-2">{children}</h5>
                              ),
                              h6: ({children}) => (
                                <h6 className="text-sm font-medium text-gray-700 mb-1 mt-2">{children}</h6>
                              ),
                            }}
                          >
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
                      default:
                        return null;
                    }
                  })()
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h15m0 0l-3-3m3 3l-3 3m-13-3a6 6 0 1112 0 6 6 0 01-12 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    文章视图
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    选择左侧历史记录，查看连续推文的合并内容
                  </p>
                  <Link 
                    href="/dashboard" 
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    前往控制台
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                )}
              </div>
            </div>
          }
          defaultLeftWidth={600}
          minLeftWidth={400}
          maxLeftWidth={800}
          storageKey="tweet-pane-width"
        />
      </div>
      {/* 快速提取模态框 */}
      {showQuickExtract && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* 模态框头部 */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  快速提取
                </h3>
                <button
                  onClick={() => {
                    setShowQuickExtract(false);
                    setQuickUrl('');
                    setQuickError('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 模态框内容 */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  推文链接
                </label>
                <input
                  type="text"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="https://x.com/user/status/123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  加载评论深度：<span className="text-blue-600 font-bold">{quickScrollTimes}</span> 次滚动
                </label>
                <input
                  type="range"
                  min="1"
                  max={MAX_SCROLLS}
                  value={quickScrollTimes}
                  onChange={(e) => setQuickScrollTimes(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-gray-200 to-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>少量评论</span>
                  <span>更多评论</span>
                </div>
              </div>
              
              {quickError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  {quickError}
                </div>
              )}
            </div>
            
            {/* 模态框底部 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowQuickExtract(false);
                  setQuickUrl('');
                  setQuickError('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!quickUrl) {
                    setQuickError('请输入推文链接');
                    return;
                  }
                  
                  setQuickLoading(true);
                  setQuickError('');
                  
                  try {
                    const res = await fetch('http://localhost:3001/api/fetch-tweet', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: quickUrl, scrollTimes: quickScrollTimes })
                    });
                    
                    const data = await res.json();
                    
                    if (!res.ok) {
                      throw new Error(data.error || '提取失败');
                    }
                    
                    // 成功后关闭模态框并清空
                    setShowQuickExtract(false);
                    setQuickUrl('');
                    setQuickScrollTimes(DEFAULT_SCROLLS);
                    
                    // 刷新历史记录
                    fetchHistory();
                  } catch (err: any) {
                    setQuickError(err.message || '提取失败，请重试');
                  } finally {
                    setQuickLoading(false);
                  }
                }}
                disabled={quickLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  quickLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {quickLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    提取中...
                  </span>
                ) : '开始提取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}