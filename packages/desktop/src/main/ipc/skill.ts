/**
 * Skills IPC Handlers
 * Wraps skill preset management with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Skill Category 타입
 */
export type SkillCategory = 'analysis' | 'planning' | 'implementation' | 'verification' | 'utility';

/**
 * Skill Preset Item 타입
 */
export interface SkillPresetItem {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillCommand: string;
  context?: 'fork' | 'inherit';
  isBuiltIn?: boolean;
}

/**
 * Skill Preset 타입
 */
export interface SkillPreset {
  id: string;
  name: string;
  description: string;
  skills: SkillPresetItem[];
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * IPC Response 타입
 */
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Skill Preset 파일 형식
 */
interface SkillPresetFile {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  skills: SkillPresetItem[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T> | T,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`[IPC] Error in ${context}:`, error);

    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        details: error.details,
      },
    };
  }
}

/**
 * Get orchestrator directory
 */
function getOrchDir(): string {
  const envDir = process.env.CODECAFE_ORCH_DIR;
  if (envDir && fs.existsSync(envDir)) {
    return envDir;
  }

  const candidates = [
    process.cwd(),
    path.join(process.cwd(), '.orch'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), '.orch');
}

/**
 * Get skills directory
 */
function getSkillsDir(orchDir?: string): string {
  const baseDir = orchDir || getOrchDir();
  const skillsDir = path.join(baseDir, 'skills');

  // Ensure directory exists
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  return skillsDir;
}

/**
 * Ensure built-in preset exists
 */
