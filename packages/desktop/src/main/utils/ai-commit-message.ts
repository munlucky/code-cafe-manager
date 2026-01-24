/**
 * AI Commit Message Generator
 * git diff를 분석해서 AI로 커밋 메시지를 생성
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface GenerateCommitMessageOptions {
  worktreePath: string;
  orderPrompt?: string;
}

interface CommitMessageResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Git diff stat을 가져옴
 */
async function getGitDiffStat(worktreePath: string): Promise<string> {
  try {
    // staged 변경사항 확인
    const { stdout: stagedDiff } = await execFileAsync(
      'git',
      ['diff', '--cached', '--stat'],
      { cwd: worktreePath }
    );

    // unstaged 변경사항 확인
    const { stdout: unstagedDiff } = await execFileAsync(
      'git',
      ['diff', '--stat'],
      { cwd: worktreePath }
    );

    // untracked 파일 확인
    const { stdout: untrackedFiles } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: worktreePath }
    );

    const parts: string[] = [];
    if (stagedDiff.trim()) {
      parts.push('Staged changes:\n' + stagedDiff.trim());
    }
    if (unstagedDiff.trim()) {
      parts.push('Unstaged changes:\n' + unstagedDiff.trim());
    }
    if (untrackedFiles.trim()) {
      const files = untrackedFiles.trim().split('\n').slice(0, 10);
      parts.push('New files:\n' + files.join('\n') + (files.length === 10 ? '\n...' : ''));
    }

    return parts.join('\n\n') || 'No changes detected';
  } catch (error) {
    return 'Unable to get diff stats';
  }
}

/**
 * Anthropic API로 커밋 메시지 생성
 */
async function generateWithAnthropic(
  diffStat: string,
  orderPrompt?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found');
  }

  const systemPrompt = `You are a git commit message generator. Generate a concise, conventional commit message based on the changes provided.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, refactor, docs, style, test, chore
- First line should be under 72 characters
- Be specific about what changed
- Do not include any explanation, just output the commit message`;

  const userPrompt = orderPrompt
    ? `Task: ${orderPrompt}\n\nChanges:\n${diffStat}`
    : `Changes:\n${diffStat}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error('No content in Anthropic response');
  }

  return content.trim();
}

/**
 * OpenAI API로 커밋 메시지 생성 (fallback)
 */
async function generateWithOpenAI(
  diffStat: string,
  orderPrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const systemPrompt = `You are a git commit message generator. Generate a concise, conventional commit message based on the changes provided.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, refactor, docs, style, test, chore
- First line should be under 72 characters
- Be specific about what changed
- Do not include any explanation, just output the commit message`;

  const userPrompt = orderPrompt
    ? `Task: ${orderPrompt}\n\nChanges:\n${diffStat}`
    : `Changes:\n${diffStat}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return content.trim();
}

/**
 * Order prompt 기반 간단한 커밋 메시지 생성 (AI 없이)
 */
function generateSimpleMessage(diffStat: string, orderPrompt?: string): string {
  if (orderPrompt) {
    // Order prompt의 첫 줄을 제목으로 사용
    const firstLine = orderPrompt.split('\n')[0].trim();
    const title = firstLine.length > 72
      ? firstLine.slice(0, 69) + '...'
      : firstLine;
    return title;
  }

  // diff stat에서 변경된 파일 수 추출
  const fileMatch = diffStat.match(/(\d+) files? changed/);
  const filesChanged = fileMatch ? fileMatch[1] : 'some';

  return `chore: update ${filesChanged} files`;
}

/**
 * AI 커밋 메시지 생성 (메인 함수)
 * Anthropic -> OpenAI -> Simple 순서로 fallback
 */
export async function generateCommitMessage(
  options: GenerateCommitMessageOptions
): Promise<CommitMessageResult> {
  const { worktreePath, orderPrompt } = options;

  try {
    // 1. Git diff stat 가져오기
    const diffStat = await getGitDiffStat(worktreePath);
    console.log('[AI Commit] Diff stat:', diffStat.slice(0, 200) + '...');

    // 2. Anthropic API 시도
    try {
      const message = await generateWithAnthropic(diffStat, orderPrompt);
      console.log('[AI Commit] Generated with Anthropic:', message);
      return { success: true, message };
    } catch (anthropicError: any) {
      console.log('[AI Commit] Anthropic failed:', anthropicError.message);
    }

    // 3. OpenAI API fallback
    try {
      const message = await generateWithOpenAI(diffStat, orderPrompt);
      console.log('[AI Commit] Generated with OpenAI:', message);
      return { success: true, message };
    } catch (openaiError: any) {
      console.log('[AI Commit] OpenAI failed:', openaiError.message);
    }

    // 4. Simple fallback (AI 없이)
    const message = generateSimpleMessage(diffStat, orderPrompt);
    console.log('[AI Commit] Generated simple message:', message);
    return { success: true, message };

  } catch (error: any) {
    console.error('[AI Commit] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate commit message',
    };
  }
}
