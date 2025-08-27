'use client';

import React, { useState, useEffect, useRef, Suspense, useContext } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import type { Tweet } from '@/types/tweet';
import ResizablePane from '@/components/ResizablePane';
import { getTagLabel } from '@/lib/tagMapping';
import { getTagColorClasses } from '@/lib/tagColors';
import { useQueue } from '../QueueContext';

// 导入视图组件
import ArticleView from '../../components/views/ArticleView';
import TranslationView from '../../components/views/TranslationView';
import MarkdownView from '../../components/views/MarkdownView';
import RenderedView from '../../components/views/RenderedView';
import TagsView from '../../components/views/TagsView';
import RepliesView from '../../components/views/RepliesView';

// 骨架屏组件
import SmartLoadingContainer from '../../components/SmartLoadingContainer';
import ArticleViewSkeleton from '../../components/skeletons/ArticleViewSkeleton';
import TranslationViewSkeleton from '../../components/skeletons/TranslationViewSkeleton';
import TagsViewSkeleton from '../../components/skeletons/TagsViewSkeleton';
import RepliesViewSkeleton from '../../components/skeletons/RepliesViewSkeleton';
import GenericViewSkeleton from '../../components/skeletons/GenericViewSkeleton';

interface ArticleContent {
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  tweets?: Array<{
    text: string;
    media: {
      images: string[];
      videos: Array<{ thumbnail: string }>;
    };
    time: string;
  }>;
  mainThread?: Array<{
    text: string;
    media: {
      images: string[];
      videos: Array<{ thumbnail: string }>;
    };
    time: string;
  }>;
  replies?: Array<{
    text: string;
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
    time?: string;
    author: {
      name: string;
      handle: string;
      avatar: string;
    };
  }>;
  tweetCount: number;
  url: string;
}

interface ExtractionClientProps {
  id: string;
  initialData: {
    tweets: Tweet[];
    url: string;
    articleContent: ArticleContent | null;
  } | null;
  error: string | null;
}

// SWR fetcher
const fetcher = (url: string) => {
  return fetch(url)
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .catch(err => {
      console.error('Fetch error:', err);
      throw err;
    });
};