function ensureBuiltInPresets(skillsDir: string): void {
  const moonshotDefaultPath = path.join(skillsDir, 'moonshot-default.json');

  // If moonshot-default doesn't exist, create it from embedded data
  if (!fs.existsSync(moonshotDefaultPath)) {
    const defaultPreset: SkillPresetFile = {
      id: 'moonshot-default',
      name: 'Moonshot Default',
      description: '기본 Moonshot 워크플로우 스킬 프리셋 (문서 메모리 기능 제외)',
      isBuiltIn: true,
      skills: [
        {
          id: 'classify-task',
          name: 'Task Classification',
          description: '사용자 요청을 작업 유형(feature, modification, bugfix, refactor)으로 분류하고 의도 키워드 추출',
          category: 'analysis',
          skillCommand: '/moonshot-classify-task',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'evaluate-complexity',
          name: 'Complexity Evaluation',
          description: '예상 파일/라인/시간을 기반으로 복잡도(simple, medium, complex) 평가',
          category: 'analysis',
          skillCommand: '/moonshot-evaluate-complexity',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'detect-uncertainty',
          name: 'Uncertainty Detection',
          description: '누락된 요구사항 감지 및 질문 생성',
          category: 'analysis',
          skillCommand: '/moonshot-detect-uncertainty',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'decide-sequence',
          name: 'Sequence Decision',
          description: 'analysisContext를 기반으로 단계와 실행 체인 결정',
          category: 'planning',
          skillCommand: '/moonshot-decide-sequence',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'pre-flight-check',
          name: 'Pre-flight Check',
          description: '작업 시작 전 필수 정보 및 프로젝트 상태 확인',
          category: 'planning',
          skillCommand: '/pre-flight-check',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'requirements-analyzer',
          name: 'Requirements Analyzer',
          description: '요구사항 분석 및 preliminary agreement 작성 (Agent)',
          category: 'planning',
          skillCommand: 'requirements-analyzer',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'context-builder',
          name: 'Context Builder',
          description: '구현 계획(context.md) 작성 (Agent)',
          category: 'planning',
          skillCommand: 'context-builder',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'implementation-runner',
          name: 'Implementation Runner',
          description: '구현 실행 및 변경사항 기록 (Agent)',
          category: 'implementation',
          skillCommand: 'implementation-runner',
          context: 'inherit',
          isBuiltIn: true,
        },
        {
          id: 'codex-review-code',
          name: 'Codex Code Review',
          description: '구현 품질 및 회귀 위험 검토 (Codex Code Reviewer)',
          category: 'verification',
          skillCommand: 'codex-review-code',
          context: 'fork',
          isBuiltIn: true,
        },
        {
          id: 'codex-test-integration',
          name: 'Codex Integration Test',
          description: '통합 영향 및 회귀 위험 검증 (Codex Integration Reviewer)',
          category: 'verification',
          skillCommand: 'codex-test-integration',
          context: 'fork',
          isBuiltIn: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(moonshotDefaultPath, JSON.stringify(defaultPreset, null, 2), 'utf-8');
    console.log('[Skills] Created moonshot-default preset');
  }
}

/**
 * List all skill presets
 */
function listPresets(skillsDir: string): SkillPreset[] {
  // Ensure built-in presets exist
  ensureBuiltInPresets(skillsDir);

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const files = fs.readdirSync(skillsDir);
  const presetFiles = files.filter((file: string) => file.endsWith('.json'));

  const presets: SkillPreset[] = [];

  for (const file of presetFiles) {
    try {
      const filePath = path.join(skillsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as SkillPresetFile;

      presets.push({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        skills: parsed.skills || [],
        isBuiltIn: parsed.isBuiltIn ?? false,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
      });
    } catch (error) {
      console.error(`[Skills] Failed to parse preset file ${file}:`, error);
    }
  }

  return presets;
}

/**
 * Get a single skill preset
 */
function getPreset(skillsDir: string, id: string): SkillPreset | null {
  // Ensure built-in presets exist
  ensureBuiltInPresets(skillsDir);

  const filePath = path.join(skillsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as SkillPresetFile;

    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      skills: parsed.skills || [],
      isBuiltIn: parsed.isBuiltIn ?? false,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch (error) {
    console.error(`[Skills] Failed to parse preset ${id}:`, error);
    return null;
  }
}

/**
 * Create a new skill preset
 */
function createPreset(skillsDir: string, presetData: SkillPreset): SkillPreset {
  // Validate ID
  if (!presetData.id || !/^[a-z0-9-]+$/.test(presetData.id)) {
    throw new Error('Invalid preset ID. Use only lowercase letters, numbers, and hyphens.');
  }

  const filePath = path.join(skillsDir, `${presetData.id}.json`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Preset with id "${presetData.id}" already exists.`);
  }

  const newPreset: SkillPresetFile = {
    id: presetData.id,
    name: presetData.name,
    description: presetData.description,
    isBuiltIn: false, // User-created presets are never built-in
    skills: presetData.skills || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(newPreset, null, 2), 'utf-8');

  return {
    ...newPreset,
    isBuiltIn: false,
  };
}

/**
 * Update an existing skill preset
 */
function updatePreset(skillsDir: string, presetData: SkillPreset): SkillPreset {
  const filePath = path.join(skillsDir, `${presetData.id}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Preset with id "${presetData.id}" not found.`);
  }

  // Check if it's a built-in preset
  const existing = getPreset(skillsDir, presetData.id);
  if (existing?.isBuiltIn) {
    throw new Error('Built-in presets cannot be modified. Please duplicate it first.');
  }

  const updatedPreset: SkillPresetFile = {
    id: presetData.id,
    name: presetData.name,
    description: presetData.description,
    isBuiltIn: false,
    skills: presetData.skills || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(updatedPreset, null, 2), 'utf-8');

  return {
    ...updatedPreset,
    isBuiltIn: false,
  };
}

/**
 * Delete a skill preset
 */
function deletePreset(skillsDir: string, id: string): { success: boolean } {
  const filePath = path.join(skillsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Preset with id "${id}" not found.`);
  }

  // Check if it's a built-in preset
  const existing = getPreset(skillsDir, id);
  if (existing?.isBuiltIn) {
    throw new Error('Built-in presets cannot be deleted.');
  }

  fs.unlinkSync(filePath);
  return { success: true };
}

/**
 * Duplicate a skill preset
 */
function duplicatePreset(skillsDir: string, id: string, newId: string, newName?: string): SkillPreset {
  const existing = getPreset(skillsDir, id);
  if (!existing) {
    throw new Error(`Preset with id "${id}" not found.`);
  }

  // Validate new ID
  if (!newId || !/^[a-z0-9-]+$/.test(newId)) {
    throw new Error('Invalid preset ID. Use only lowercase letters, numbers, and hyphens.');
  }

  const newFilePath = path.join(skillsDir, `${newId}.json`);
  if (fs.existsSync(newFilePath)) {
    throw new Error(`Preset with id "${newId}" already exists.`);
  }

  const duplicatedPreset: SkillPresetFile = {
    id: newId,
    name: newName || `${existing.name} (Copy)`,
    description: existing.description,
    isBuiltIn: false, // Duplicated presets are not built-in
    skills: existing.skills.map((skill) => ({
      ...skill,
      isBuiltIn: false, // Skills in duplicated preset are also not built-in
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(newFilePath, JSON.stringify(duplicatedPreset, null, 2), 'utf-8');

  return {
    ...duplicatedPreset,
    isBuiltIn: false,
  };
}

/**
 * Register Skill IPC Handlers
 */
export function registerSkillHandlers(): void {
  const skillsDir = getSkillsDir();

  // Ensure built-in presets on startup
  ensureBuiltInPresets(skillsDir);

  /**
   * List all skill presets
   */
  ipcMain.handle('skill:list', async () =>
    handleIpc(async () => {
      return listPresets(skillsDir);
    }, 'skill:list')
  );

  /**
   * Get a single skill preset
   */
  ipcMain.handle('skill:get', async (_, id: string) =>
    handleIpc(async () => {
      const preset = getPreset(skillsDir, id);
      if (!preset) {
        throw new Error(`Skill preset not found: ${id}`);
      }
      return preset;
    }, 'skill:get')
  );

  /**
   * Create a new skill preset
   */
  ipcMain.handle('skill:create', async (_, presetData: SkillPreset) =>
    handleIpc(async () => {
      return createPreset(skillsDir, presetData);
    }, 'skill:create')
  );

  /**
   * Update an existing skill preset
   */
  ipcMain.handle('skill:update', async (_, presetData: SkillPreset) =>
    handleIpc(async () => {
      return updatePreset(skillsDir, presetData);
    }, 'skill:update')
  );

  /**
   * Delete a skill preset
   */
  ipcMain.handle('skill:delete', async (_, id: string) =>
    handleIpc(async () => {
      return deletePreset(skillsDir, id);
    }, 'skill:delete')
  );

  /**
   * Duplicate a skill preset
   */
  ipcMain.handle('skill:duplicate', async (_, id: string, newId: string, newName?: string) =>
    handleIpc(async () => {
      return duplicatePreset(skillsDir, id, newId, newName);
    }, 'skill:duplicate')
  );

  console.log('[IPC] Skill handlers registered');
}
