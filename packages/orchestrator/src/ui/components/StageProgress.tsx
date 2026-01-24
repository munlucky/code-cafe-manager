import * as React from 'react';
import { Box, Text } from 'ink';

export interface StageProgressProps {
  stages: Array<{
    stageId: string;     // 원래 Stage ID (예: analyze, plan, code)
    category: string;    // 카테고리 (예: ANALYSIS, PLANNING, IMPLEMENTATION, VERIFICATION)
    status: 'pending' | 'running' | 'completed' | 'failed';
    skills?: string[];   // 이 Stage에서 사용하는 스킬 목록
  }>;
  showSkills?: boolean; // 스킬 목록 표시 여부 (기본: false)
}

export const StageProgress: React.FC<StageProgressProps> = ({ stages, showSkills = false }) => {
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
    <Box flexDirection="column" gap={1}>
      {stages.map((stage: { stageId: string; category: string; status: string; skills?: string[] }, index: number) => (
        <Box key={stage.stageId} flexDirection="column">
          <Box flexDirection="row" gap={2}>
            <Box>
              <Text color={getStatusColor(stage.status)}>
                {getStatusIcon(stage.status)} {stage.stageId} ({stage.category})
              </Text>
            </Box>
            {index < stages.length - 1 && (
              <Box marginTop={1}>
                <Text color="gray">↓</Text>
              </Box>
            )}
          </Box>
          {showSkills && stage.skills && stage.skills.length > 0 && (
            <Box paddingLeft={3} flexDirection="row">
              <Text dimColor>
                [{stage.skills.join(', ')}]
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};