export default function ExtractionClient({ id, initialData, error: initialError }: ExtractionClientProps) {
  const { queueStatus } = useQueue();
  const [tweets, setTweets] = useState<Tweet[]>(initialData?.tweets || []);
  const [url, setUrl] = useState(initialData?.url || '');
  const [articleContent, setArticleContent] = useState<ArticleContent | null>(initialData?.articleContent || null);
  const [error, setError] = useState(initialError || '');
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // 跟踪已处理的任务
  const processedTasksRef = useRef<Set<string>>(new Set());
  
  // 清理已处理的任务 ID（保留最近 50 个）
  useEffect(() => {
    if (processedTasksRef.current.size > 50) {
      const entries = Array.from(processedTasksRef.current);
      processedTasksRef.current = new Set(entries.slice(-30));
    }
  }, [queueStatus]);
  
  // Tab 切换和内容状态
  const [activeTab, setActiveTab] = useState<'translation' | 'article' | 'markdown' | 'rendered' | 'tags'>('translation'); // 默认为翻译
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  
  // 使用 SWR 获取翻译内容
  const { data: translationData, mutate: mutateTranslation, isLoading: loadingTranslation, error: translationError } = useSWR(
    `http://localhost:3001/api/extractions/${id}/translation`,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data && queueStatus?.allTasks) {
          let foundCompletedTask = false;
          const hasRelevantTask = queueStatus.allTasks.some(task => {
            if (task.type === 'translate' && task.params) {
              try {
                const params = JSON.parse(task.params);
                const matches = params.extractionId === parseInt(id);
                if (matches && task.status === 'completed') {
                  foundCompletedTask = true;
                  if (!processedTasksRef.current.has(task.task_id)) {
                    processedTasksRef.current.add(task.task_id);
                    setTimeout(() => mutateTranslation(), 500);
                  }
                }
                return matches;
              } catch (e) {
                return false;
              }
            }
            return false;
          });
          return hasRelevantTask && !foundCompletedTask ? 2000 : 0;
        }
        return 0;
      },
      revalidateOnFocus: false
    }
  );
  
  // 使用 SWR 获取标签内容
  const { data: tagsData, mutate: mutateTags, isLoading: loadingTags, error: tagsError } = useSWR(
    `http://localhost:3001/api/extractions/${id}/tags`,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data && queueStatus?.allTasks) {
          let foundCompletedTask = false;
          const hasRelevantTask = queueStatus.allTasks.some(task => {
            if (task.type === 'tag' && task.params) {
              try {
                const params = JSON.parse(task.params);
                const matches = params.extractionId === parseInt(id);
                if (matches && task.status === 'completed') {
                  foundCompletedTask = true;
                  if (!processedTasksRef.current.has(task.task_id)) {
                    processedTasksRef.current.add(task.task_id);
                    setTimeout(() => mutateTags(), 500);
                  }
                }
                return matches;
              } catch (e) {
                return false;
              }
            }
            return false;
          });
          return hasRelevantTask && !foundCompletedTask ? 2000 : 0;
        }
        return 0;
      },
      revalidateOnFocus: false
    }
  );
  
  // 从 SWR 数据中提取内容
  const translationContent = translationData?.translationContent || null;
  const hasTranslation = !!translationContent;
  const tagsContent = tagsData || null;
  const hasTags = !!tagsContent;
  
  const [translationCopied, setTranslationCopied] = useState(false);
  
  // 格式化时间
  const formatTweetTime = (timeStr: string | undefined) => {
    if (!timeStr) return '';
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(上午|下午|AM|PM)?\s*·\s*(\d{4})年?(\d{1,2})月?(\d{1,2})/);
    const englishMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*·\s*(\w+)\s+(\d{1,2}),\s*(\d{4})/);
    
    if (match) {
      let [_, hour, minute, period, year, month, day] = match;
      let h = parseInt(hour);
      
      if (period === '下午' || period === 'PM') {
        if (h !== 12) h += 12;
      } else if ((period === '上午' || period === 'AM') && h === 12) {
        h = 0;
      }
      
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')} ${h.toString().padStart(2, '0')}:${minute}`;
    } else if (englishMatch) {
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
    
    return timeStr;
  };
  
  // Format numbers
  const formatNumber = (num: string) => {
    const n = parseInt(num.replace(/,/g, ''));
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return num;
  };
  
  
  // 获取 Markdown 内容
  const fetchMarkdownContent = async () => {
    if (markdownContent) return;
    
    setLoadingMarkdown(true);
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${id}/article-markdown`);
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
  
  
  // 复制 Markdown
  const copyMarkdown = () => {
    if (markdownContent) {
      navigator.clipboard.writeText(markdownContent);
      setMarkdownCopied(true);
      setTimeout(() => setMarkdownCopied(false), 2000);
    }
  };
  
  // 复制翻译
  const copyTranslation = () => {
    if (translationContent) {
      navigator.clipboard.writeText(translationContent);
      setTranslationCopied(true);
      setTimeout(() => setTranslationCopied(false), 2000);
    }
  };
  
  // 创建翻译任务
  const [creatingTranslation, setCreatingTranslation] = useState(false);
  const handleCreateTranslation = async () => {
    setCreatingTranslation(true);
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang: '中文' })
      });
      
      if (res.ok) {
        // 显示成功提示
        alert('翻译任务已加入队列');
        // 立即开始轮询检查新数据
        mutateTranslation();
      } else {
        alert('创建翻译任务失败');
      }
    } catch (error) {
      console.error('创建翻译任务失败:', error);
      alert('创建翻译任务失败');
    } finally {
      setCreatingTranslation(false);
    }
  };
  
  // 创建标签任务
  const [creatingTags, setCreatingTags] = useState(false);
  const handleCreateTags = async () => {
    setCreatingTags(true);
    try {
      const res = await fetch(`http://localhost:3001/api/extractions/${id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (res.ok) {
        // 显示成功提示
        alert('标签提取任务已加入队列');
        // 立即开始轮询检查新数据
        mutateTags();
      } else {
        alert('创建标签任务失败');
      }
    } catch (error) {
      console.error('创建标签任务失败:', error);
      alert('创建标签任务失败');
    } finally {
      setCreatingTags(false);
    }
  };
  
  
  // 渲染内容视图
  const renderContentView = () => {
    if (!articleContent) return null;
    
    switch (activeTab) {
      case 'article':
        return (
          <ArticleView
            articleContent={articleContent}
            copied={copied}
            setCopied={setCopied}
            formatTweetTime={formatTweetTime}
          />
        );
      
      case 'translation':
        // 如果没有翻译内容，显示占位符和按钮
        if (!translationContent && !loadingTranslation) {
          return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M3 5h12M9 3v2m1.048 3.04A18.022 18.022 0 006.412 9m6.088-6.088A18.021 18.021 0 0115 5.412m-.036 6.076A11.99 11.99 0 0112 11.5a11.99 11.99 0 00-2.964.388m0 0a3 3 0 11-4.242 4.243m4.242-4.242a3 3 0 104.243 4.242" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无翻译内容</h3>
              <p className="text-sm text-gray-500 mb-4">点击下方按钮创建翻译任务</p>
              <button
                onClick={handleCreateTranslation}
                disabled={creatingTranslation}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingTranslation ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    正在创建...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 3.04A18.022 18.022 0 006.412 9m6.088-6.088A18.021 18.021 0 0115 5.412m-.036 6.076A11.99 11.99 0 0112 11.5a11.99 11.99 0 00-2.964.388m0 0a3 3 0 11-4.242 4.243m4.242-4.242a3 3 0 104.243 4.242" />
                    </svg>
                    翻译为中文
                  </>
                )}
              </button>
              {translationError && (
                <div className="text-red-500 text-sm mt-2">获取翻译失败</div>
              )}
            </div>
          );
        }
        return (
          <TranslationView
            articleContent={articleContent}
            translationContent={translationContent}
            loadingTranslation={loadingTranslation}
            translationCopied={translationCopied}
            copyTranslation={copyTranslation}
            formatTweetTime={formatTweetTime}
          />
        );
      
      case 'markdown':
        return (
          <MarkdownView
            articleContent={articleContent}
            markdownContent={markdownContent}
            loadingMarkdown={loadingMarkdown}
            markdownCopied={markdownCopied}
            copyMarkdown={copyMarkdown}
            formatTweetTime={formatTweetTime}
          />
        );
      
      case 'rendered':
        return (
          <RenderedView
            articleContent={articleContent}
            markdownContent={markdownContent}
            loadingMarkdown={loadingMarkdown}
            formatTweetTime={formatTweetTime}
          />
        );
      
      case 'tags':
        // 如果没有标签内容，显示占位符和按钮
        if (!tagsContent && !loadingTags) {
          return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无标签</h3>
              <p className="text-sm text-gray-500 mb-4">点击下方按钮提取内容标签</p>
              <button
                onClick={handleCreateTags}
                disabled={creatingTags}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingTags ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    正在提取...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    提取标签
                  </>
                )}
              </button>
              {tagsError && (
                <div className="text-red-500 text-sm mt-2">获取标签失败</div>
              )}
            </div>
          );
        }
        return (
          <TagsView
            articleContent={articleContent}
            tagsContent={tagsContent}
            loadingTags={loadingTags}
            selectedHistoryId={parseInt(id)}
            checkTagsAvailable={() => mutateTags()}
          />
        );
      
      default:
        return null;
    }
  };
  
  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            加载失败
          </h3>
          <p className="text-sm text-gray-500">
            {error}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <ResizablePane
      rightPane={
        <div className="h-full flex flex-col">
          {/* 右面板顶部导航栏 */}
          <div className="px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center justify-end">
              <nav className="flex gap-4 items-center">
                <Link 
                  href="/extraction" 
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
                <Link
                  href="/extraction"
                  onClick={(e) => {
                    e.preventDefault();
                    // 触发侧边栏的快速提取按钮
                    const quickExtractBtn = document.querySelector('[data-quick-extract-trigger]') as HTMLButtonElement;
                    if (quickExtractBtn) {
                      quickExtractBtn.click();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  快速提取
                </Link>
              </nav>
            </div>
          </div>
          
          {/* 推文列表或回复区域 */}
          <div className="flex-1 overflow-y-auto">
          <SmartLoadingContainer
            loading={loadingArticle}
            skeleton={<RepliesViewSkeleton />}
            minHeight="400px"
            className=""
          >
            {articleContent && articleContent.replies ? (
              <RepliesView 
                replies={articleContent.replies}
                formatTweetTime={formatTweetTime}
                formatNumber={formatNumber}
              />
            ) : tweets.length > 0 && (
              <div className="p-4">
                <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-900">
                    {tweets.length} Posts
                  </h2>
                </div>
                
                <div className="bg-white rounded-b-lg shadow-sm divide-y divide-gray-100">
                  {tweets.map((tweet, index) => (
                    <article key={index} className="px-4 py-4 hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="flex gap-3">
                        <img 
                          src={tweet.author.avatar} 
                          alt={tweet.author.name}
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1 flex-wrap">
                            <span className="font-bold text-gray-900 hover:underline cursor-pointer">
                              {tweet.author.name}
                            </span>
                            <span className="text-gray-500 text-sm">{tweet.author.handle}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-500 text-sm hover:underline cursor-pointer">
                              {formatTweetTime(tweet.time)}
                            </span>
                          </div>
                          
                          <div 
                            className="mt-1 text-gray-800 whitespace-pre-wrap break-words tweet-content"
                            dangerouslySetInnerHTML={{ __html: tweet.content.text }}
                          />
                          
                          {tweet.media.items && tweet.media.items.length > 0 && (
                            <div className={`mt-3 grid gap-2 ${
                              tweet.media.items.length === 1 ? 'grid-cols-1' :
                              tweet.media.items.length === 2 ? 'grid-cols-2' :
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </SmartLoadingContainer>
          </div>
        </div>
      }
      leftPane={
        <div className="h-full flex flex-col">
          {/* Tab 切换按钮 */}
          {articleContent && (
            <div className="flex border-b border-gray-200 bg-white px-6">
              <button
                onClick={() => {
                  setActiveTab('translation');
                }}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'translation'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                翻译
              </button>
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
              <button
                onClick={() => setActiveTab('tags')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'tags'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                标签
              </button>
            </div>
          )}
          
          {/* 内容区域 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Tags 始终显示在内容顶部 */}
            {articleContent && tagsContent && tagsContent.tags && tagsContent.tags.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-nowrap gap-2 overflow-x-auto">
                  {tagsContent.tags.map((tag: string) => {
                    const colors = getTagColorClasses(tag);
                    return (
                      <span 
                        key={tag} 
                        className={`px-3 py-1 text-sm rounded-full border transition-colors flex-shrink-0 ${colors.bg} ${colors.text} ${colors.border} ${colors.hoverBg}`}
                        title={tag}
                      >
                        {getTagLabel(tag)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* 使用 SmartLoadingContainer 包裹内容 */}
            <SmartLoadingContainer
              loading={loadingArticle}
              skeleton={
                activeTab === 'translation' ? <TranslationViewSkeleton /> :
                activeTab === 'tags' ? <TagsViewSkeleton /> :
                activeTab === 'markdown' || activeTab === 'rendered' ? <GenericViewSkeleton title="Markdown加载中" /> :
                <ArticleViewSkeleton />
              }
              minHeight="400px"
              className=""
            >
              {articleContent && renderContentView()}
            </SmartLoadingContainer>
          </div>
        </div>
      }
      defaultLeftWidth={600}
      minLeftWidth={400}
      maxLeftWidth={800}
      storageKey="tweet-pane-width"
    />
  );
}