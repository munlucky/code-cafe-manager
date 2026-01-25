/**
 * CreateOrderModal - Modal for creating a new order
 */

import React, { memo, useState } from 'react';
import { Plus, CheckCircle2, Split } from 'lucide-react';
import type { Cafe, Recipe } from '../../types/design';

interface CreateOrderModalProps {
  cafe: Cafe;
  workflows: Recipe[];
  onClose: () => void;
  onCreate: (
    cafeId: string,
    workflowId: string,
    description: string,
    useWorktree: boolean
  ) => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = memo(
  function CreateOrderModal({ cafe, workflows, onClose, onCreate }) {
    const [selectedWorkflow, setSelectedWorkflow] = useState(
      workflows[0]?.id || ''
    );
    const [description, setDescription] = useState('');
    const [useWorktree, setUseWorktree] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onCreate(cafe.id, selectedWorkflow, description, useWorktree);
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-cafe-900 border border-cafe-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
          <div className="p-6 border-b border-cafe-800 bg-cafe-850">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Plus className="w-5 h-5 mr-2 text-brand" />
              New Order
            </h2>
            <p className="text-cafe-500 text-sm mt-1">
              Orchestrate a new workflow for{' '}
              <span className="text-cafe-300 font-mono font-medium">
                {cafe.name}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Workflow Selection */}
            <div>
              <label className="block text-xs font-bold text-cafe-500 uppercase mb-3 tracking-wider">
                Select Workflow
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedWorkflow(wf.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedWorkflow === wf.id
                        ? 'bg-brand/10 border-brand/50 shadow-sm'
                        : 'bg-cafe-950 border-cafe-800 hover:border-cafe-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-bold ${selectedWorkflow === wf.id ? 'text-brand-light' : 'text-cafe-200'}`}
                      >
                        {wf.name}
                      </span>
                      {selectedWorkflow === wf.id && (
                        <CheckCircle2 className="w-5 h-5 text-brand" />
                      )}
                    </div>
                    <p className="text-xs text-cafe-500">{wf.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description/Prompt */}
            <div>
              <label className="block text-xs font-bold text-cafe-500 uppercase mb-2 tracking-wider">
                Description / Prompt
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What would you like the barista to do?"
                className="w-full h-24 bg-cafe-950 border border-cafe-700 text-cafe-200 rounded-xl p-4 focus:ring-2 focus:ring-brand outline-none text-sm resize-none font-mono"
              />
            </div>

            {/* Worktree Checkbox */}
            <div className="flex items-center p-3.5 bg-cafe-950 rounded-xl border border-cafe-800">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="worktree"
                  checked={useWorktree}
                  onChange={(e) => setUseWorktree(e.target.checked)}
                  className="w-5 h-5 rounded border-cafe-600 text-brand bg-cafe-800 focus:ring-brand focus:ring-offset-cafe-900 cursor-pointer"
                />
              </div>
              <label htmlFor="worktree" className="ml-3 flex-1 cursor-pointer">
                <span className="block text-sm font-bold text-cafe-200">
                  Isolate in Worktree
                </span>
                <span className="block text-xs text-cafe-500 mt-0.5">
                  Creates a temporary git worktree to prevent conflicts.
                </span>
              </label>
              <div className="bg-cafe-800 p-1.5 rounded-lg">
                <Split className="w-5 h-5 text-cafe-500" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-cafe-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-cafe-400 hover:text-cafe-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-brand/20"
              >
                Create Order
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);
