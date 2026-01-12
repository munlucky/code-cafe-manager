/**
 * CafeCard Component
 * Displays a single Cafe card in the Global Lobby
 */

import type { Cafe } from '@codecafe/core';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Coffee, Folder, GitBranch, Activity } from 'lucide-react';

interface CafeCardProps {
  cafe: Cafe;
  onClick: (cafe: Cafe) => void;
  onDelete?: (cafe: Cafe) => void;
}

export function CafeCard({ cafe, onClick, onDelete }: CafeCardProps) {
  const handleClick = () => {
    onClick(cafe);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(cafe);
    }
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:border-coffee transition-colors group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coffee className="w-5 h-5 text-coffee" />
          <h3 className="font-semibold text-bone truncate">{cafe.name}</h3>
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 text-xs px-2 py-1"
            title="Delete Cafe"
          >
            Delete
          </button>
        )}
      </div>

      {/* Path */}
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="truncate" title={cafe.path}>
          {cafe.path}
        </span>
      </div>

      {/* Branch */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-bone truncate">{cafe.currentBranch}</span>
        {cafe.isDirty && (
          <Badge variant="warning" className="ml-auto">
            Dirty
          </Badge>
        )}
      </div>

      {/* Active Orders */}
      <div className="flex items-center gap-2 text-sm">
        <Activity className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300">
          {cafe.activeOrders} active {cafe.activeOrders === 1 ? 'order' : 'orders'}
        </span>
      </div>

      {/* Created Date */}
      <div className="mt-3 text-xs text-gray-500">
        Added {new Date(cafe.createdAt).toLocaleDateString()}
      </div>
    </Card>
  );
}
