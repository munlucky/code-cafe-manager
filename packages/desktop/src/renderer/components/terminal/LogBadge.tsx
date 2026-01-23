/**
 * LogBadge Component
 * 로그 타입을 시각적으로 구분하는 배지 컴포넌트
 */

import {
  Wrench,
  CheckCircle,
  Sparkles,
  Terminal,
  User,
  AlertCircle,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type { LogBadgeType } from '../../types/terminal';

interface LogBadgeProps {
  type: LogBadgeType;
  toolName?: string;
  className?: string;
}

interface BadgeConfig {
  icon: LucideIcon;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const BADGE_CONFIGS: Record<LogBadgeType, BadgeConfig> = {
  tool: {
    icon: Wrench,
    label: 'Tool',
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
  },
  result: {
    icon: CheckCircle,
    label: 'Result',
    bgClass: 'bg-green-500/20',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/30',
  },
  ai: {
    icon: Sparkles,
    label: 'AI',
    bgClass: 'bg-purple-500/20',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
  },
  system: {
    icon: Terminal,
    label: 'System',
    bgClass: 'bg-gray-500/20',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-500/30',
  },
  user: {
    icon: User,
    label: 'User',
    bgClass: 'bg-yellow-500/20',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    bgClass: 'bg-red-500/20',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
  },
  thinking: {
    icon: Brain,
    label: 'Thinking',
    bgClass: 'bg-indigo-500/20',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30',
  },
};

export function LogBadge({ type, toolName, className }: LogBadgeProps): JSX.Element {
  const config = BADGE_CONFIGS[type];
  const Icon = config.icon;
  const displayLabel = type === 'tool' && toolName ? toolName : config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border',
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[80px]">{displayLabel}</span>
    </span>
  );
}
