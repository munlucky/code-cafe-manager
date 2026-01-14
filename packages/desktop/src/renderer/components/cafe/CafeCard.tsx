/**
 * CafeCard Component
 * Displays a single Cafe card in the Global Lobby
 */

import type { Cafe } from '@codecafe/core';
import { Coffee, Folder, GitBranch, Activity } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

interface CafeCardProps {
  cafe: Cafe;
  onClick: (cafe: Cafe) => void;
  onDelete?: (cafe: Cafe) => void;
}

export function CafeCard({ cafe, onClick, onDelete }: CafeCardProps): JSX.Element {
  const handleClick = () => {
    onClick(cafe);
  };

  const handleDelete = onDelete
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(cafe);
      }
    : undefined;

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-colors group',
        'hover:border-coffee'
      )}
      onClick={handleClick}
    >
      <CafeHeader name={cafe.name} onDelete={handleDelete} />

      <CafePath path={cafe.path} />

      <CafeStatus currentBranch={cafe.currentBranch} isDirty={cafe.isDirty} />

      <CafeActivity activeOrders={cafe.activeOrders} />

      <CafeFooter createdAt={cafe.createdAt} />
    </Card>
  );
}

interface CafeHeaderProps {
  name: string;
  onDelete?: (e: React.MouseEvent) => void;
}

function CafeHeader({ name, onDelete }: CafeHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <Coffee className="w-5 h-5 text-coffee" />
        <h3 className="font-semibold text-bone truncate">{name}</h3>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'text-gray-400 hover:text-red-400',
            'text-xs px-2 py-1'
          )}
          title="Delete Cafe"
        >
          Delete
        </button>
      )}
    </div>
  );
}

interface CafePathProps {
  path: string;
}

function CafePath({ path }: CafePathProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
      <Folder className="w-4 h-4 flex-shrink-0" />
      <span className="truncate" title={path}>
        {path}
      </span>
    </div>
  );
}

interface CafeStatusProps {
  currentBranch: string;
  isDirty: boolean;
}

function CafeStatus({ currentBranch, isDirty }: CafeStatusProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 mb-3 text-sm">
      <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-bone truncate">{currentBranch}</span>
      {isDirty && (
        <Badge variant="warning" className="ml-auto">
          Dirty
        </Badge>
      )}
    </div>
  );
}

interface CafeActivityProps {
  activeOrders: number;
}

function CafeActivity({ activeOrders }: CafeActivityProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Activity className="w-4 h-4 text-gray-400" />
      <span className="text-gray-300">
        {activeOrders} active {activeOrders === 1 ? 'order' : 'orders'}
      </span>
    </div>
  );
}

interface CafeFooterProps {
  createdAt: string | Date;
}

function CafeFooter({ createdAt }: CafeFooterProps): JSX.Element {
  return (
    <div className="mt-3 text-xs text-gray-500">
      Added {new Date(createdAt).toLocaleDateString()}
    </div>
  );
}
