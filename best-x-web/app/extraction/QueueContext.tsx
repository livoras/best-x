'use client';

import { createContext, useContext } from 'react';

interface QueueStatus {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

interface QueueContextType {
  queueStatus: QueueStatus;
}

export const QueueContext = createContext<QueueContextType | null>(null);

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    return { queueStatus: { summary: { pending: 0, processing: 0, completed: 0, failed: 0 } } };
  }
  return context;
};