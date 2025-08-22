'use client';

import { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import Link from 'next/link';

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

export default function DashboardPage() {
  const [url, setUrl] = useState('');
  const [scrollTimes, setScrollTimes] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
      
    } catch (err: any) {
      setError(err.message || '提交任务失败');
      setLoading(false);
    }
  };

  // 轮询队列状态
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/queue/status');
        const data = await res.json();
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
    <main className="h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header - 横贯屏幕 */}
      <div className="w-full px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <h1 className="text-base font-bold text-gray-900">Best-X</h1>
            <span className="text-gray-400">·</span>
            <p className="text-xs text-gray-600">控制台</p>
          </div>
          <nav className="flex gap-4">
            <Link 
              href="/" 
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              主页
            </Link>
            <Link 
              href="/dashboard" 
              className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5"
            >
              控制台
            </Link>
          </nav>
        </div>
      </div>

      {/* Dashboard with max width container */}
      <div className="h-[calc(100vh-52px)] flex justify-center bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-4xl">
          <Dashboard
            url={url}
            setUrl={setUrl}
            scrollTimes={scrollTimes}
            setScrollTimes={setScrollTimes}
            loading={loading}
            loadingHistory={false}
            error={error}
            fetchTweets={fetchTweets}
            queueStatus={queueStatus}
            selectedFilter={selectedFilter}
            setSelectedFilter={setSelectedFilter}
          />
        </div>
      </div>
    </main>
  );
}