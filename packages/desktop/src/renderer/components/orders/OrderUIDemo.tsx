import { useState } from 'react';
import { OrderCard } from './OrderCard';
import { OrderModal } from './OrderModal';
import { OrderStatus } from '../../types/models';
import type { Order } from '../../types/models';
import type { StageInfo } from '../order/OrderStageProgress';
import type { TimelineEvent } from './OrderTimelineView';

// Dummy Data
const dummyOrder: Order = {
  id: 'order-12345678-abcd-efgh',
  workflowId: 'wf-auth',
  workflowName: 'Implement User Auth',
  baristaId: 'barista-1',
  status: OrderStatus.RUNNING,
  counter: '1',
  provider: 'claude-code',
  vars: {},
  createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  endedAt: null,
};

const dummyStages: StageInfo[] = [
  { name: 'Analyze', status: 'completed' },
  { name: 'Plan', status: 'completed' },
  { name: 'Code', status: 'running' },
  { name: 'Review', status: 'pending' },
];

const dummyEvents: TimelineEvent[] = [
  { id: '1', type: 'stage_start', timestamp: new Date(Date.now() - 60000).toISOString(), content: 'Starting stage: Analyze', stageName: 'Analyze' },
  { id: '2', type: 'log', timestamp: new Date(Date.now() - 55000).toISOString(), content: 'Analyzing project structure...' },
  { id: '3', type: 'log', timestamp: new Date(Date.now() - 50000).toISOString(), content: 'Found 15 files to review.' },
  { id: '4', type: 'stage_complete', timestamp: new Date(Date.now() - 40000).toISOString(), content: 'Analysis complete', stageName: 'Analyze' },
  { id: '5', type: 'stage_start', timestamp: new Date(Date.now() - 39000).toISOString(), content: 'Starting stage: Plan', stageName: 'Plan' },
  { id: '6', type: 'log', timestamp: new Date(Date.now() - 35000).toISOString(), content: 'Generating implementation plan...' },
  { id: '7', type: 'stage_complete', timestamp: new Date(Date.now() - 30000).toISOString(), content: 'Plan generated', stageName: 'Plan' },
  { id: '8', type: 'stage_start', timestamp: new Date(Date.now() - 29000).toISOString(), content: 'Starting stage: Code', stageName: 'Code' },
  { id: '9', type: 'log', timestamp: new Date(Date.now() - 25000).toISOString(), content: 'Writing code for auth.ts...' },
  { id: '10', type: 'input', timestamp: new Date(Date.now() - 20000).toISOString(), content: 'Please confirm authentication method (JWT/Session)?' },
];

export function OrderUIDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<string | null>(null);

  const handleView = (id: string) => {
    setActiveOrder(id);
    setModalOpen(true);
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-bone">
      <h1 className="text-2xl font-bold mb-6 text-bone">Order UI Component Demo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Running */}
        <OrderCard 
          order={dummyOrder} 
          stages={dummyStages}
          onView={handleView}
          onCancel={() => alert('Cancel')}
        />

        {/* Card 2: Completed */}
        <OrderCard 
          order={{...dummyOrder, id: 'order-complete', status: OrderStatus.COMPLETED, workflowName: 'Fix Login Bug'}} 
          stages={dummyStages.map(s => ({...s, status: 'completed'}))}
          onView={handleView}
          onCancel={() => alert('Cancel')}
        />

        {/* Card 3: Failed */}
        <OrderCard 
          order={{...dummyOrder, id: 'order-fail', status: OrderStatus.FAILED, workflowName: 'Database Migration'}} 
          stages={[
            { name: 'Analyze', status: 'completed' },
            { name: 'Plan', status: 'failed' },
            { name: 'Execute', status: 'pending' },
          ]}
          onView={handleView}
          onCancel={() => alert('Cancel')}
        />
      </div>

      <OrderModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        order={dummyOrder}
        stages={dummyStages}
        timelineEvents={dummyEvents}
        onSendInput={(msg) => alert(`Sent: ${msg}`)}
      />
    </div>
  );
}
