/**
 * Skills IPC Handlers
 * 단일 스킬 관리 API (프리셋이 아닌 개별 스킬)
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Skill Category 타입
 */
export type SkillCategory = 'analysis' | 'planning' | 'implementation' | 'verification' | 'utility';

/**
 * 단일 Skill 타입
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillCommand: string;
  context?: 'fork' | 'inherit';
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
 * Skill 파일 형식 (저장용)
 */
interface SkillFile {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillCommand: string;
  context?: 'fork' | 'inherit';
  isBuiltIn?: boolean;
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
 * Built-in 스킬 목록 (개별 스킬)
 */
const BUILT_IN_SKILLS: Skill[] = [
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
];

/**
 * Ensure built-in skills exist as individual files
 */
function ensureBuiltInSkills(skillsDir: string): void {
  for (const skill of BUILT_IN_SKILLS) {
    const skillPath = path.join(skillsDir, `${skill.id}.json`);

    // 내장 스킬 파일이 없으면 생성
    if (!fs.existsSync(skillPath)) {
      const skillFile: SkillFile = {
        ...skill,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(skillPath, JSON.stringify(skillFile, null, 2), 'utf-8');
      console.log(`[Skills] Created built-in skill: ${skill.id}`);
    }
  }
}

/**
 * List all skills (개별 스킬 목록)
 */
function listSkills(skillsDir: string): Skill[] {
  // Ensure built-in skills exist
  ensureBuiltInSkills(skillsDir);

  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  const files = fs.readdirSync(skillsDir);
  const skillFiles = files.filter((file: string) => file.endsWith('.json'));

  const skills: Skill[] = [];

  for (const file of skillFiles) {
    try {
      const filePath = path.join(skillsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as SkillFile;

      skills.push({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        skillCommand: parsed.skillCommand,
        context: parsed.context || 'fork',
        isBuiltIn: parsed.isBuiltIn ?? false,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
      });
    } catch (error) {
      console.error(`[Skills] Failed to parse skill file ${file}:`, error);
    }
  }

  // 카테고리별 정렬 후 이름순 정렬
  const categoryOrder: SkillCategory[] = ['analysis', 'planning', 'implementation', 'verification', 'utility'];
  skills.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  return skills;
}

/**
 * Get a single skill
 */
function getSkill(skillsDir: string, id: string): Skill | null {
  // Ensure built-in skills exist
  ensureBuiltInSkills(skillsDir);

  const filePath = path.join(skillsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as SkillFile;

    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      skillCommand: parsed.skillCommand,
      context: parsed.context || 'fork',
      isBuiltIn: parsed.isBuiltIn ?? false,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch (error) {
    console.error(`[Skills] Failed to parse skill ${id}:`, error);
    return null;
  }
}

/**
 * Create a new skill
 */
function createSkill(skillsDir: string, skillData: Skill): Skill {
  // Validate ID
  if (!skillData.id || !/^[a-z0-9-]+$/.test(skillData.id)) {
    throw new Error('Invalid skill ID. Use only lowercase letters, numbers, and hyphens.');
  }

  const filePath = path.join(skillsDir, `${skillData.id}.json`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Skill with id "${skillData.id}" already exists.`);
  }

  const newSkill: SkillFile = {
    id: skillData.id,
    name: skillData.name,
    description: skillData.description,
    category: skillData.category,
    skillCommand: skillData.skillCommand,
    context: skillData.context || 'fork',
    isBuiltIn: false, // User-created skills are never built-in
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(newSkill, null, 2), 'utf-8');

  return {
    ...newSkill,
    isBuiltIn: false,
  };
}

/**
 * Update an existing skill
 */
function updateSkill(skillsDir: string, skillData: Skill): Skill {
  const filePath = path.join(skillsDir, `${skillData.id}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Skill with id "${skillData.id}" not found.`);
  }

  // Check if it's a built-in skill
  const existing = getSkill(skillsDir, skillData.id);
  if (existing?.isBuiltIn) {
    throw new Error('Built-in skills cannot be modified. Please duplicate it first.');
  }

  const updatedSkill: SkillFile = {
    id: skillData.id,
    name: skillData.name,
    description: skillData.description,
    category: skillData.category,
    skillCommand: skillData.skillCommand,
    context: skillData.context || 'fork',
    isBuiltIn: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(updatedSkill, null, 2), 'utf-8');

  return {
    ...updatedSkill,
    isBuiltIn: false,
  };
}

/**
 * Delete a skill
 */
function deleteSkill(skillsDir: string, id: string): { success: boolean } {
  const filePath = path.join(skillsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Skill with id "${id}" not found.`);
  }

  // Check if it's a built-in skill
  const existing = getSkill(skillsDir, id);
  if (existing?.isBuiltIn) {
    throw new Error('Built-in skills cannot be deleted.');
  }

  fs.unlinkSync(filePath);
  return { success: true };
}

/**
 * Duplicate a skill
 */
function duplicateSkill(skillsDir: string, id: string, newId: string, newName?: string): Skill {
  const existing = getSkill(skillsDir, id);
  if (!existing) {
    throw new Error(`Skill with id "${id}" not found.`);
  }

  // Validate new ID
  if (!newId || !/^[a-z0-9-]+$/.test(newId)) {
    throw new Error('Invalid skill ID. Use only lowercase letters, numbers, and hyphens.');
  }

  const newFilePath = path.join(skillsDir, `${newId}.json`);
  if (fs.existsSync(newFilePath)) {
    throw new Error(`Skill with id "${newId}" already exists.`);
  }

  const duplicatedSkill: SkillFile = {
    id: newId,
    name: newName || `${existing.name} (Copy)`,
    description: existing.description,
    category: existing.category,
    skillCommand: existing.skillCommand,
    context: existing.context || 'fork',
    isBuiltIn: false, // Duplicated skills are not built-in
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(newFilePath, JSON.stringify(duplicatedSkill, null, 2), 'utf-8');

  return {
    ...duplicatedSkill,
    isBuiltIn: false,
  };
}

/**
 * Register Skill IPC Handlers
 */
export function registerSkillHandlers(): void {
  const skillsDir = getSkillsDir();

  // Ensure built-in skills on startup
  ensureBuiltInSkills(skillsDir);

  /**
   * List all skills
   */
  ipcMain.handle('skill:list', async () =>
    handleIpc(async () => {
      return listSkills(skillsDir);
    }, 'skill:list')
  );

  /**
   * Get a single skill
   */
  ipcMain.handle('skill:get', async (_, id: string) =>
    handleIpc(async () => {
      const skill = getSkill(skillsDir, id);
      if (!skill) {
        throw new Error(`Skill not found: ${id}`);
      }
      return skill;
    }, 'skill:get')
  );

  /**
   * Create a new skill
   */
  ipcMain.handle('skill:create', async (_, skillData: Skill) =>
    handleIpc(async () => {
      return createSkill(skillsDir, skillData);
    }, 'skill:create')
  );

  /**
   * Update an existing skill
   */
  ipcMain.handle('skill:update', async (_, skillData: Skill) =>
    handleIpc(async () => {
      return updateSkill(skillsDir, skillData);
    }, 'skill:update')
  );

  /**
   * Delete a skill
   */
  ipcMain.handle('skill:delete', async (_, id: string) =>
    handleIpc(async () => {
      return deleteSkill(skillsDir, id);
    }, 'skill:delete')
  );

  /**
   * Duplicate a skill
   */
  ipcMain.handle('skill:duplicate', async (_, id: string, newId: string, newName?: string) =>
    handleIpc(async () => {
      return duplicateSkill(skillsDir, id, newId, newName);
    }, 'skill:duplicate')
  );

  console.log('[IPC] Skill handlers registered');
}

// Legacy exports for backward compatibility
export type { Skill as SkillPresetItem };
export interface SkillPreset {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
