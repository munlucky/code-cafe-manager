import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CafeDashboard } from './components/CafeDashboard';
import { OrderInterface } from './components/OrderInterface';
import { RecipeManager } from './components/RecipeManager';
import { SkillManager } from './components/SkillManager';
import { Cafe, Order, OrderStatus, Recipe, Skill } from './types';

// MOCK DATA GENERATORS
const generateId = () => Math.random().toString(36).substr(2, 9);
const timestamp = () => new Date().toLocaleTimeString([], { hour12: false });

const DEFAULT_SKILLS: Skill[] = [
  { id: 'skill-1', name: 'Task Classifier', description: 'Categorizes user requests into workflows', category: 'planning', isBuiltIn: true, instructions: 'Analyze the request...' },
  { id: 'skill-2', name: 'React Component Generator', description: 'Writes React components with Tailwind', category: 'implementation', isBuiltIn: true, instructions: 'Write a TSX component...' },
  { id: 'skill-3', name: 'Code Reviewer', description: 'Checks for security vulnerabilities', category: 'review', isBuiltIn: true, instructions: 'Scan for XSS, SQLi...' },
  { id: 'skill-4', name: 'Unit Test Writer', description: 'Generates Jest tests', category: 'verification', isBuiltIn: false, instructions: 'Write tests for...' },
];

const DEFAULT_RECIPES: Recipe[] = [
  { 
    id: 'moonshot-light', 
    name: 'Moonshot Light', 
    description: 'Quick analysis and single-file modification.', 
    stages: ['Analysis', 'Edit'],
    stageConfigs: {
      'Analysis': { skills: ['skill-1'] },
      'Edit': { skills: ['skill-2'] }
    }
  },
  { 
    id: 'code-review', 
    name: 'Deep Code Review', 
    description: 'Comprehensive audit with security focus.', 
    stages: ['Scan', 'Analyze', 'Report'],
    stageConfigs: {
      'Scan': { skills: [] },
      'Analyze': { skills: ['skill-3'] },
      'Report': { skills: [] }
    }
  },
  { 
    id: 'refactor-pro', 
    name: 'Refactor Pro', 
    description: 'Multi-file architectural restructuring.', 
    stages: ['Map', 'Plan', 'Execute', 'Verify'],
    stageConfigs: {
      'Map': { skills: ['skill-1'] },
      'Plan': { skills: [] },
      'Execute': { skills: ['skill-2'] },
      'Verify': { skills: ['skill-4'] }
    }
  },
];

