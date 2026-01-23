/**
 * MessageBlock Component
 * 사용자/어시스턴트 메시지를 구분하여 렌더링하는 컴포넌트
 */

import { User, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InteractionGroup } from '../../types/terminal';
import { MarkdownContentRenderer } from './MarkdownContentRenderer';

interface MessageBlockProps {
  group: InteractionGroup;
  className?: string;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBlock({ group, className }: MessageBlockProps): JSX.Element {
  const isUser = group.type === 'user';
  const timestamp = group.timestampRange?.start
    ? formatTimestamp(group.timestampRange.start)
    : '';

  // user 타입: 우측 정렬, 말풍선 스타일
  if (isUser) {
    return (
      <div className={cn('flex justify-end my-3', className)}>
        <div className="max-w-[80%] flex flex-col items-end gap-1">
          {/* 메시지 헤더 */}
          <div className="flex items-center gap-2 text-[10px] text-cafe-600">
            <span>{timestamp}</span>
            <div className="flex items-center gap-1 text-yellow-400">
              <User className="w-3 h-3" />
              <span>User</span>
            </div>
          </div>

          {/* 메시지 콘텐츠 - 말풍선 스타일 */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl rounded-tr-sm px-4 py-2">
            {group.entries.map((entry) => (
              <div key={entry.id} className="text-xs text-cafe-200 whitespace-pre-wrap break-all">
                {entry.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // assistant 타입: 좌측 정렬, 폴딩 없이 항상 전체 표시
  return (
    <div className={cn('flex justify-start my-3', className)}>
      <div className="max-w-[90%] flex flex-col items-start gap-1">
        {/* 메시지 헤더 */}
        <div className="flex items-center gap-2 text-[10px] text-cafe-600">
          <div className="flex items-center gap-1 text-purple-400">
            <Sparkles className="w-3 h-3" />
            <span>Assistant</span>
          </div>
          <span>{timestamp}</span>
        </div>

        {/* 메시지 콘텐츠 - 폴딩 없이 전체 표시 */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-3 w-full space-y-3">
          {group.entries.map((entry) => (
            <MarkdownContentRenderer
              key={entry.id}
              content={entry.content}
              textSize="text-sm"
              textColor="text-cafe-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
