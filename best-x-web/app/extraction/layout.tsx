'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import HistoryItem from '../components/sidebar/HistoryItem';
import { preloadExtraction } from '../lib/prefetch';
import { QueueContext } from './QueueContext';

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
  allTasks: any[];
}

export default function ExtractionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [history, setHistory] = useState<ExtractionRecord[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    summary: { pending: 0, processing: 0, completed: 0, failed: 0 },
    currentTask: null,
    queue: [],
    recent: [],
    allTasks: []
  });
  const [showQuickExtract, setShowQuickExtract] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickScrollTimes, setQuickScrollTimes] = useState(10);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');
  
  const previousCompletedRef = useRef<number>(0);
  
  // 获取当前选中的 ID
  const selectedId = pathname.match(/^\/extraction\/(\d+)/)?.[1];
  const selectedIdNumber = selectedId ? parseInt(selectedId) : null;
  
  // 辅助函数：去除HTML标签
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  
  // 获取历史记录
  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/extractions?limit=20');
      const data = await res.json();
      const extractions = data.extractions || [];
      setHistory(extractions);
      return extractions;
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
    }
  };
  
  // 导航到历史记录项
  const loadHistoryItem = (id: number) => {
    router.push(`/extraction/${id}`);
  };
  
  // 快速提取
  const handleQuickExtract = async () => {
    if (!quickUrl) {
      setQuickError('请输入推文链接');
      return;
    }
    
    setQuickLoading(true);
    setQuickError('');
    
    try {
      const response = await fetch('http://localhost:3001/api/fetch-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: quickUrl,
          scrollTimes: quickScrollTimes
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '提取失败');
      }
      
      // 关闭模态框
      setShowQuickExtract(false);
      setQuickUrl('');
      
      // 刷新历史记录
      await fetchHistory();
    } catch (error: any) {
      setQuickError(error.message || '提取失败，请重试');
    } finally {
      setQuickLoading(false);
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
          // 刷新历史记录列表
          await fetchHistory();
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
  
  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Layout */}
      <div className="flex h-screen">
        {/* Sidebar - History (永不重渲染) */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* Brand Area */}
          <div className="px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <h1 className="text-base font-bold text-gray-900">Best-X</h1>
              <span className="text-gray-400">·</span>
              <p className="text-xs text-gray-600">第一手高质量信息</p>
            </div>
          </div>
          
          {/* History List */}
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
            {history.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                暂无历史记录
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onMouseEnter={() => {
                    // 鼠标悬停时预加载数据
                    if (item.id !== selectedIdNumber) {
                      preloadExtraction(item.id);
                    }
                  }}
                >
                  <HistoryItem
                    item={item}
                    isSelected={selectedIdNumber === item.id}
                    onClick={() => loadHistoryItem(item.id)}
                    stripHtml={stripHtml}
                  />
                </div>
              ))
            )}
          </div>
          
          {/* Quick Extract Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              data-quick-extract-trigger
              onClick={() => setShowQuickExtract(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              快速提取
            </button>
          </div>
        </div>
        
        {/* Content Area (children) */}
        <div className="flex-1 overflow-hidden flex">
          <QueueContext.Provider value={{ queueStatus }}>
            {children}
          </QueueContext.Provider>
        </div>
      </div>
      
      {/* Quick Extract Modal */}
      {showQuickExtract && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
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
            
            {/* Modal Content */}
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
                  max="30"
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
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowQuickExtract(false);
                  setQuickUrl('');
                  setQuickError('');
                }}
                className="px-4 py-2 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-md transition-colors"
                disabled={quickLoading}
              >
                取消
              </button>
              <button
                onClick={handleQuickExtract}
                disabled={quickLoading || !quickUrl}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {quickLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    提取中...
                  </>
                ) : '开始提取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}