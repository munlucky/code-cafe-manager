import * as React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text, useInput, render } from 'ink';
import { StageProgress } from './components/StageProgress.js';
import { NodeStatus } from './components/NodeStatus.js';
import { RunStateManager } from '../storage/run-state.js';
import { EventLogger } from '../storage/event-logger.js';
import { RunState, StageType } from '../types.js';
import type { EventLog } from '../types.js';

export interface InteractiveRunnerProps {
  runId: string;
  onStateUpdate: (callback: (state: RunState) => void) => void;
  onEventUpdate: (callback: (event: EventLog) => void) => void;
}

export const InteractiveRunner: React.FC<InteractiveRunnerProps> = ({
  runId,
  onStateUpdate,
  onEventUpdate,
}) => {
  const [currentStage, setCurrentStage] = useState<string>('plan');
  const [currentIter, setCurrentIter] = useState<number>(0);
  const [stages, setStages] = useState([
    { name: 'Plan', status: 'pending' as const },
    { name: 'Code', status: 'pending' as const },
    { name: 'Test', status: 'pending' as const },
    { name: 'Check', status: 'pending' as const },
  ]);
  const [nodes, setNodes] = useState<
    Array<{
      id: string;
      type: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress?: number;
    }>
  >([]);
  const [lastEvent, setLastEvent] = useState<string>('');

  useEffect(() => {
    onStateUpdate((state: RunState) => {
      setCurrentStage(state.currentStage);
      setCurrentIter(state.stageIter);

      // Update stage status
      const newStages = stages.map((stage: { name: string; status: any }) => {
        const stageName = stage.name.toLowerCase();
        if (stageName === state.currentStage) {
          return { ...stage, status: 'running' as const };
        } else if (stages.findIndex((s: {name: string}) => s.name.toLowerCase() === stageName) < stages.findIndex((s: {name: string}) => s.name.toLowerCase() === state.currentStage)) {
           // Simple logic: if stage is before current, it's completed
           return { ...stage, status: 'completed' as const };
        } else if (state.status === 'completed') {
           return { ...stage, status: 'completed' as const };
        }
        return stage;
      });
      setStages(newStages);

      // Update node status
      // completedNodes is string[] in RunState, not a map
      const stageNodes = state.completedNodes || []; 
      const newNodes = stageNodes.map((nodeId: string) => ({
        id: nodeId,
        type: 'run',
        status: 'completed' as const,
      }));
      setNodes(newNodes);
    });

    onEventUpdate((event: EventLog) => {
      const msg = event.error || (event.data ? JSON.stringify(event.data) : '');
      setLastEvent(`[${event.type}] ${msg}`);
    });
  }, [onStateUpdate, onEventUpdate]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚀 Orchestrator Run: {runId}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Stage: {currentStage} (Iteration: {currentIter})
        </Text>
      </Box>

      <Box marginBottom={1}>
        <StageProgress stages={stages} />
      </Box>

      {nodes.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Text bold>Nodes:</Text>
          <NodeStatus nodes={nodes} />
        </Box>
      )}

      {lastEvent && (
        <Box marginTop={1}>
          <Text dimColor>Last event: {lastEvent}</Text>
        </Box>
      )}
    </Box>
  );
};

export function renderInteractiveRunner(
  runId: string,
  onStateUpdate: (callback: (state: RunState) => void) => void,
  onEventUpdate: (callback: (event: EventLog) => void) => void
) {
  const { unmount, waitUntilExit } = render(
    <InteractiveRunner
      runId={runId}
      onStateUpdate={onStateUpdate}
      onEventUpdate={onEventUpdate}
    />
  );

  return { unmount, waitUntilExit };
}
