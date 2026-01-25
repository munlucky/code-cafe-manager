/**
 * Hook for tracking stage progress and timeline events
 * Handles stage start/complete/fail events from order output
 */

import { useState, useEffect, useCallback } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import type { TimelineEvent } from '../components/orders/OrderTimelineView';

interface StageResult {
  stageId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface OrderOutputEvent {
  orderId: string;
  type: string;
  content: string;
  timestamp: string;
  stageInfo?: {
    stageId: string;
    status?: 'completed' | 'failed';
    duration?: number;
    error?: string;
  };
}

export function useStageTracking() {
  const [stageResults, setStageResults] = useState<
    Record<string, Record<string, StageResult>>
  >({});
  const [timelineEvents, setTimelineEvents] = useState<
    Record<string, TimelineEvent[]>
  >({});

  const { appendOrderLog } = useOrderStore();

  // Helper: update stage end state (DRY)
  const updateStageEndState = useCallback(
    (
      orderId: string,
      stageId: string,
      status: 'completed' | 'failed',
      timestamp: string,
      details?: { duration?: number; error?: string }
    ) => {
      setStageResults((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [stageId]: {
            ...(prev[orderId]?.[stageId] || { stageId }),
            status,
            completedAt: timestamp,
            ...(details?.error && { error: details.error }),
          },
        },
      }));

      setTimelineEvents((prev) => ({
        ...prev,
        [orderId]: [
          ...(prev[orderId] || []),
          {
            id: crypto.randomUUID(),
            type: status === 'completed' ? 'stage_complete' : 'stage_fail',
            timestamp,
            content:
              status === 'completed'
                ? `Stage completed${details?.duration ? ` in ${details.duration}ms` : ''}`
                : details?.error || 'Stage failed',
            stageName: stageId,
          },
        ],
      }));
    },
    []
  );

  useEffect(() => {
    // Subscribe to stage started events
    const cleanupStageStarted = window.codecafe.order.onStageStarted(
      (data: { orderId: string; stageId: string }) => {
        const timestamp = new Date().toISOString();
        setStageResults((prev) => ({
          ...prev,
          [data.orderId]: {
            ...(prev[data.orderId] || {}),
            [data.stageId]: {
              stageId: data.stageId,
              status: 'running',
              startedAt: timestamp,
            },
          },
        }));
        setTimelineEvents((prev) => ({
          ...prev,
          [data.orderId]: [
            ...(prev[data.orderId] || []),
            {
              id: crypto.randomUUID(),
              type: 'stage_start',
              timestamp,
              content: 'Stage started',
              stageName: data.stageId,
            },
          ],
        }));
      }
    );

    // Subscribe to order output events for stage completion
    const cleanupOrderOutput = window.codecafe.order.onOutput(
      (event: OrderOutputEvent) => {
        const {
          orderId,
          type: outputType,
          content,
          timestamp: eventTimestamp,
          stageInfo,
        } = event;

        // Handle stage_end type
        if (outputType === 'stage_end' && stageInfo) {
          const timestamp = eventTimestamp || new Date().toISOString();
          const status =
            stageInfo.status === 'completed' ? 'completed' : 'failed';
          updateStageEndState(orderId, stageInfo.stageId, status, timestamp, {
            duration: stageInfo.duration,
            error: stageInfo.error,
          });
        }

        // Log storage
        if (content) {
          let logType: 'info' | 'error' | 'success' | 'warning' = 'info';
          if (typeof content === 'string') {
            const lowerContent = content.toLowerCase();
            if (
              lowerContent.includes('error') ||
              lowerContent.includes('failed')
            ) {
              logType = 'error';
            } else if (
              lowerContent.includes('success') ||
              lowerContent.includes('completed')
            ) {
              logType = 'success';
            } else if (lowerContent.includes('warning')) {
              logType = 'warning';
            }
          }
          appendOrderLog(orderId, {
            timestamp: eventTimestamp || new Date().toISOString(),
            type: logType,
            message:
              typeof content === 'string' ? content : JSON.stringify(content),
          });
        }
      }
    );

    return () => {
      cleanupStageStarted();
      cleanupOrderOutput();
    };
  }, [appendOrderLog, updateStageEndState]);

  return { stageResults, timelineEvents };
}
