/**
 * Tool Extractor Module
 * 도구 정보 추출 함수들
 */

import type { ToolDetails } from '../../types/terminal';

/**
 * Tool 상세 정보 추출
 * tool_use JSON에서 상세 정보를 추출하여 ToolDetails로 반환
 */
export function extractToolDetails(content: string, toolName?: string): ToolDetails | null {
  if (!content.trim() || !toolName) return null;

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const details: ToolDetails = {
      toolType: toolName,
    };

    if (parsed.file_path) {
      details.filePath = parsed.file_path;
    }

    if (parsed.pattern) {
      details.pattern = parsed.pattern;
    }

    if (parsed.command) {
      details.command = parsed.command;
    }

    if (parsed.limit !== undefined) {
      details.lines = typeof parsed.limit === 'number' ? parsed.limit : parseInt(String(parsed.limit), 10);
    }

    if ((toolName === 'Edit' || toolName === 'Write') && parsed.old_string && parsed.new_string) {
      const oldLines = parsed.old_string.split('\n');
      const newLines = parsed.new_string.split('\n');
      const maxLines = Math.max(oldLines.length, newLines.length);

      let diffText = '';
      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] ?? '';
        const newLine = newLines[i] ?? '';
        if (oldLine !== newLine) {
          if (oldLine) diffText += `- ${oldLine}\n`;
          if (newLine) diffText += `+ ${newLine}\n`;
        } else if (oldLine) {
          diffText += `  ${oldLine}\n`;
        }
      }

      const diffLines = diffText.split('\n').filter(l => l.trim());
      details.diff = {
        shortDiff: diffLines.slice(0, 5).join('\n'),
        fullDiff: diffText,
        totalLines: diffLines.length,
      };
    }

    return Object.keys(details).length > 1 ? details : null;
  } catch {
    return null;
  }
}

/**
 * raw 텍스트에서 tool 정보 추출
 * "Tool: Bash {"command":"ls"}" 형식에서 tool 이름과 JSON 추출
 */
export function extractToolInfoFromRawText(
  content: string
): { toolName?: string; toolDetails?: ToolDetails } | null {
  const trimmed = content.trim();

  const toolPatterns = [
    /(?:▶\s*)?Tool:\s*(\w+)\s*(\{.+\})/i,
    /Using\s+tool:\s*(\w+)\s*:\s*(\{.+\})/i,
    /\[?(Tool|TOOL)\]?\s*:\s*(\w+)\s*(\{.+\})/i,
  ];

  for (const pattern of toolPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const toolName = match[1];
      const jsonStr = match[2];
      const toolDetails = extractToolDetails(jsonStr, toolName);
      if (toolDetails) {
        return { toolName, toolDetails };
      }
    }
  }

  return null;
}
