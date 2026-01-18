#!/usr/bin/env npx tsx
/**
 * Claude CLI Interactive Test Script
 *
 * Order 실행 흐름의 각 단계를 개별 테스트:
 * 1. spawn - PTY 생성 및 Claude CLI 시작
 * 2. sendPrompt - 프롬프트 전송
 * 3. readOutput - 응답 읽기
 *
 * Usage:
 *   npx tsx scripts/test-claude-cli.ts [command]
 *
 * Commands:
 *   spawn       - Test spawn only (start Claude CLI)
 *   prompt      - Test spawn + send prompt
 *   full        - Test full flow (spawn + prompt + read output)
 *   interactive - Interactive mode (manual input)
 */

import * as pty from 'node-pty';
import * as os from 'os';
import * as readline from 'readline';
import * as fs from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  WAIT_TIMEOUT: 20000,
  EXECUTE_TIMEOUT: 60000, // 1 minute for testing
  IDLE_TIMEOUT: 10000,    // 10 seconds idle timeout
  TERM_COLS: 120,
  TERM_ROWS: 30,
};

const TEST_PROMPT = '현재 디렉토리의 파일 목록을 보여줘';

// ============================================================================
// Utility Functions
// ============================================================================

function log(step: string, details: Record<string, unknown> = {}): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${step}]`, JSON.stringify(details, null, 2));
}

function getLineEnding(): string {
  return os.platform() === 'win32' ? '\r' : '\n';
}

function isPromptDetected(buffer: string): boolean {
  const promptChars = '[>›»❯]';
  const patterns = [
    new RegExp(`claude\\s*${promptChars}`, 'i'),
    /ready/i,
    /welcome/i,
    new RegExp(`${promptChars}\\s*$`),
  ];
  return patterns.some(p => p.test(buffer));
}

function isCompleted(buffer: string): boolean {
  const completionPatterns = [
    /\[DONE\]/i,
    /Total cost:/i,
    /tokens used/i,
    /claude>/i,
    /❯\s*$/,
    />\s*$/,
  ];
  return completionPatterns.some(p => p.test(buffer));
}

function findClaude(): string {
  const isWindows = os.platform() === 'win32';

  // Try common paths
  const paths = isWindows
    ? [
        `${process.env.USERPROFILE}\\.local\\bin\\claude.exe`,
        `${process.env.LOCALAPPDATA}\\Programs\\claude\\claude.exe`,
      ]
    : [
        `${process.env.HOME}/.local/bin/claude`,
        '/usr/local/bin/claude',
      ];

  for (const p of paths) {
    try {
      fs.accessSync(p);
      return p;
    } catch {}
  }

  return 'claude'; // Fallback to PATH
}

/**
 * Step 1: Spawn PTY and start Claude CLI
 */
async function testSpawn(cwd?: string): Promise<pty.IPty> {
  log('spawn-start', { cwd: cwd || process.cwd() });

  const isWindows = os.platform() === 'win32';
  const shell = isWindows ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
  const shellArgs = isWindows
    ? ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass']
    : ['--login'];

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: CONFIG.TERM_COLS,
    rows: CONFIG.TERM_ROWS,
    cwd: cwd || process.cwd(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
    },
  });

  log('pty-spawned', { pid: ptyProcess.pid, shell });

  // Buffer for output
  let buffer = '';

  // Log all output
  ptyProcess.onData((data: string) => {
    buffer += data;
    // Clean ANSI for logging
    const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
    if (clean) {
      console.log(`[PTY] ${clean.substring(0, 200)}`);
    }
  });

  // Wait for shell ready
  log('waiting-shell-ready');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Claude CLI
  const claudePath = findClaude();
  const claudeCmd = isWindows ? `& "${claudePath}"` : claudePath;

  log('starting-claude', { claudeCmd });
  ptyProcess.write(claudeCmd + getLineEnding());

  // Wait for Claude prompt
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Claude CLI init timeout. Buffer: ${buffer.slice(-500)}`));
    }, CONFIG.WAIT_TIMEOUT);

    const checkPrompt = setInterval(() => {
      if (isPromptDetected(buffer)) {
        clearTimeout(timeout);
        clearInterval(checkPrompt);
        log('claude-ready', { bufferLength: buffer.length });
        resolve(ptyProcess);
      }
    }, 500);
  });
}

/**
 * Step 2: Send prompt to Claude CLI
 */
async function testSendPrompt(
  ptyProcess: pty.IPty,
  prompt: string,
  lineEnding: string = '\r'
): Promise<void> {
  log('send-prompt-start', {
    prompt: prompt.substring(0, 50),
    lineEnding: lineEnding === '\r' ? '\\r' : lineEnding === '\n' ? '\\n' : '\\r\\n',
  });

  // Send prompt with specified line ending
  ptyProcess.write(prompt + lineEnding);

  log('send-prompt-done');

  // Wait a bit for echo
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Step 3: Read output until completion
 */
async function testReadOutput(
  ptyProcess: pty.IPty,
  timeout: number = CONFIG.EXECUTE_TIMEOUT
): Promise<string> {
  log('read-output-start', { timeout });

  return new Promise((resolve) => {
    let output = '';
    let idleTimer: NodeJS.Timeout | null = null;
    let dataDisposable: { dispose(): void } | null = null;

    const hardTimeout = setTimeout(() => {
      log('hard-timeout', { outputLength: output.length });
      cleanup();
      resolve(output);
    }, timeout);

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        log('idle-timeout', { outputLength: output.length });
        if (isCompleted(output)) {
          cleanup();
          resolve(output);
        }
      }, CONFIG.IDLE_TIMEOUT);
    };

    const cleanup = () => {
      clearTimeout(hardTimeout);
      if (idleTimer) clearTimeout(idleTimer);
      if (dataDisposable) dataDisposable.dispose();
    };

    dataDisposable = ptyProcess.onData((data: string) => {
      output += data;
      resetIdleTimer();

      // Check for completion
      if (isCompleted(output)) {
        log('completion-detected');
        cleanup();
        resolve(output);
      }
    });

    resetIdleTimer();
  });
}

