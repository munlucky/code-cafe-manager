/**
 * JSONViewer Component
 * JSON 데이터를 구문 강조와 함께 표시하는 컴포넌트
 * 인라인 배지 스타일로 접었다 펼칠 수 있음
 */

import { useState } from 'react';
import { cn } from '../../utils/cn';

interface JSONViewerProps {
  data: unknown;
  maxDepth?: number;
  className?: string;
  /** 라벨 (생략 시 자동 생성) */
  label?: string;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
}

const MAX_ARRAY_ITEMS = 5;
const MAX_OBJECT_KEYS = 5;

type JSONValueType = 'null' | 'boolean' | 'number' | 'string' | 'key';

const VALUE_COLORS: Record<JSONValueType, string> = {
  null: 'text-orange-400',
  boolean: 'text-purple-400',
  number: 'text-blue-400',
  string: 'text-green-400',
  key: 'text-yellow-400',
};

function renderValue(
  value: unknown,
  depth: number,
  maxDepth: number,
  indent: number
): JSX.Element {
  const indentStr = '  '.repeat(indent);

  // Max depth reached
  if (depth > maxDepth) {
    return <span className="text-cafe-500">...</span>;
  }

  // null
  if (value === null) {
    return <span className={VALUE_COLORS.null}>null</span>;
  }

  // undefined
  if (value === undefined) {
    return <span className={VALUE_COLORS.null}>undefined</span>;
  }

  // boolean
  if (typeof value === 'boolean') {
    return (
      <span className={VALUE_COLORS.boolean}>{value ? 'true' : 'false'}</span>
    );
  }

  // number
  if (typeof value === 'number') {
    return <span className={VALUE_COLORS.number}>{String(value)}</span>;
  }

  // string
  if (typeof value === 'string') {
    const displayValue =
      value.length > 100 ? `${value.slice(0, 100)}...` : value;
    const escaped = displayValue
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    return <span className={VALUE_COLORS.string}>"{escaped}"</span>;
  }

  // array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-cafe-400">[]</span>;
    }

    const isTruncated = value.length > MAX_ARRAY_ITEMS;
    const displayItems = isTruncated ? value.slice(0, MAX_ARRAY_ITEMS) : value;

    return (
      <span>
        <span className="text-cafe-400">[</span>
        {'\n'}
        {displayItems.map((item, idx) => (
          <span key={idx}>
            {indentStr}  {renderValue(item, depth + 1, maxDepth, indent + 1)}
            {idx < displayItems.length - 1 && ','}
            {'\n'}
          </span>
        ))}
        {isTruncated && (
          <span>
            {indentStr}  <span className="text-cafe-500">... {value.length - MAX_ARRAY_ITEMS} more items</span>
            {'\n'}
          </span>
        )}
        {indentStr}<span className="text-cafe-400">]</span>
      </span>
    );
  }

  // object
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) {
      return <span className="text-cafe-400">{'{}'}</span>;
    }

    const isTruncated = keys.length > MAX_OBJECT_KEYS;
    const displayKeys = isTruncated ? keys.slice(0, MAX_OBJECT_KEYS) : keys;

    return (
      <span>
        <span className="text-cafe-400">{'{'}</span>
        {'\n'}
        {displayKeys.map((key, idx) => (
          <span key={key}>
            {indentStr}  <span className={VALUE_COLORS.key}>"{key}"</span>
            <span className="text-cafe-400">: </span>
            {renderValue(
              (value as Record<string, unknown>)[key],
              depth + 1,
              maxDepth,
              indent + 1
            )}
            {idx < displayKeys.length - 1 && ','}
            {'\n'}
          </span>
        ))}
        {isTruncated && (
          <span>
            {indentStr}  <span className="text-cafe-500">... {keys.length - MAX_OBJECT_KEYS} more keys</span>
            {'\n'}
          </span>
        )}
        {indentStr}<span className="text-cafe-400">{'}'}</span>
      </span>
    );
  }

  // fallback
  return <span className="text-cafe-400">{String(value)}</span>;
}

function generateLabel(data: unknown): string {
  if (data && typeof data === 'object') {
    if ('type' in data && typeof (data as Record<string, unknown>).type === 'string') {
      return `Message: ${(data as Record<string, unknown>).type}`;
    }
    if ('tool' in data && typeof (data as Record<string, unknown>).tool === 'string') {
      return `Tool: ${(data as Record<string, unknown>).tool}`;
    }
  }
  return 'JSON Data';
}

function countFields(data: unknown): number {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return Object.keys(data as Record<string, unknown>).length;
  }
  if (Array.isArray(data)) {
    return data.length;
  }
  return 0;
}

export function JSONViewer({
  data,
  maxDepth = 3,
  className,
  label,
  defaultExpanded = false,
}: JSONViewerProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const displayLabel = label || generateLabel(data);
  const fieldCount = countFields(data);

  return (
    <div className={cn('mt-1 mb-2', className)}>
      {/* Inline Badge - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-2 px-2 py-1 rounded border text-xs font-mono cursor-pointer transition-all',
          expanded
            ? 'border-brand/30 bg-brand/5'
            : 'border-cafe-800 bg-cafe-900/50 hover:border-brand/30'
        )}
      >
        <span className="text-cafe-500 text-[10px]">{expanded ? '▼' : '▶'}</span>
        <span className="text-brand-light">{displayLabel}</span>
        <span className="text-cafe-600 text-[10px]">{fieldCount} fields</span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-2 p-3 bg-black/30 rounded border border-cafe-800 overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <pre className="text-[10px] font-mono text-cafe-400 leading-normal whitespace-pre">
            {renderValue(data, 0, maxDepth, 0)}
          </pre>
        </div>
      )}
    </div>
  );
}
