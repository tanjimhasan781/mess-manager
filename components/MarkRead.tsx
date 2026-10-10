'use client';
import { useEffect } from 'react';
import { markAllReadAction } from '@/app/actions';

export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) markAllReadAction();
  }, [unread]);
  return null;
}
