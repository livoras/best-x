'use client';

import React from 'react';

interface GenericViewSkeletonProps {
  title?: string;
}

export default function GenericViewSkeleton({ title = "内容加载中" }: GenericViewSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="w-12 h-12 bg-gray-200 rounded-full"/>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-32 mb-2"/>
          <div className="h-4 bg-gray-200 rounded w-24"/>
        </div>
        <div className="ml-auto text-right">
          <div className="h-4 bg-gray-200 rounded w-20 ml-auto mb-1"/>
          <div className="h-3 bg-gray-200 rounded w-24 ml-auto"/>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        {/* Heading */}
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"/>
        
        {/* Paragraphs */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-11/12"/>
          <div className="h-4 bg-gray-200 rounded w-10/12"/>
        </div>

        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-9/12"/>
          <div className="h-4 bg-gray-200 rounded w-10/12"/>
          <div className="h-4 bg-gray-200 rounded w-8/12"/>
        </div>

        {/* Code block skeleton */}
        <div className="bg-gray-100 rounded-lg p-4 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4"/>
          <div className="h-3 bg-gray-200 rounded w-5/6"/>
          <div className="h-3 bg-gray-200 rounded w-2/3"/>
        </div>

        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-10/12"/>
          <div className="h-4 bg-gray-200 rounded w-11/12"/>
          <div className="h-4 bg-gray-200 rounded w-9/12"/>
        </div>
      </div>
    </div>
  );
}