import { useState, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ProviderInfo } from '../../types/window';
import type { ProviderType } from '../../types/models';

interface NewOrderProps {
  onSuccess?: () => void;
}

export function NewOrder({ onSuccess }: NewOrderProps) {
  const { createOrder } = useOrders();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    provider: 'claude-code' as ProviderType,
    recipeName: '',
    counter: '.',
    vars: '{}',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await window.codecafe.getAvailableProviders();
      setProviders(data);
      if (data.length > 0) {
        setFormData((prev) => ({ ...prev, provider: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let vars = {};
    if (formData.vars.trim()) {
      try {
        vars = JSON.parse(formData.vars);
      } catch (error) {
        alert('Invalid JSON in variables field');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await createOrder({
        recipeId: formData.recipeName,
        recipeName: formData.recipeName,
        counter: formData.counter,
        provider: formData.provider,
        vars,
      });

      alert('Order created successfully!');

      // Reset form
      setFormData({
        provider: formData.provider,
        recipeName: '',
        counter: '.',
        vars: '{}',
      });

      onSuccess?.();
    } catch (error) {
      alert(`Failed to create order: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <h3 className="text-xl font-bold mb-6 text-coffee">Create New Order</h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-coffee mb-2">Provider</label>
          <select
            value={formData.provider}
            onChange={(e) =>
              setFormData({ ...formData, provider: e.target.value as ProviderType })
            }
            className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
            required
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-coffee mb-2">Recipe Name</label>
          <Input
            type="text"
            placeholder="e.g., pm-agent"
            value={formData.recipeName}
            onChange={(e) => setFormData({ ...formData, recipeName: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-coffee mb-2">Counter (Working Directory)</label>
          <Input
            type="text"
            value={formData.counter}
            onChange={(e) => setFormData({ ...formData, counter: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-coffee mb-2">Variables (JSON)</label>
          <textarea
            className="w-full px-3 py-2 bg-background border border-border rounded text-bone font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
            rows={6}
            placeholder='{"key": "value"}'
            value={formData.vars}
            onChange={(e) => setFormData({ ...formData, vars: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Order'}
        </Button>
      </form>
    </Card>
  );
}
