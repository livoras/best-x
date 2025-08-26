'use client';

import { useState } from 'react';
import { MAX_SCROLLS } from '@/lib/consts';

// 任务接口
interface Task {
  task_id: string;
  type?: 'extract' | 'translate' | 'summary';  // 任务类型
  url: string;
  params?: string;  // JSON格式的参数
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;  // progress_message 字段
  priority?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  elapsed?: number;
  result_id?: number;  // 关联的extraction ID
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
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface DashboardProps {
  url: string;
  setUrl: (url: string) => void;
  scrollTimes: number;
  setScrollTimes: (times: number) => void;
  loading: boolean;
  loadingHistory: boolean;
  error: string;
  fetchTweets: () => void;
  queueStatus: QueueStatus;
  selectedFilter: 'all' | 'processing' | 'pending' | 'completed' | 'failed';
  setSelectedFilter: (filter: 'all' | 'processing' | 'pending' | 'completed' | 'failed') => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
}

export default function Dashboard({
  url,
  setUrl,
  scrollTimes,
  setScrollTimes,
  loading,
  loadingHistory,
  error,
  fetchTweets,
  queueStatus,
  selectedFilter,
  setSelectedFilter,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize
}: DashboardProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="p-6 space-y-4">
        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">提取推文</h3>
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
                max={MAX_SCROLLS}
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

        {/* Queue Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">任务队列</h3>
          
          {/* Filter Tabs - Pill Style */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => {
                setSelectedFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'all' 
                  ? 'bg-gray-800 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>全部</span>
              <span className={`font-bold ${selectedFilter === 'all' ? 'text-white' : 'text-gray-900'}`}>
                {queueStatus.summary.pending + queueStatus.summary.processing + queueStatus.summary.completed + queueStatus.summary.failed}
              </span>
            </button>
            <button
              onClick={() => {
                setSelectedFilter('processing');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'processing' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <span>进行中</span>
              <span className={`font-bold ${selectedFilter === 'processing' ? 'text-white' : 'text-blue-700'}`}>
                {queueStatus.summary.processing}
              </span>
            </button>
            <button
              onClick={() => {
                setSelectedFilter('pending');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'pending' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              <span>排队中</span>
              <span className={`font-bold ${selectedFilter === 'pending' ? 'text-white' : 'text-amber-700'}`}>
                {queueStatus.summary.pending}
              </span>
            </button>
            <button
              onClick={() => {
                setSelectedFilter('completed');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'completed' 
                  ? 'bg-green-500 text-white shadow-sm' 
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              <span>已完成</span>
              <span className={`font-bold ${selectedFilter === 'completed' ? 'text-white' : 'text-green-700'}`}>
                {queueStatus.summary.completed}
              </span>
            </button>
            <button
              onClick={() => {
                setSelectedFilter('failed');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === 'failed' 
                  ? 'bg-red-500 text-white shadow-sm' 
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <span>失败</span>
              <span className={`font-bold ${selectedFilter === 'failed' ? 'text-white' : 'text-red-700'}`}>
                {queueStatus.summary.failed}
              </span>
            </button>
          </div>
          
          {/* Unified Task List */}
          <div className="space-y-2">
            {(() => {
              // 筛选任务
              const filteredTasks = queueStatus.allTasks?.filter(task => 
                selectedFilter === 'all' || task.status === selectedFilter
              ) || [];
              
              if (filteredTasks.length === 0) {
                // 空状态
                return (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">
                      {selectedFilter === 'all' ? '暂无任务' : 
                       selectedFilter === 'processing' ? '没有正在处理的任务' :
                       selectedFilter === 'pending' ? '没有排队中的任务' :
                       selectedFilter === 'completed' ? '没有已完成的任务' :
                       '没有失败的任务'}
                    </p>
                  </div>
                );
              }
              
              // 渲染任务列表
              return filteredTasks.map((task) => {
                // 解析任务参数
                let taskParams: any = {};
                try {
                  if (task.params) {
                    taskParams = JSON.parse(task.params);
                  }
                } catch (e) {
                  // 忽略解析错误
                }

                // 获取任务类型显示
                const getTaskTypeDisplay = () => {
                  switch (task.type || 'extract') {
                    case 'extract':
                      return { label: '提取', color: 'bg-blue-100 text-blue-700', icon: '📥' };
                    case 'translate':
                      return { label: '翻译', color: 'bg-purple-100 text-purple-700', icon: '🌐' };
                    case 'summary':
                      return { label: '摘要', color: 'bg-yellow-100 text-yellow-700', icon: '📝' };
                    default:
                      return { label: '任务', color: 'bg-gray-100 text-gray-700', icon: '📋' };
                  }
                };

                const taskTypeInfo = getTaskTypeDisplay();

                return (
                  <div key={task.task_id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* 状态图标、任务类型和URL */}
                        <div className="flex items-center gap-2 mb-1">
                          {task.status === 'completed' && <span className="text-green-500">✓</span>}
                          {task.status === 'failed' && <span className="text-red-500">✗</span>}
                          {task.status === 'processing' && (
                            <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {task.status === 'pending' && <span className="text-gray-400">⏳</span>}
                          
                          {/* 任务类型标签 */}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskTypeInfo.color}`}>
                            {taskTypeInfo.icon} {taskTypeInfo.label}
                          </span>
                          
                          {/* 显示URL或任务描述 */}
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {task.type === 'translate' && taskParams.extractionId 
                              ? `#${taskParams.extractionId} → ${taskParams.targetLang || '中文'}`
                              : task.url || '无URL'}
                          </span>
                        </div>
                      
                      {/* 进度条（仅处理中任务） */}
                      {task.status === 'processing' && task.progress !== undefined && (
                        <div className="mb-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {task.message || '处理中...'} - {task.elapsed ? `${Math.floor(task.elapsed)}秒` : ''}
                          </div>
                        </div>
                      )}
                      
                      {/* 任务结果（仅完成任务） */}
                      {task.status === 'completed' && task.message && (() => {
                        try {
                          const result = JSON.parse(task.message);
                          if (task.type === 'extract') {
                            return (
                              <div className="text-xs text-green-600 mt-1">
                                ✅ 成功提取 {result.tweetCount || 0} 条推文
                              </div>
                            );
                          } else if (task.type === 'translate') {
                            return (
                              <div className="text-xs text-green-600 mt-1">
                                ✅ 已翻译为{result.targetLang || '中文'}
                                {result.outputFile && (
                                  <span className="text-gray-500"> • 保存至: {result.outputFile.split('/').pop()}</span>
                                )}
                              </div>
                            );
                          }
                        } catch (e) {
                          // 如果不是JSON，直接显示消息
                          return null;
                        }
                      })()}
                      
                      {/* 错误信息（仅失败任务） */}
                      {task.status === 'failed' && task.error && (
                        <div className="text-xs text-red-600 mt-1">{task.error}</div>
                      )}
                      
                      {/* 时间戳 */}
                      <div className="text-xs text-gray-400 mt-1">
                        {task.status === 'completed' && task.completedAt && 
                          `完成于 ${new Date(task.completedAt).toLocaleTimeString()}`}
                        {task.status === 'failed' && task.completedAt && 
                          `失败于 ${new Date(task.completedAt).toLocaleTimeString()}`}
                        {task.status === 'pending' && task.createdAt && 
                          `创建于 ${new Date(task.createdAt).toLocaleTimeString()}`}
                        {task.status === 'processing' && task.startedAt && 
                          `开始于 ${new Date(task.startedAt).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>
                </div>
                );
              });
            })()}
          </div>
          
          {/* 分页控件 */}
          {queueStatus.pagination && queueStatus.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  上一页
                </button>
                
                {/* 页码按钮 */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, queueStatus.pagination.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded-md transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {queueStatus.pagination.totalPages > 5 && (
                    <>
                      <span className="px-2 text-gray-400">...</span>
                      <button
                        onClick={() => setCurrentPage(queueStatus.pagination!.totalPages)}
                        className={`w-8 h-8 text-sm rounded-md transition-colors ${
                          currentPage === queueStatus.pagination.totalPages
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {queueStatus.pagination.totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setCurrentPage(Math.min(queueStatus.pagination!.totalPages, currentPage + 1))}
                  disabled={currentPage === queueStatus.pagination.totalPages}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentPage === queueStatus.pagination.totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  下一页
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  第 {currentPage} 页，共 {queueStatus.pagination.totalPages} 页
                </span>
                
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}