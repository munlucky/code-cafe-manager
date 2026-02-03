import React, { useState } from 'react';
import { Zap, Plus, Search, Lock, Trash2, Edit2, Check, X, BrainCircuit } from 'lucide-react';
import { Skill, SkillCategory } from '../types';

interface SkillManagerProps {
  skills: Skill[];
  onAddSkill: (skill: Skill) => void;
  onUpdateSkill: (skill: Skill) => void;
  onDeleteSkill: (id: string) => void;
}

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  planning: 'text-blue-400 bg-blue-900/20 border-blue-800',
  implementation: 'text-brand-light bg-brand/10 border-brand/20',
  verification: 'text-purple-400 bg-purple-900/20 border-purple-800',
  review: 'text-emerald-400 bg-emerald-900/20 border-emerald-800',
};

export const SkillManager: React.FC<SkillManagerProps> = ({ skills, onAddSkill, onUpdateSkill, onDeleteSkill }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Skill>>({
    name: '',
    description: '',
    category: 'implementation',
    instructions: '',
    isBuiltIn: false
  });

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (skill: Skill) => {
    setEditingId(skill.id);
    setFormData({ ...skill });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      category: 'implementation',
      instructions: '',
      isBuiltIn: false
    });
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) return;

    if (editingId) {
      onUpdateSkill({ ...formData, id: editingId } as Skill);
    } else {
      onAddSkill({
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        isBuiltIn: false
      } as Skill);
    }
    setIsEditing(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cafe-100 mb-2 flex items-center">
            <Zap className="w-8 h-8 mr-3 text-brand" />
            Skill Registry
          </h1>
          <p className="text-cafe-400">Manage the cognitive capabilities of your AI agents.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-lg font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Skill
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cafe-500" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search skills..."
          className="w-full bg-cafe-900 border border-cafe-700 text-cafe-200 pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-brand outline-none"
        />
      </div>

      {isEditing ? (
        <div className="flex-1 bg-cafe-900 border border-cafe-700 rounded-2xl p-8 overflow-y-auto animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Skill' : 'Define New Skill'}</h2>
            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-cafe-800 rounded-lg text-cafe-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-2">Skill Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-cafe-950 border border-cafe-700 rounded-lg p-3 text-white focus:border-brand outline-none"
                  placeholder="e.g., Code Reviewer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-2">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value as SkillCategory})}
                  className="w-full bg-cafe-950 border border-cafe-700 rounded-lg p-3 text-white focus:border-brand outline-none appearance-none"
                >
                  <option value="planning">Planning</option>
                  <option value="implementation">Implementation</option>
                  <option value="verification">Verification</option>
                  <option value="review">Review</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cafe-500 uppercase mb-2">Description</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-cafe-950 border border-cafe-700 rounded-lg p-3 text-white focus:border-brand outline-none"
                placeholder="Briefly describe what this skill does"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cafe-500 uppercase mb-2">System Instructions (Prompt)</label>
              <textarea 
                value={formData.instructions}
                onChange={e => setFormData({...formData, instructions: e.target.value})}
                className="w-full h-64 bg-cafe-950 border border-cafe-700 rounded-lg p-4 text-white font-mono text-sm focus:border-brand outline-none resize-none"
                placeholder="You are an expert code reviewer. Analyze the code for..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 text-cafe-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-bold shadow-lg"
              >
                Save Skill
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8">
          {filteredSkills.map(skill => (
            <div key={skill.id} className="bg-cafe-900 border border-cafe-800 rounded-xl p-5 hover:border-brand/30 transition-all group hover:-translate-y-1 hover:shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] font-bold px-2 py-1 rounded border ${CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.implementation} uppercase tracking-wider`}>
                  {skill.category}
                </span>
                {skill.isBuiltIn ? (
                  <Lock className="w-4 h-4 text-cafe-600" title="Built-in Skill" />
                ) : (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(skill)} className="p-1 hover:text-brand-light text-cafe-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDeleteSkill(skill.id)} className="p-1 hover:text-red-400 text-cafe-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              
              <h3 className="text-lg font-bold text-cafe-100 mb-2 flex items-center">
                <BrainCircuit className="w-4 h-4 mr-2 text-cafe-500" />
                {skill.name}
              </h3>
              <p className="text-sm text-cafe-400 mb-4 line-clamp-2 h-10">{skill.description}</p>
              
              <div className="bg-cafe-950 p-3 rounded-lg border border-cafe-800">
                <p className="text-xs font-mono text-cafe-500 line-clamp-3 opacity-70">
                  {skill.instructions}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};