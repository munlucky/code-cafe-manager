import { useState, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useRecipes } from '../../hooks/useRecipes';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ProviderType } from '../../types/models';

interface NewOrderProps {
  onSuccess?: () => void;
}

export function NewOrder({ onSuccess }: NewOrderProps) {
  const { createOrder } = useOrders();
  const { recipes, fetchRecipes } = useRecipes();
  const [selectedRecipeProvider, setSelectedRecipeProvider] =
    useState<ProviderType>('claude-code');
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    recipeName: '',
    counter: '.',
    issue: '',
    extraVars: '',
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    if (recipes.length === 0) return;
    setFormData((prev) => {
      if (prev.recipeName) return prev;
      const defaultRecipe =
        recipes.find(
          (name) =>
            name === 'pm-agent' || name === 'pm-agent.yaml' || name === 'pm-agent.yml'
        ) || recipes[0];
      return { ...prev, recipeName: defaultRecipe };
    });
  }, [recipes]);

  useEffect(() => {
    const recipeName = formData.recipeName;
    if (!recipeName) {
      setSelectedRecipeProvider('claude-code');
      return;
    }

    let active = true;
    setIsProviderLoading(true);
    window.codecafe
      .getRecipe(recipeName)
      .then((result) => {
        if (!active) return;
        if (result.success && result.data?.defaults?.provider) {
          setSelectedRecipeProvider(result.data.defaults.provider);
        } else {
          setSelectedRecipeProvider('claude-code');
        }
      })
      .catch((error) => {
        if (active) {
          console.error('Failed to load recipe provider:', error);
          setSelectedRecipeProvider('claude-code');
        }
      })
      .finally(() => {
        if (active) {
          setIsProviderLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [formData.recipeName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let provider = selectedRecipeProvider;
      if (!provider && formData.recipeName) {
        try {
          const result = await window.codecafe.getRecipe(formData.recipeName);
          if (result.success && result.data?.defaults?.provider) {
            provider = result.data.defaults.provider;
          }
        } catch (error) {
          console.error('Failed to resolve recipe provider:', error);
        }
      }

      let extraVars: Record<string, any> = {};
      if (formData.extraVars.trim()) {
        try {
          extraVars = JSON.parse(formData.extraVars);
        } catch (error) {
          alert('Invalid JSON in extra variables');
          setIsSubmitting(false);
          return;
        }
      }

      const vars: Record<string, any> = {
        issue: formData.issue,
        ...extraVars,
      };

      await createOrder({
        recipeId: formData.recipeName,
        recipeName: formData.recipeName,
        counter: formData.counter,
        provider: provider || 'claude-code',
        vars,
      });

      alert('Order created successfully!');

      // Reset form
      setFormData({
        recipeName: formData.recipeName,
        counter: '.',
        issue: '',
        extraVars: '',
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
          <label className="block text-coffee mb-2">Menu</label>
          {recipes.length > 0 ? (
            <select
              value={formData.recipeName}
              onChange={(e) =>
                setFormData({ ...formData, recipeName: e.target.value })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
              required
            >
              {recipes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type="text"
              placeholder="pm-agent"
              value={formData.recipeName}
              onChange={(e) =>
                setFormData({ ...formData, recipeName: e.target.value })
              }
              required
            />
          )}
          <div className="text-xs text-gray-500 mt-2">
            Default menu: pm-agent
          </div>
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
          <label className="block text-coffee mb-2">Issue</label>
          <textarea
            className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
            rows={6}
            placeholder="Describe the issue or task"
            value={formData.issue}
            onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
            required
          />
        </div>

        <div className="text-xs text-gray-500">
          Barista: {selectedRecipeProvider}
          {isProviderLoading && ' (loading...)'}
        </div>
        <div className="text-xs text-gray-500">Workspace: git worktree</div>

        <div>
          <label className="block text-coffee mb-2">Extra Vars (JSON)</label>
          <textarea
            className="w-full px-3 py-2 bg-background border border-border rounded text-bone font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
            rows={4}
            placeholder='{"key": "value"}'
            value={formData.extraVars}
            onChange={(e) => setFormData({ ...formData, extraVars: e.target.value })}
          />
          <div className="text-xs text-gray-500 mt-2">
            Optional variables merged with issue input.
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Order'}
        </Button>
      </form>
    </Card>
  );
}
