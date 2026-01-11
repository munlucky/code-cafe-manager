import * as React from 'react';
import { Box, Text } from 'ink';

export interface StageProgressProps {
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
}

export const StageProgress: React.FC<StageProgressProps> = ({ stages }) => {
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
        return '⬜';
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
    <Box flexDirection="row" gap={2}>
      {stages.map((stage: { name: string; status: string }, index: number) => (
        <React.Fragment key={stage.name}>
          <Box>
            <Text color={getStatusColor(stage.status)}>
              {getStatusIcon(stage.status)} {stage.name}
            </Text>
          </Box>
          {index < stages.length - 1 && (
            <Text color="gray"> → </Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};
