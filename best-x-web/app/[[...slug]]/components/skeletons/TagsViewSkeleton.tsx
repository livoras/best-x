'use client';

import React from 'react';

export default function TagsViewSkeleton() {
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

      <div className="space-y-6">
        {/* Tags Section */}
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-3"/>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 bg-gray-200 rounded-full w-20"/>
            <div className="h-8 bg-gray-200 rounded-full w-24"/>
            <div className="h-8 bg-gray-200 rounded-full w-16"/>
            <div className="h-8 bg-gray-200 rounded-full w-28"/>
            <div className="h-8 bg-gray-200 rounded-full w-20"/>
            <div className="h-8 bg-gray-200 rounded-full w-24"/>
          </div>
        </div>

        {/* Reasons Section */}
        <div>
          <div className="h-4 bg-gray-200 rounded w-20 mb-3"/>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-6 bg-gray-200 rounded w-16"/>
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-full"/>
                <div className="h-4 bg-gray-200 rounded w-3/4"/>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 bg-gray-200 rounded w-20"/>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-5/6"/>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 bg-gray-200 rounded w-18"/>
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-full"/>
                <div className="h-4 bg-gray-200 rounded w-2/3"/>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100">
          <div className="h-3 bg-gray-200 rounded w-40"/>
        </div>
      </div>
    </div>
  );
}