/**
 * Full flow test
 */
async function testFullFlow(prompt: string, lineEnding: string = '\r'): Promise<void> {
  console.log('\n========================================');
  console.log('Full Flow Test');
  console.log(`Line ending: ${lineEnding === '\r' ? '\\r' : lineEnding === '\n' ? '\\n' : '\\r\\n'}`);
  console.log('========================================\n');

  try {
    // Step 1: Spawn
    const ptyProcess = await testSpawn();

    // Step 2: Send prompt
    await testSendPrompt(ptyProcess, prompt, lineEnding);

    // Step 3: Read output
    const output = await testReadOutput(ptyProcess, 30000); // 30 seconds for test

    console.log('\n========================================');
    console.log('Output (cleaned):');
    console.log('========================================');
    const cleanOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    console.log(cleanOutput);

    // Cleanup
    ptyProcess.kill();
    log('test-completed');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

/**
 * Interactive mode - manual testing
 */
async function interactiveMode(): Promise<void> {
  console.log('\n========================================');
  console.log('Interactive Mode');
  console.log('Commands: /spawn, /send <text>, /quit');
  console.log('Or type any text to send directly');
  console.log('========================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let ptyProcess: pty.IPty | null = null;

  // Send command handlers (refactored to reduce duplication)
  const sendCommands: Record<string, string> = {
    '/send ': '\r',
    '/sendn ': '\n',
    '/sendrn ': '\r\n',
  };

  const prompt = () => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === '/quit') {
        if (ptyProcess) ptyProcess.kill();
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/spawn') {
        try {
          ptyProcess = await testSpawn();
          console.log('Claude CLI spawned successfully');
        } catch (e) {
          console.error('Spawn failed:', e);
        }
        prompt();
        return;
      }

      // Handle /send, /sendn, /sendrn commands
      for (const [command, lineEnding] of Object.entries(sendCommands)) {
        if (trimmed.startsWith(command)) {
          if (!ptyProcess) {
            console.log('Run /spawn first');
          } else {
            const text = trimmed.substring(command.length);
            ptyProcess.write(text + lineEnding);
            console.log(`Sent with ${JSON.stringify(lineEnding)}: ${text}`);
          }
          prompt();
          return;
        }
      }

      // Direct send
      if (ptyProcess && trimmed) {
        ptyProcess.write(trimmed + '\r');
        console.log(`Sent: ${trimmed}`);
      }

      prompt();
    });
  };

  prompt();
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('Claude CLI Test Script');
  console.log(`Platform: ${os.platform()}`);
  console.log(`Line ending default: ${getLineEnding() === '\r' ? '\\r' : '\\n'}`);
  console.log('');

  switch (command) {
    case 'spawn':
      try {
        const pty = await testSpawn();
        console.log('\nSpawn successful! Press Ctrl+C to exit.');
        // Keep alive
        await new Promise(() => {});
      } catch (e) {
        console.error('Spawn failed:', e);
      }
      break;

    case 'prompt':
      await testFullFlow(args[1] || TEST_PROMPT, '\r');
      break;

    case 'prompt-n':
      await testFullFlow(args[1] || TEST_PROMPT, '\n');
      break;

    case 'prompt-rn':
      await testFullFlow(args[1] || TEST_PROMPT, '\r\n');
      break;

    case 'full':
      // Test all line endings
      console.log('Testing with \\r...');
      await testFullFlow(TEST_PROMPT, '\r');

      console.log('\n\nTesting with \\n...');
      await testFullFlow(TEST_PROMPT, '\n');

      console.log('\n\nTesting with \\r\\n...');
      await testFullFlow(TEST_PROMPT, '\r\n');
      break;

    case 'interactive':
    case 'i':
      await interactiveMode();
      break;

    default:
      console.log(`
Usage: npx tsx scripts/test-claude-cli.ts [command]

Commands:
  spawn         - Test PTY spawn and Claude CLI init only
  prompt [text] - Test with \\r line ending (current behavior)
  prompt-n      - Test with \\n line ending
  prompt-rn     - Test with \\r\\n line ending
  full          - Test all line endings sequentially
  interactive   - Interactive mode for manual testing

Interactive mode commands:
  /spawn        - Start Claude CLI
  /send <text>  - Send text with \\r
  /sendn <text> - Send text with \\n
  /sendrn <text>- Send text with \\r\\n
  /quit         - Exit

Examples:
  npx tsx scripts/test-claude-cli.ts spawn
  npx tsx scripts/test-claude-cli.ts prompt "hello"
  npx tsx scripts/test-claude-cli.ts interactive
`);
  }
}

main().catch(console.error);
