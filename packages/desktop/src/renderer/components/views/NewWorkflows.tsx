import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Plus, Search, ChevronRight, Layers, Trash2, Edit2, Play, GitMerge, Zap, X } from 'lucide-react';
import type { Recipe, Skill, StageConfig } from '../../types/design';

interface NewWorkflowsProps {
  recipes: Recipe[];
  skills: Skill[];
  onAddRecipe: (recipe: Recipe) => void;
  onUpdateRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
}

export const NewWorkflows: React.FC<NewWorkflowsProps> = ({
  recipes,
  skills,
  onAddRecipe,
  onUpdateRecipe,
  onDeleteRecipe
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyName, setCopyName] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<Recipe>>({
    name: '',
    description: '',
    stages: [],
    stageConfigs: {}
  });
  const [stageInput, setStageInput] = useState('');

  // Skill Selection State
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(null);
  const skillSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (skillSelectRef.current && !skillSelectRef.current.contains(event.target as Node)) {
        setActiveStageIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (recipe?: Recipe) => {
    if (recipe) {
      setEditingId(recipe.id);
      setFormData({
        ...recipe,
        stageConfigs: recipe.stageConfigs || {} // Ensure it exists
      });
    } else {
      setEditingId('new');
      setFormData({ name: '', description: '', stages: [], stageConfigs: {} });
    }
  };

  const isProtected = editingId && editingId !== 'new' && recipes.find(r => r.id === editingId)?.protected;

  const handleSave = () => {
    if (!formData.name) return;

    const recipe: Recipe = {
      id: editingId === 'new' ? Math.random().toString(36).substr(2, 9) : editingId!,
      name: formData.name!,
      description: formData.description || '',
      stages: formData.stages || [],
      stageConfigs: formData.stageConfigs || {}
    };

    if (editingId === 'new') {
      onAddRecipe(recipe);
    } else {
      onUpdateRecipe(recipe);
    }
    setEditingId(null);
  };

  const addStage = () => {
    if (stageInput.trim()) {
      const stageName = stageInput.trim();
      setFormData({
        ...formData,
        stages: [...(formData.stages || []), stageName],
        stageConfigs: {
          ...(formData.stageConfigs || {}),
          [stageName]: { skills: [] }
        }
      });
      setStageInput('');
    }
  };

  const removeStage = (index: number) => {
    const stageName = formData.stages![index];
    const newStages = [...(formData.stages || [])];
    newStages.splice(index, 1);

    const newConfigs = { ...(formData.stageConfigs || {}) };
    delete newConfigs[stageName];

    setFormData({ ...formData, stages: newStages, stageConfigs: newConfigs });
  };

  const addSkillToStage = (stageIndex: number, skillId: string) => {
    const stageName = formData.stages![stageIndex];
    const currentConfig = formData.stageConfigs?.[stageName] || { skills: [] };

    if (!currentConfig.skills.includes(skillId)) {
      setFormData({
        ...formData,
        stageConfigs: {
          ...(formData.stageConfigs || {}),
          [stageName]: { ...currentConfig, skills: [...currentConfig.skills, skillId] }
        }
      });
    }
    setActiveStageIndex(null);
  };

  const removeSkillFromStage = (stageIndex: number, skillId: string) => {
    const stageName = formData.stages![stageIndex];
    const currentConfig = formData.stageConfigs?.[stageName];

    if (currentConfig) {
      setFormData({
        ...formData,
        stageConfigs: {
          ...(formData.stageConfigs || {}),
          [stageName]: { ...currentConfig, skills: currentConfig.skills.filter(id => id !== skillId) }
        }
      });
    }
  };

  const getSkillById = (id: string) => skills.find(s => s.id === id);

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cafe-100 mb-2 flex items-center">
            <BookOpen className="w-8 h-8 mr-3 text-brand" />
            Recipe Book
          </h1>
          <p className="text-cafe-400">Design your workflows by combining skills into recipes.</p>
        </div>
        <button
          onClick={() => startEdit()}
          className="flex items-center px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-lg font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Recipe
        </button>
      </div>

      <div className="flex gap-6 h-full overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 flex flex-col bg-cafe-900 border border-cafe-700 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-cafe-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cafe-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter recipes..."
                className="w-full bg-cafe-950 border border-cafe-800 text-cafe-200 pl-10 pr-4 py-2.5 rounded-lg focus:ring-1 focus:ring-brand outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => startEdit(recipe)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${editingId === recipe.id ? 'bg-cafe-800 border-l-2 border-brand shadow-md' : 'hover:bg-cafe-800/50 border-l-2 border-transparent'}`}
              >
                <h3 className={`font-bold text-sm ${editingId === recipe.id ? 'text-white' : 'text-cafe-300'}`}>{recipe.name}</h3>
                <p className="text-xs text-cafe-500 truncate mt-1">{recipe.description}</p>
                <div className="flex items-center mt-2 text-[10px] text-cafe-600">
                   <Layers className="w-3 h-3 mr-1" /> {recipe.stages.length} Stages
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Details/Edit */}
        <div className="flex-1 bg-cafe-900 border border-cafe-700 rounded-2xl p-8 overflow-y-auto shadow-lg relative">
          {editingId ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="flex justify-between items-start border-b border-cafe-800 pb-4">
                 <div className="flex-1 mr-4">
                   <label className="block text-xs font-bold text-brand uppercase mb-1">Recipe Name</label>
                   <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="bg-transparent text-2xl font-bold text-white placeholder-cafe-600 outline-none w-full border-b border-transparent focus:border-cafe-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter recipe name..."
                    disabled={!!isProtected}
                   />
                 </div>
                 {editingId !== 'new' && !isProtected && (
                    <button onClick={() => onDeleteRecipe(editingId)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                 )}
               </div>

               <div>
                 <label className="block text-xs font-bold text-cafe-500 uppercase mb-2">Description</label>
                 <textarea
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   className="w-full bg-cafe-950 border border-cafe-700 rounded-lg p-3 text-cafe-200 outline-none focus:border-brand h-20 resize-none"
                   placeholder="Describe the purpose of this workflow..."
                 />
               </div>

               <div>
                  <label className="block text-xs font-bold text-cafe-500 uppercase mb-3">Workflow Stages & Skills</label>
                  <div className="space-y-4">
                    {formData.stages?.map((stage, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-6 h-6 rounded-full bg-cafe-800 border border-cafe-700 flex items-center justify-center text-xs font-bold text-cafe-400">
                            {idx + 1}
                          </div>
                          {idx < (formData.stages?.length || 0) - 1 && (
                            <div className="w-px h-full bg-cafe-800 my-1 min-h-[20px]"></div>
                          )}
                        </div>

                        <div className="flex-1 bg-cafe-950 rounded-xl border border-cafe-800 p-4 transition-all hover:border-cafe-700">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-cafe-200 font-bold text-sm tracking-wide">{stage}</span>
                            {!isProtected && (
                              <button onClick={() => removeStage(idx)} className="text-cafe-600 hover:text-red-400 p-1 rounded transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Assigned Skills */}
                          <div className="flex flex-wrap gap-2 mb-2">
                             {(formData.stageConfigs?.[stage]?.skills || []).map(skillId => {
                               const skill = getSkillById(skillId);
                               return skill ? (
                                 <div key={skillId} className="flex items-center px-2 py-1 bg-cafe-800 text-cafe-300 rounded text-xs border border-cafe-700 animate-in zoom-in">
                                   <Zap className="w-3 h-3 mr-1 text-brand-light" />
                                   {skill.name}
                                   {!isProtected && (
                                     <button
                                       onClick={() => removeSkillFromStage(idx, skillId)}
                                       className="ml-1.5 hover:text-red-400"
                                     >
                                       <X className="w-3 h-3" />
                                     </button>
                                   )}
                                 </div>
                               ) : null;
                             })}

                             {/* Add Skill Button */}
                             {!isProtected && (
                               <div className="relative">
                               <button
                                 onClick={() => setActiveStageIndex(activeStageIndex === idx ? null : idx)}
                                 className="flex items-center px-2 py-1 bg-cafe-900 hover:bg-cafe-800 text-cafe-500 hover:text-brand-light rounded text-xs border border-cafe-800 border-dashed transition-colors"
                               >
                                 <Plus className="w-3 h-3 mr-1" /> Skill
                               </button>

                               {/* Skill Dropdown */}
                               {activeStageIndex === idx && (
                                 <div ref={skillSelectRef} className="absolute top-full left-0 mt-2 w-64 max-h-48 overflow-y-auto bg-cafe-900 border border-cafe-700 rounded-lg shadow-xl z-20">
                                   <div className="p-2 border-b border-cafe-800 text-[10px] font-bold text-cafe-500 uppercase">Select Skill</div>
                                   {skills.filter(s => !(formData.stageConfigs?.[stage]?.skills || []).includes(s.id)).length === 0 ? (
                                     <div className="p-3 text-xs text-cafe-600 italic">No skills available</div>
                                   ) : (
                                     skills
                                     .filter(s => !(formData.stageConfigs?.[stage]?.skills || []).includes(s.id))
                                     .map(skill => (
                                       <button
                                         key={skill.id}
                                         onClick={() => addSkillToStage(idx, skill.id)}
                                         className="w-full text-left px-3 py-2 text-xs text-cafe-300 hover:bg-cafe-800 hover:text-brand-light flex items-center"
                                       >
                                         <Zap className="w-3 h-3 mr-2 text-cafe-600" />
                                         {skill.name}
                                       </button>
                                     ))
                                   )}
                                 </div>
                               )}
                             </div>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add Stage Input */}
                    {!isProtected && (
                      <div className="flex items-center gap-3 pt-2">
                         <div className="w-6 flex justify-center">
                           <div className="w-2 h-2 rounded-full bg-cafe-800"></div>
                         </div>
                         <div className="flex-1 flex gap-2">
                           <input
                             type="text"
                             value={stageInput}
                             onChange={e => setStageInput(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && addStage()}
                             placeholder="New stage name (e.g. 'Security Scan')"
                             className="flex-1 bg-cafe-950 border border-cafe-800 rounded-lg px-3 py-2.5 text-sm text-white focus:border-brand outline-none transition-colors focus:bg-cafe-900"
                           />
                           <button onClick={addStage} className="px-4 py-2 bg-cafe-800 hover:bg-cafe-700 text-white rounded-lg text-sm font-medium transition-colors">Add Stage</button>
                         </div>
                      </div>
                    )}
                  </div>
               </div>

               <div className="pt-6 border-t border-cafe-800 flex justify-end gap-3 sticky bottom-0 bg-cafe-900 pb-2">
                 <button onClick={() => setEditingId(null)} className="px-5 py-2.5 text-cafe-400 hover:text-white transition-colors">Cancel</button>
                 {isProtected ? (
                   <button
                     onClick={() => {
                       setCopyName(`${formData.name} (Copy)`);
                       setShowCopyModal(true);
                     }}
                     className="px-6 py-2.5 bg-cafe-700 hover:bg-cafe-600 text-white rounded-lg font-bold shadow-lg transition-transform active:scale-95"
                   >
                     Save As Copy
                   </button>
                 ) : (
                   <button onClick={handleSave} className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-bold shadow-lg transition-transform active:scale-95">Save Recipe</button>
                 )}
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-cafe-600">
              <BookOpen className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg font-medium">Select a recipe to view details</p>
              <p className="text-sm opacity-60">Or create a new one to start brewing</p>
            </div>
          )}
        </div>
      </div>

      {/* Copy Recipe Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cafe-900 rounded-xl p-6 w-96 border border-cafe-700">
            <h3 className="text-lg font-bold text-white mb-4">Save As Copy</h3>
            <input
              type="text"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder="Enter new name for copy"
              className="w-full px-4 py-2 rounded-lg bg-cafe-800 border border-cafe-700 text-white mb-4 focus:border-brand focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && copyName.trim()) {
                  onAddRecipe({
                    ...formData as Recipe,
                    id: Math.random().toString(36).substr(2, 9),
                    name: copyName.trim(),
                    protected: false,
                    isDefault: false
                  });
                  setShowCopyModal(false);
                  setEditingId(null);
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-cafe-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (copyName.trim()) {
                    onAddRecipe({
                      ...formData as Recipe,
                      id: Math.random().toString(36).substr(2, 9),
                      name: copyName.trim(),
                      protected: false,
                      isDefault: false
                    });
                    setShowCopyModal(false);
                    setEditingId(null);
                  }
                }}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-bold"
              >
                Save Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
