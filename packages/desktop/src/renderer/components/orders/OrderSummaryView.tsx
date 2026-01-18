import { type ReactElement, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrderStageProgress, OrderStageProgressBar, type StageInfo } from '../order/OrderStageProgress';

interface OrderSummaryViewProps {
  stages: StageInfo[];
  isRunning?: boolean;
  awaitingInput?: {
    required: boolean;
    prompt?: string;
  };
  onSendInput?: (message: string) => void;
}

export function OrderSummaryView({
  stages,
  isRunning = false,
  awaitingInput,
  onSendInput
}: OrderSummaryViewProps): ReactElement {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim() && onSendInput) {
      onSendInput(inputValue);
      setInputValue('');
    }
  };

  // Show input section if explicitly awaiting OR if order is running (allows sending messages anytime)
  const showInputSection = awaitingInput?.required || isRunning;

  return (
    <div className="space-y-4">
      {/* Pipeline Progress */}
      <Card className="p-4 bg-gray-800 border-border">
         <h3 className="text-sm font-medium text-coffee mb-3">Pipeline Executing</h3>
         <OrderStageProgressBar stages={stages} className="mb-4" />
         <OrderStageProgress stages={stages} />
      </Card>

      {/* Awaiting Input Section (Yellow highlight) */}
      {awaitingInput?.required && (
        <Card className="p-4 border-yellow-500/30 bg-yellow-500/5 shadow-sm shadow-yellow-900/20">
           <h3 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
             <span>⚠️</span> Action Required
           </h3>
           <div className="text-sm text-gray-200 mb-4 bg-gray-900/50 p-3 rounded border border-gray-700/50 whitespace-pre-wrap">
             {awaitingInput.prompt || "The agent is requesting additional information to proceed."}
           </div>
           
           <div className="flex gap-2">
             <input 
               type="text" 
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Type your response here..." 
               className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-bone focus:border-coffee outline-none placeholder-gray-500"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') handleSend();
               }}
             />
             <Button 
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="bg-yellow-600 hover:bg-yellow-500 text-white border-yellow-700"
             >
               <Send className="w-4 h-4 mr-1.5" />
               Send
             </Button>
           </div>
        </Card>
      )}

      {/* General Input Section (for running orders without explicit awaiting state) */}
      {isRunning && !awaitingInput?.required && (
        <Card className="p-4 border-gray-600 bg-gray-800/50">
           <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
             <MessageSquare className="w-4 h-4" /> Send Message to Agent
           </h3>
           
           <div className="flex gap-2">
             <input 
               type="text" 
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Type a message..." 
               className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-bone focus:border-coffee outline-none placeholder-gray-500"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') handleSend();
               }}
             />
             <Button 
                onClick={handleSend}
                disabled={!inputValue.trim()}
                variant="secondary"
             >
               <Send className="w-4 h-4 mr-1.5" />
               Send
             </Button>
           </div>
        </Card>
      )}

      {/* Instructions / Tips */}
      <div className="text-xs text-gray-500 px-1">
        <p>• The pipeline automatically executes defined stages.</p>
        {isRunning && <p>• You can send messages to the agent at any time while it's running.</p>}
      </div>
    </div>
  );
}
