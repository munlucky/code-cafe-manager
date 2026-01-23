/**
 * JSONViewer Component
 * JSON 데이터를 구문 강조와 함께 표시하는 컴포넌트
 */

import { cn } from '../../utils/cn';

interface JSONViewerProps {
  data: unknown;
  maxDepth?: number;
  className?: string;
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

export function JSONViewer({
  data,
  maxDepth = 3,
  className,
}: JSONViewerProps): JSX.Element {
  return (
    <pre
      className={cn(
        'font-mono text-xs p-3 overflow-x-auto whitespace-pre',
        className
      )}
    >
      {renderValue(data, 0, maxDepth, 0)}
    </pre>
  );
}
