import { useEffect, useState } from 'react';
import { useBaristas } from '../../hooks/useBaristas';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { ProviderType } from '../../types/models';

export function Baristas() {
  const { baristas, fetchBaristas, createBarista } = useBaristas();
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('claude-code');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchBaristas();
  }, []);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createBarista(selectedProvider);
      await fetchBaristas();
    } catch (error) {
      console.error('Failed to create barista:', error);
      alert(`Failed to create barista: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (baristas.length === 0) {
    return (
      <Card className="max-w-2xl">
        <EmptyState message="No baristas running">
          <div className="space-y-4">
            <div>
              <label className="block text-coffee mb-2">Select Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as ProviderType)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
              >
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
              </select>
            </div>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Barista'}
            </Button>
          </div>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">All Baristas</h3>
        <div className="space-y-3">
          {baristas.map((barista) => (
            <div
              key={barista.id}
              className="flex items-center justify-between p-4 bg-background rounded border border-border"
            >
              <div>
                <strong className="text-bone text-lg">{barista.provider}</strong>
                <div className="text-sm text-gray-500 mt-1">ID: {barista.id}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Current Order: {barista.currentOrderId || 'None'}
                </div>
              </div>
              <StatusBadge status={barista.status} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="max-w-md">
        <h3 className="text-lg font-bold mb-4 text-coffee">Create New Barista</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-coffee mb-2">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as ProviderType)}
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
            >
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Barista'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
