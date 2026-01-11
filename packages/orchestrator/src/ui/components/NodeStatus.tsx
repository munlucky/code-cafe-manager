import * as React from 'react';
import { Box, Text } from 'ink';

export interface NodeStatusProps {
  nodes: Array<{
    id: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
  }>;
}

export const NodeStatus: React.FC<NodeStatusProps> = ({ nodes }) => {
  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '⏳';
      case 'failed':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'yellow';
      case 'failed':
        return 'red';
      case 'pending':
      default:
        return 'gray';
    }
  };

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {nodes.map((node: { id: string; status: string; type: string; progress?: number }) => (
        <Box key={node.id} flexDirection="row" gap={1}>
          <Text color={getStatusColor(node.status)}>
            {getStatusIcon(node.status)}
          </Text>
          <Text color={getStatusColor(node.status)}>
            [{node.type}] {node.id}
          </Text>
          {node.progress !== undefined && node.status === 'running' && (
            <Text color="cyan"> ({node.progress}%)</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
