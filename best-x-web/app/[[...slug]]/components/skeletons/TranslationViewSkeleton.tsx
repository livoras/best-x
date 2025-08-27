'use client';

import React from 'react';

export default function TranslationViewSkeleton() {
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

      {/* Language Toggle Skeleton */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          <div className="h-8 w-20 bg-gray-200 rounded"/>
          <div className="h-8 w-20 bg-gray-100 rounded ml-1"/>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="space-y-6">
        {/* First paragraph */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-11/12"/>
          <div className="h-4 bg-gray-200 rounded w-10/12"/>
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-9/12"/>
        </div>

        {/* Second paragraph */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-10/12"/>
          <div className="h-4 bg-gray-200 rounded w-11/12"/>
        </div>

        {/* List items */}
        <div className="space-y-2 pl-4">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full mt-2"/>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"/>
              <div className="h-4 bg-gray-200 rounded w-4/5"/>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full mt-2"/>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"/>
            </div>
          </div>
        </div>

        {/* Third paragraph */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"/>
          <div className="h-4 bg-gray-200 rounded w-11/12"/>
          <div className="h-4 bg-gray-200 rounded w-9/12"/>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="h-3 bg-gray-200 rounded w-48"/>
      </div>
    </div>
  );
}