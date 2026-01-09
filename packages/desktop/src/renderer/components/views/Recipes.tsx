import { useEffect, useState } from 'react';
import YAML from 'yaml';
import { useRecipes } from '../../hooks/useRecipes';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import type { Recipe, RecipeStep, StepType, ProviderType } from '../../types/models';

const STEP_TYPES: StepType[] = ['ai.interactive', 'ai.prompt', 'shell', 'parallel'];
const PROVIDER_OPTIONS: ProviderType[] = ['claude-code', 'codex'];

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    defaults: {
      provider: recipe?.defaults?.provider || 'claude-code',
      workspace: {
        mode: 'worktree',
        baseBranch: recipe?.defaults?.workspace?.baseBranch,
        clean: recipe?.defaults?.workspace?.clean,
      },
    },
    inputs: {
      counter: recipe?.inputs?.counter || '.',
    },
    vars: recipe?.vars || {},
    steps: recipe?.steps || [],
  };
}

function cloneRecipe(recipe: Recipe): Recipe {
  return normalizeRecipe(JSON.parse(JSON.stringify(recipe)) as Recipe);
}

function parseDepends(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function Recipes() {
  const {
    recipes,
    currentRecipe,
    currentRecipeName,
    fetchRecipes,
    loadRecipe,
    saveRecipe,
    validateRecipe,
    deleteRecipe,
    setCurrentRecipe,
  } = useRecipes();

  const [yamlText, setYamlText] = useState('');
  const [yamlError, setYamlError] = useState('');
  const [recipeDraft, setRecipeDraft] = useState<Recipe | null>(null);
  const [draftRecipeName, setDraftRecipeName] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeError, setNewRecipeError] = useState('');
  const [validationResult, setValidationResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    if (currentRecipe) {
      setYamlText(YAML.stringify(currentRecipe));
      setRecipeDraft(currentRecipe);
      setDraftRecipeName(null);
      setYamlError('');
      setValidationResult({ type: null, message: '' });
    }
  }, [currentRecipe]);

  const updateDraft = (updater: (draft: Recipe) => Recipe) => {
    setRecipeDraft((prev) => {
      if (!prev) return prev;
      const next = updater(cloneRecipe(prev));
      next.defaults.workspace.mode = 'worktree';
      setYamlText(YAML.stringify(next));
      setYamlError('');
      return next;
    });
  };

  const handleYamlChange = (value: string) => {
    setYamlText(value);
    try {
      const parsed = normalizeRecipe(YAML.parse(value) as Recipe);
      setRecipeDraft(parsed);
      setYamlError('');
    } catch (error) {
      setYamlError(`YAML Parse Error: ${error}`);
    }
  };

  const handleLoadRecipe = async (name: string) => {
    await loadRecipe(name);
  };

  const handleSave = async () => {
    const targetName = draftRecipeName || currentRecipeName;
    if (!targetName) {
      alert('Select or create a recipe first.');
      return;
    }

    try {
      const recipeData = normalizeRecipe(YAML.parse(yamlText) as Recipe);
      setYamlText(YAML.stringify(recipeData));
      const result = await saveRecipe(targetName, recipeData);

      if (result.success) {
        alert('Recipe saved successfully!');
        setValidationResult({ type: 'success', message: 'Recipe saved successfully!' });
      } else {
        alert(`Failed to save recipe: ${result.error}`);
        setValidationResult({ type: 'error', message: result.error || 'Save failed' });
      }
    } catch (error) {
      alert(`Invalid YAML: ${error}`);
      setValidationResult({ type: 'error', message: `Invalid YAML: ${error}` });
    }
  };

  const handleValidate = async () => {
    try {
      const recipeData = normalizeRecipe(YAML.parse(yamlText) as Recipe);
      const result = await validateRecipe(recipeData);

      if (result.success) {
        setValidationResult({ type: 'success', message: 'Recipe is valid' });
      } else {
        const errorMessages = result.errors
          ?.map((e) => `- ${e.path.join('.')}: ${e.message}`)
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

  const handleDelete = async () => {
    if (!currentRecipeName) return;
    if (!confirm(`Delete recipe ${currentRecipeName}?`)) return;
    try {
      const result = await deleteRecipe(currentRecipeName);
      if (!result.success) {
        alert(`Failed to delete recipe: ${result.error}`);
      }
      setYamlText('');
      setRecipeDraft(null);
      setYamlError('');
      setValidationResult({ type: null, message: '' });
    } catch (error) {
      alert(`Failed to delete recipe: ${error}`);
    }
  };

  const handleCreateNewRecipe = () => {
    const recipeName = newRecipeName.trim();
    if (!recipeName) {
      setNewRecipeError('Enter a recipe filename');
      return;
    }

    if (!recipeName.endsWith('.yaml') && !recipeName.endsWith('.yml')) {
      setNewRecipeError('Recipe filename must end with .yaml or .yml');
      return;
    }

    const template: Recipe = {
      name: recipeName.replace(/\.(yaml|yml)$/, ''),
      version: '0.1.0',
      defaults: {
        provider: 'claude-code',
        workspace: {
          mode: 'worktree',
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

    setCurrentRecipe(null, null);
    setYamlText(YAML.stringify(template));
    setRecipeDraft(template);
    setDraftRecipeName(recipeName);
    setYamlError('');
    setNewRecipeError('');
    setValidationResult({ type: null, message: '' });
    setNewRecipeName('');
    setIsCreating(false);
  };

  const handleAddStep = () => {
    updateDraft((draft) => {
      const step: RecipeStep = {
        id: `step-${draft.steps.length + 1}`,
        type: 'ai.interactive',
        prompt: '',
      };
      draft.steps.push(step);
      return draft;
    });
  };

  const handleRemoveStep = (index: number) => {
    updateDraft((draft) => {
      draft.steps.splice(index, 1);
      return draft;
    });
  };

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    updateDraft((draft) => {
      const step = draft.steps[index];
      draft.steps[index] = { ...step, ...updates };
      return draft;
    });
  };

  const recipeTitle = draftRecipeName || currentRecipeName || 'New Recipe';

  return (
    <div className="flex gap-6 h-full">
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

        {!isCreating && (
          <Button
            onClick={() => {
              setIsCreating(true);
              setNewRecipeError('');
            }}
          >
            New Recipe
          </Button>
        )}
        {isCreating && (
          <div className="mt-3 space-y-3">
            <Input
              type="text"
              placeholder="my-recipe.yaml"
              value={newRecipeName}
              onChange={(e) => {
                setNewRecipeName(e.target.value);
                if (newRecipeError) {
                  setNewRecipeError('');
                }
              }}
            />
            {newRecipeError && <div className="text-xs text-red-500">{newRecipeError}</div>}
            <div className="flex gap-2">
              <Button onClick={handleCreateNewRecipe}>Create</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(false);
                  setNewRecipeName('');
                  setNewRecipeError('');
                }}
              >
                Close
              </Button>
            </div>
            <div className="text-xs text-gray-500">Filename must end with .yaml or .yml</div>
          </div>
        )}
      </Card>

      <Card className="flex-1 flex flex-col">
        {!recipeDraft && !yamlText ? (
          <EmptyState message="Select a recipe to edit" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-coffee">{recipeTitle}</h3>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="secondary" onClick={handleValidate}>
                  Validate
                </Button>
                <Button variant="secondary" onClick={handleCopyYaml}>
                  Copy YAML
                </Button>
                {currentRecipeName && (
                  <Button
                    variant="secondary"
                    className="bg-red-700 hover:bg-red-600"
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4 flex-1">
              <div className="space-y-5 overflow-y-auto pr-2 scrollbar-custom">
                <div>
                  <div className="text-sm font-semibold text-coffee mb-2">Basics</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-coffee mb-1 text-sm">Name</label>
                      <Input
                        type="text"
                        value={recipeDraft?.name || ''}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.name = e.target.value;
                            return draft;
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-coffee mb-1 text-sm">Version</label>
                      <Input
                        type="text"
                        value={recipeDraft?.version || ''}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.version = e.target.value;
                            return draft;
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-coffee mb-1 text-sm">Barista (Provider)</label>
                      <select
                        value={recipeDraft?.defaults.provider || 'claude-code'}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.defaults.provider = e.target.value as ProviderType;
                            return draft;
                          })
                        }
                        className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                      >
                        {PROVIDER_OPTIONS.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-coffee mb-1 text-sm">Default Counter</label>
                      <Input
                        type="text"
                        value={recipeDraft?.inputs.counter || ''}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.inputs.counter = e.target.value;
                            return draft;
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-coffee mb-2">Workspace</div>
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500">
                      Mode: worktree (fixed)
                    </div>
                    <div>
                      <label className="block text-coffee mb-1 text-sm">Base Branch</label>
                      <Input
                        type="text"
                        value={recipeDraft?.defaults.workspace.baseBranch || ''}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.defaults.workspace.baseBranch = e.target.value;
                            return draft;
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-bone">
                      <input
                        type="checkbox"
                        checked={Boolean(recipeDraft?.defaults.workspace.clean)}
                        onChange={(e) =>
                          updateDraft((draft) => {
                            draft.defaults.workspace.clean = e.target.checked;
                            return draft;
                          })
                        }
                      />
                      Clean worktree after completion
                    </label>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-coffee">Steps</div>
                    <Button variant="secondary" onClick={handleAddStep}>
                      Add Step
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(recipeDraft?.steps || []).map((step, index) => (
                      <div
                        key={step.id || index}
                        className="border border-border rounded p-3 space-y-3 bg-background"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            type="text"
                            value={step.id}
                            onChange={(e) => updateStep(index, { id: e.target.value })}
                          />
                          <Button
                            variant="secondary"
                            className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600"
                            onClick={() => handleRemoveStep(index)}
                          >
                            Remove
                          </Button>
                        </div>
                        <div>
                          <label className="block text-coffee mb-1 text-sm">Type</label>
                          <select
                            value={step.type}
                            onChange={(e) =>
                              updateStep(index, { type: e.target.value as StepType })
                            }
                            className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                          >
                            {STEP_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-coffee mb-1 text-sm">
                            Provider (optional)
                          </label>
                          <select
                            value={step.provider || ''}
                            onChange={(e) =>
                              updateStep(index, {
                                provider: e.target.value
                                  ? (e.target.value as ProviderType)
                                  : undefined,
                              })
                            }
                            className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                          >
                            <option value="">(default)</option>
                            {PROVIDER_OPTIONS.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(step.type === 'ai.interactive' || step.type === 'ai.prompt') && (
                          <div>
                            <label className="block text-coffee mb-1 text-sm">Prompt</label>
                            <textarea
                              className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
                              rows={4}
                              value={step.prompt || ''}
                              onChange={(e) => updateStep(index, { prompt: e.target.value })}
                            />
                          </div>
                        )}
                        {step.type === 'shell' && (
                          <div>
                            <label className="block text-coffee mb-1 text-sm">Command</label>
                            <Input
                              type="text"
                              value={step.command || ''}
                              onChange={(e) => updateStep(index, { command: e.target.value })}
                            />
                          </div>
                        )}
                        {step.type === 'parallel' && (
                          <div className="text-xs text-gray-500">
                            Parallel steps are edited in YAML for now.
                          </div>
                        )}
                        <div>
                          <label className="block text-coffee mb-1 text-sm">
                            Depends On (comma-separated)
                          </label>
                          <Input
                            type="text"
                            value={step.depends_on?.join(', ') || ''}
                            onChange={(e) =>
                              updateStep(index, { depends_on: parseDepends(e.target.value) })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-coffee mb-1 text-sm">Retry</label>
                            <Input
                              type="number"
                              value={step.retry ?? ''}
                              onChange={(e) =>
                                updateStep(index, {
                                  retry: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-coffee mb-1 text-sm">Timeout (sec)</label>
                            <Input
                              type="number"
                              value={step.timeout_sec ?? ''}
                              onChange={(e) =>
                                updateStep(index, {
                                  timeout_sec:
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {recipeDraft?.steps?.length === 0 && (
                      <div className="text-xs text-gray-500">
                        No steps yet. Add a step to get started.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="block text-coffee mb-2">Recipe YAML</label>
                <textarea
                  value={yamlText}
                  onChange={(e) => handleYamlChange(e.target.value)}
                  className="flex-1 w-full px-4 py-3 bg-background border border-border rounded text-bone font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50 resize-none"
                />
                {yamlError && <div className="text-xs text-red-500 mt-2">{yamlError}</div>}
              </div>
            </div>

            {validationResult.type && (
              <div
                className={cn(
                  'mt-4 p-4 rounded border',
                  validationResult.type === 'success' &&
                    'bg-green-500/10 border-green-500 text-green-500',
                  validationResult.type === 'error' && 'bg-red-500/10 border-red-500 text-red-500'
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
