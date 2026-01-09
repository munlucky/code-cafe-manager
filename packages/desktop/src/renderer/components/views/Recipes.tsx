import { useEffect, useState } from 'react';
import { useRecipes } from '../../hooks/useRecipes';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import type { Recipe } from '../../types/models';

export function Recipes() {
  const {
    recipes,
    currentRecipe,
    currentRecipeName,
    fetchRecipes,
    loadRecipe,
    saveRecipe,
    validateRecipe,
  } = useRecipes();

  const [yamlText, setYamlText] = useState('');
  const [validationResult, setValidationResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    if (currentRecipe) {
      setYamlText(JSON.stringify(currentRecipe, null, 2));
      setValidationResult({ type: null, message: '' });
    }
  }, [currentRecipe]);

  const handleLoadRecipe = async (name: string) => {
    await loadRecipe(name);
  };

  const handleSave = async () => {
    if (!currentRecipeName) return;

    try {
      const recipeData = JSON.parse(yamlText) as Recipe;
      const result = await saveRecipe(currentRecipeName, recipeData);

      if (result.success) {
        alert('Recipe saved successfully!');
        setValidationResult({ type: 'success', message: 'Recipe saved successfully!' });
      } else {
        alert(`Failed to save recipe: ${result.error}`);
        setValidationResult({ type: 'error', message: result.error || 'Save failed' });
      }
    } catch (error) {
      alert(`Invalid JSON: ${error}`);
      setValidationResult({ type: 'error', message: `Invalid JSON: ${error}` });
    }
  };

  const handleValidate = async () => {
    try {
      const recipeData = JSON.parse(yamlText) as Recipe;
      const result = await validateRecipe(recipeData);

      if (result.success) {
        setValidationResult({ type: 'success', message: '✓ Recipe is valid' });
      } else {
        const errorMessages = result.errors
          ?.map((e) => `• ${e.path.join('.')}: ${e.message}`)
          .join('\n');
        setValidationResult({
          type: 'error',
          message: `Validation Errors:\n${errorMessages}`,
        });
      }
    } catch (error) {
      setValidationResult({
        type: 'error',
        message: `YAML Parse Error: ${error}`,
      });
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yamlText);
    alert('YAML copied to clipboard');
  };

  const handleNewRecipe = () => {
    const recipeName = prompt('Enter recipe filename (e.g., my-recipe.yaml):');
    if (!recipeName) return;

    if (!recipeName.endsWith('.yaml') && !recipeName.endsWith('.yml')) {
      alert('Recipe filename must end with .yaml or .yml');
      return;
    }

    const template: Recipe = {
      name: recipeName.replace(/\.(yaml|yml)$/, ''),
      version: '0.1.0',
      defaults: {
        provider: 'claude-code',
        workspace: {
          mode: 'in-place',
        },
      },
      inputs: {
        counter: '.',
      },
      vars: {},
      steps: [
        {
          id: 'step-1',
          type: 'ai.interactive',
          prompt: 'Your prompt here',
        },
      ],
    };

    setYamlText(JSON.stringify(template, null, 2));
    setValidationResult({ type: null, message: '' });
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Recipe List */}
      <Card className="w-64 flex flex-col">
        <h3 className="text-lg font-bold mb-4 text-coffee">Recipes</h3>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {recipes.length === 0 ? (
            <EmptyState message="No recipes yet" />
          ) : (
            recipes.map((name) => (
              <button
                key={name}
                onClick={() => handleLoadRecipe(name)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                  'bg-background border border-border hover:border-coffee',
                  currentRecipeName === name && 'border-coffee bg-coffee/10'
                )}
              >
                {name}
              </button>
            ))
          )}
        </div>

        <Button onClick={handleNewRecipe}>New Recipe</Button>
      </Card>

      {/* Editor */}
      <Card className="flex-1 flex flex-col">
        {!currentRecipe && !yamlText ? (
          <EmptyState message="Select a recipe to edit" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-coffee">
                {currentRecipeName || 'New Recipe'}
              </h3>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="secondary" onClick={handleValidate}>
                  Validate
                </Button>
                <Button variant="secondary" onClick={handleCopyYaml}>
                  Copy YAML
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-coffee mb-2">Recipe YAML (JSON format)</label>
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                className="flex-1 w-full px-4 py-3 bg-background border border-border rounded text-bone font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50 resize-none"
              />
            </div>

            {validationResult.type && (
              <div
                className={cn(
                  'mt-4 p-4 rounded border',
                  validationResult.type === 'success' &&
                    'bg-green-500/10 border-green-500 text-green-500',
                  validationResult.type === 'error' &&
                    'bg-red-500/10 border-red-500 text-red-500'
                )}
              >
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {validationResult.message}
                </pre>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
