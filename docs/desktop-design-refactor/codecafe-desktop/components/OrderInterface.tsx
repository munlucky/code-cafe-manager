import React, { useState } from 'react';
import { 
  Plus, 
  Trash2,
  Box,
  Coffee,
  List,
  Activity,
  GitBranch,
  Split,
  ChevronRight
} from 'lucide-react';
import { Cafe, Order, OrderStatus, Recipe } from '../types';
import { OrderStageProgress } from './OrderStageProgress';
import { InteractiveTerminal } from './InteractiveTerminal';
import { OrderTimelineView } from './OrderTimelineView';

interface OrderInterfaceProps {
  cafe: Cafe;
  orders: Order[];
  workflows: Recipe[];
  onCreateOrder: (cafeId: string, workflowId: string, description: string, useWorktree: boolean) => void;
  onDeleteOrder: (orderId: string) => void;
  onSendInput: (orderId: string, input: string) => void;
}

export const OrderInterface: React.FC<OrderInterfaceProps> = ({
  cafe,
  orders,
  workflows,
  onCreateOrder,
  onDeleteOrder,
  onSendInput
}) => {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline'>('summary');
  
  // Create Order Form State
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflows[0]?.id || '');
  const [description, setDescription] = useState('');
  const [useWorktree, setUseWorktree] = useState(true);

  const activeOrder = orders.find(o => o.id === activeOrderId);
  const activeRecipe = activeOrder ? workflows.find(w => w.id === activeOrder.workflowId) : null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedWorkflow) {
        onCreateOrder(cafe.id, selectedWorkflow, description, useWorktree);
        setShowCreateModal(false);
        setDescription('');
    }
  };

  return (
    <div className="flex h-screen bg-cafe-950 overflow-hidden">
      {/* Left Panel: Order List (Kanban-ish) */}
      <div className="w-80 border-r border-cafe-800 flex flex-col bg-cafe-900 shadow-xl z-10">
        <div className="p-5 border-b border-cafe-800 bg-cafe-900">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-cafe-100 truncate text-lg tracking-tight">{cafe.name}</h2>
            <span className="text-[10px] bg-cafe-800 px-2 py-1 rounded-md text-cafe-400 font-mono border border-cafe-700 flex items-center">
              <GitBranch className="w-3 h-3 mr-1" />
              {cafe.settings.baseBranch}
            </span>
          </div>
          <p className="text-xs text-cafe-500 font-mono truncate mb-6 opacity-70">
            {cafe.path}
          </p>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-brand hover:bg-brand-hover text-white text-sm rounded-xl transition-all font-bold shadow-lg shadow-brand/20 hover:shadow-brand/40 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {orders.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full text-cafe-600">
              <Coffee className="w-8 h-8 mb-3 opacity-20" />
              <span className="text-sm font-medium">No active orders</span>
              <span className="text-xs opacity-60 mt-1">Start brewing some code</span>
            </div>
          ) : (
             orders.map(order => (
                <div 
                  key={order.id}
                  onClick={() => setActiveOrderId(order.id)}
                  className={`group relative p-4 cursor-pointer transition-all duration-200 rounded-xl border ${
                    activeOrderId === order.id 
                      ? 'bg-cafe-800 border-brand shadow-lg' 
                      : 'bg-cafe-850/50 border-cafe-800 hover:border-cafe-600 hover:bg-cafe-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-cafe-500 uppercase tracking-widest">
                        #{order.id.substring(0,6)}
                    </span>
                    <StatusDot status={order.status} />
                  </div>
                  
                  <h3 className={`text-sm font-bold mb-3 ${activeOrderId === order.id ? 'text-white' : 'text-cafe-200'}`}>
                    {order.workflowName}
                  </h3>

                  <div className="flex items-center justify-between">
                     {order.worktreeInfo ? (
                        <div className="flex items-center text-[10px] text-cafe-500 bg-cafe-950/50 px-2 py-1 rounded">
                            <Split className="w-3 h-3 mr-1.5 text-brand/70" />
                            <span className="truncate max-w-[100px]">{order.worktreeInfo.branch}</span>
                        </div>
                     ) : (
                        <div className="text-[10px] text-cafe-600">Main Repo</div>
                     )}
                     
                     <ChevronRight className={`w-4 h-4 text-cafe-600 transition-transform ${activeOrderId === order.id ? 'translate-x-1 text-brand' : 'group-hover:translate-x-1'}`} />
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Main Panel: Order Details */}
      <div className="flex-1 flex flex-col min-w-0 bg-terminal-bg">
        {!activeOrder ? (
          <div className="flex-1 flex flex-col items-center justify-center text-cafe-600 bg-cafe-950">
            <div className="w-24 h-24 bg-cafe-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-cafe-800 animate-pulse">
              <Box className="w-10 h-10 opacity-30 text-brand" />
            </div>
            <p className="text-xl font-medium text-cafe-400">Select an order</p>
            <p className="text-sm opacity-50 mt-2">View execution logs and worktree details</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="h-16 border-b border-cafe-800 flex items-center justify-between px-6 bg-cafe-900 shadow-md z-10">
              <div className="flex items-center gap-4">
                 <div>
                    <h2 className="font-bold text-cafe-100 text-lg flex items-center">
                        {activeOrder.workflowName}
                        <span className="ml-3 text-xs font-normal text-cafe-500 font-mono bg-cafe-800 px-2 py-0.5 rounded">#{activeOrder.id}</span>
                    </h2>
                 </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => onDeleteOrder(activeOrder.id)}
                  className="p-2 text-cafe-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                  title="Delete Order & Worktree"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-cafe-800 bg-cafe-900/50 px-6">
                    <TabButton 
                        active={activeTab === 'summary'} 
                        onClick={() => setActiveTab('summary')}
                        icon={<List className="w-4 h-4 mr-2" />}
                        label="Console & Progress"
                    />
                    <TabButton 
                        active={activeTab === 'timeline'} 
                        onClick={() => setActiveTab('timeline')}
                        icon={<Activity className="w-4 h-4 mr-2" />}
                        label="Timeline Events"
                    />
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'summary' && (
                        <div className="absolute inset-0 flex flex-col p-6 gap-6">
                             {/* Top: Progress */}
                             <div className="bg-cafe-900 p-5 rounded-xl border border-cafe-800 shadow-lg shrink-0">
                                <OrderStageProgress 
                                    stages={activeRecipe?.stages || []}
                                    currentStage={activeOrder.currentStage}
                                    stageStatuses={activeOrder.stageStatuses}
                                />
                             </div>

                             {/* Bottom: Terminal */}
                             <div className="flex-1 min-h-0">
                                <InteractiveTerminal 
                                    order={activeOrder}
                                    onSendInput={(input) => onSendInput(activeOrder.id, input)}
                                />
                             </div>
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="absolute inset-0 overflow-y-auto">
                            <OrderTimelineView logs={activeOrder.logs} />
                        </div>
                    )}
                </div>
            </div>
          </>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-cafe-900 border border-cafe-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-cafe-800 bg-cafe-850">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-brand" />
                New Order
              </h2>
              <p className="text-cafe-500 text-sm mt-1">Orchestrate a new workflow for <span className="text-cafe-300 font-mono font-medium">{cafe.name}</span></p>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-3 tracking-wider">Select Workflow</label>
                <div className="grid grid-cols-1 gap-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {workflows.map(wf => (
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
                        <span className={`font-bold ${selectedWorkflow === wf.id ? 'text-brand-light' : 'text-cafe-200'}`}>{wf.name}</span>
                        {selectedWorkflow === wf.id && <div className="w-2 h-2 rounded-full bg-brand"></div>}
                      </div>
                      <p className="text-xs text-cafe-500 line-clamp-2">{wf.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-2 tracking-wider">Description / Prompt</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What would you like the barista to do?"
                  className="w-full h-24 bg-cafe-950 border border-cafe-700 text-cafe-200 rounded-xl p-4 focus:ring-2 focus:ring-brand outline-none text-sm resize-none font-mono"
                />
              </div>

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
                  <span className="block text-sm font-bold text-cafe-200">Isolate in Worktree</span>
                  <span className="block text-xs text-cafe-500 mt-0.5">Creates a temporary git worktree to prevent conflicts.</span>
                </label>
                <div className="bg-cafe-800 p-1.5 rounded-lg">
                    <Split className="w-5 h-5 text-cafe-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-cafe-800">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-cafe-400 hover:text-cafe-200 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!selectedWorkflow}
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-components for cleaner code
const StatusDot = ({ status }: { status: OrderStatus }) => {
    switch(status) {
        case OrderStatus.RUNNING: return <div className="flex items-center gap-1.5 text-brand text-[10px] font-bold"><div className="w-2 h-2 rounded-full bg-brand animate-pulse" />RUNNING</div>;
        case OrderStatus.COMPLETED: return <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold"><div className="w-2 h-2 rounded-full bg-emerald-500" />DONE</div>;
        case OrderStatus.WAITING_INPUT: return <div className="flex items-center gap-1.5 text-yellow-500 text-[10px] font-bold"><div className="w-2 h-2 rounded-full bg-yellow-500 animate-bounce" />INPUT</div>;
        case OrderStatus.FAILED: return <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold"><div className="w-2 h-2 rounded-full bg-red-500" />FAILED</div>;
        default: return <div className="flex items-center gap-1.5 text-cafe-500 text-[10px] font-bold"><div className="w-2 h-2 rounded-full bg-cafe-600" />PENDING</div>;
    }
}

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            active 
            ? 'border-brand text-brand' 
            : 'border-transparent text-cafe-400 hover:text-cafe-200'
        }`}
    >
        {icon}
        {label}
    </button>
)