const App: React.FC = () => {
  // Navigation State
  const [activeView, setActiveView] = useState<'dashboard' | 'recipes' | 'skills' | 'cafe'>('dashboard');
  const [activeCafeId, setActiveCafeId] = useState<string | null>(null);
  
  // Data State - GLOBAL
  const [recipes, setRecipes] = useState<Recipe[]>(DEFAULT_RECIPES);
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS);

  // Data State - LOCAL (Cafes & Orders)
  const [cafes, setCafes] = useState<Cafe[]>([
    {
      id: 'cafe-1',
      name: 'frontend-react',
      path: 'C:/dev/frontend-react',
      createdAt: new Date().toISOString(),
      activeOrdersCount: 0,
      settings: { baseBranch: 'main', worktreeRoot: '.orch/worktrees' }
    }
  ]);

  const [orders, setOrders] = useState<Order[]>([]);

  // Navigation Handlers
  const handleNavigate = (view: 'dashboard' | 'recipes' | 'skills' | 'cafe', cafeId?: string) => {
    setActiveView(view);
    if (view === 'cafe' && cafeId) {
      setActiveCafeId(cafeId);
    } else if (view !== 'cafe') {
      setActiveCafeId(null);
    }
  };

  // CRUD: Recipes
  const handleAddRecipe = (recipe: Recipe) => setRecipes([...recipes, recipe]);
  const handleUpdateRecipe = (recipe: Recipe) => setRecipes(recipes.map(r => r.id === recipe.id ? recipe : r));
  const handleDeleteRecipe = (id: string) => setRecipes(recipes.filter(r => r.id !== id));

  // CRUD: Skills
  const handleAddSkill = (skill: Skill) => setSkills([...skills, skill]);
  const handleUpdateSkill = (skill: Skill) => setSkills(skills.map(s => s.id === skill.id ? skill : s));
  const handleDeleteSkill = (id: string) => setSkills(skills.filter(s => s.id !== id));


  // Business Logic: Cafe
  const handleCreateCafe = (path: string) => {
    // Simulate IPC: cafe:create
    const parts = path.split(/[/\\]/);
    const name = parts[parts.length - 1] || 'unknown-repo';
    
    const newCafe: Cafe = {
      id: generateId(),
      name,
      path,
      createdAt: new Date().toISOString(),
      activeOrdersCount: 0,
      settings: { baseBranch: 'main', worktreeRoot: '.orch/worktrees' }
    };
    
    setCafes([...cafes, newCafe]);
    handleNavigate('cafe', newCafe.id);
  };

  // Business Logic: Order Creation
  const handleCreateOrder = (cafeId: string, workflowId: string, description: string, useWorktree: boolean) => {
    const cafe = cafes.find(c => c.id === cafeId);
    if (!cafe) return;

    const orderId = generateId();
    const branchName = `order-${orderId}`;
    const workflow = recipes.find(w => w.id === workflowId);

    const newOrder: Order = {
      id: orderId,
      workflowId,
      workflowName: workflow?.name || 'Unknown Recipe',
      status: OrderStatus.RUNNING, // Start immediately for demo
      cafeId,
      vars: {},
      worktreeInfo: useWorktree ? {
        path: `${cafe.path}/.orch/worktrees/${branchName}`,
        branch: branchName,
        baseBranch: cafe.settings.baseBranch,
        repoPath: cafe.path
      } : undefined,
      currentStage: workflow?.stages[0] || 'Init',
      logs: [
        { id: generateId(), timestamp: timestamp(), type: 'info', content: 'Order created locally.' },
        { id: generateId(), timestamp: timestamp(), type: 'system', content: `Initializing BaristaEngineV2...` },
        { id: generateId(), timestamp: timestamp(), type: 'system', content: useWorktree ? `Creating worktree at .orch/worktrees/${branchName}...` : 'Using main working directory.' },
        { id: generateId(), timestamp: timestamp(), type: 'success', content: 'Environment ready.' },
        { id: generateId(), timestamp: timestamp(), type: 'system', content: `Starting stage: ${workflow?.stages[0]}...` },
        { id: generateId(), timestamp: timestamp(), type: 'ai', content: `Analyzing request: "${description}"` },
      ],
      createdAt: new Date(),
      startedAt: new Date()
    };

    setOrders([newOrder, ...orders]);
    setCafes(cafes.map(c => c.id === cafeId ? { ...c, activeOrdersCount: c.activeOrdersCount + 1 } : c));

    // Simulate AI Streaming for the new order
    simulateAIExecution(orderId);
  };

  // Business Logic: Delete Order
  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    setOrders(orders.filter(o => o.id !== orderId));
    
    if (orderToDelete) {
       setCafes(cafes.map(c => c.id === orderToDelete.cafeId ? { ...c, activeOrdersCount: Math.max(0, c.activeOrdersCount - 1) } : c));
    }
  };

  // Business Logic: Handle User Input
  const handleSendInput = (orderId: string, input: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        status: OrderStatus.RUNNING,
        logs: [
          ...o.logs,
          { id: generateId(), timestamp: timestamp(), type: 'info', content: `> ${input}` },
          { id: generateId(), timestamp: timestamp(), type: 'system', content: 'Input received. Resuming execution...' }
        ]
      };
    }));
    
    // Resume simulation
    setTimeout(() => {
      completeOrderSimulation(orderId);
    }, 1500);
  };

  // --- Simulation Helpers ---
  
  const simulateAIExecution = (orderId: string) => {
    // Simulate a stream of logs
    let step = 0;
    
    const interval = setInterval(() => {
      setOrders(prevOrders => {
        const order = prevOrders.find(o => o.id === orderId);
        if (!order || order.status !== OrderStatus.RUNNING) {
          clearInterval(interval);
          return prevOrders;
        }

        const newLogs = [...order.logs];
        
        // Simulating SignalParser logic
        if (step === 2) {
           // Trigger wait for input simulation
           clearInterval(interval);
           return prevOrders.map(o => o.id === orderId ? {
             ...o,
             status: OrderStatus.WAITING_INPUT,
             logs: [...newLogs, { 
               id: generateId(), 
               timestamp: timestamp(), 
               type: 'system', 
               content: 'Signal detected: await_user\nReason: Ambiguous requirement regarding authentication provider.' 
             }]
           } : o);
        }

        newLogs.push({
          id: generateId(),
          timestamp: timestamp(),
          type: 'ai',
          content: `Analyzing project structure... [${Math.floor(Math.random() * 100)}%]`
        });

        step++;
        return prevOrders.map(o => o.id === orderId ? { ...o, logs: newLogs } : o);
      });
    }, 1500);
  };

  const completeOrderSimulation = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        logs: [
          ...o.logs,
          { id: generateId(), timestamp: timestamp(), type: 'ai', content: 'Generating patches...' },
          { id: generateId(), timestamp: timestamp(), type: 'system', content: 'Applying changes to worktree...' },
          { id: generateId(), timestamp: timestamp(), type: 'success', content: 'Workflow execution completed successfully.' },
        ],
        status: OrderStatus.COMPLETED
      }
    }));
  };

  return (
    <div className="flex h-screen bg-cafe-950 text-cafe-200">
      <Sidebar 
        cafes={cafes} 
        activeCafeId={activeCafeId} 
        activeView={activeView}
        onNavigate={handleNavigate}
        onAddCafe={() => handleNavigate('dashboard')}
      />
      
      <main className="flex-1 overflow-hidden relative">
        {/* Background Texture/Gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-cafe-950 to-[#120f0e] pointer-events-none"></div>

        <div className="relative h-full z-10">
          {activeView === 'dashboard' && (
            <CafeDashboard 
              cafes={cafes} 
              onCreateCafe={handleCreateCafe} 
              onSelectCafe={(id) => handleNavigate('cafe', id)}
            />
          )}

          {activeView === 'recipes' && (
            <RecipeManager 
              recipes={recipes}
              skills={skills}
              onAddRecipe={handleAddRecipe}
              onUpdateRecipe={handleUpdateRecipe}
              onDeleteRecipe={handleDeleteRecipe}
            />
          )}

          {activeView === 'skills' && (
            <SkillManager 
              skills={skills}
              onAddSkill={handleAddSkill}
              onUpdateSkill={handleUpdateSkill}
              onDeleteSkill={handleDeleteSkill}
            />
          )}

          {activeView === 'cafe' && activeCafeId && (
            <OrderInterface 
              cafe={cafes.find(c => c.id === activeCafeId)!}
              orders={orders.filter(o => o.cafeId === activeCafeId)}
              workflows={recipes} // Passing Global Recipes to the Order Interface
              onCreateOrder={handleCreateOrder}
              onDeleteOrder={handleDeleteOrder}
              onSendInput={handleSendInput}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;