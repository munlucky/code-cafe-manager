import { type ReactElement, useState } from 'react';
import { Send, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Input } from '../ui/Input';
import { OrderStageProgress, type StageInfo } from '../order/OrderStageProgress';

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
      <div className="p-4 bg-cafe-900 rounded-xl border border-cafe-800">
         <h3 className="text-xs font-bold text-cafe-500 uppercase tracking-wider mb-3">Pipeline Progress</h3>
         <OrderStageProgress stages={stages} />
      </div>

      {/* Awaiting Input Section (Yellow highlight) */}
      {awaitingInput?.required && (
        <div className="p-4 border border-yellow-500/40 bg-yellow-500/10 shadow-lg shadow-yellow-900/20 rounded-xl">
           <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
             <AlertTriangle className="w-4 h-4" />
             Action Required
           </h3>
           <div className="text-sm text-cafe-200 mb-4 bg-cafe-950/80 p-3 rounded-lg border border-yellow-500/20 whitespace-pre-wrap font-mono">
             {awaitingInput.prompt || "The agent is requesting additional information to proceed."}
           </div>

           <div className="flex gap-2">
             <Input
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Type your response here..."
               className="flex-1"
               intent="warning"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') handleSend();
               }}
               autoFocus
             />
             <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  "px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5",
                  inputValue.trim()
                    ? "bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/20"
                    : "bg-cafe-800 text-cafe-600 cursor-not-allowed"
                )}
             >
               <Send className="w-4 h-4" />
               Send
             </button>
           </div>
        </div>
      )}

      {/* General Input Section (for running orders without explicit awaiting state) */}
      {isRunning && !awaitingInput?.required && (
        <div className="p-4 border border-cafe-700 bg-cafe-900/50 rounded-xl">
           <h3 className="text-xs font-bold text-cafe-500 uppercase mb-2 flex items-center gap-2">
             <MessageSquare className="w-4 h-4" /> Send Message to Agent
           </h3>

           <div className="flex gap-2">
             <Input
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Type a message..."
               className="flex-1"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') handleSend();
               }}
             />
             <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  "px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-1.5",
                  inputValue.trim()
                    ? "bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/20"
                    : "bg-cafe-800 text-cafe-600 cursor-not-allowed"
                )}
             >
               <Send className="w-4 h-4" />
               Send
             </button>
           </div>
        </div>
      )}

      {/* Instructions / Tips */}
      <div className="text-xs text-cafe-600 px-1 space-y-1">
        <p>• The pipeline automatically executes defined stages.</p>
        {isRunning && <p>• You can send messages to the agent at any time while it's running.</p>}
      </div>
    </div>
  );
}
