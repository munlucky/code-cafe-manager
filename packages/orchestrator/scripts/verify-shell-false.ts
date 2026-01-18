
import { spawn } from 'child_process';
import * as path from 'path';

// c:\dev\code-cafe-manager\packages\orchestrator\scripts\verify-shell-false.ts

async function test(useShell: boolean, prompt: string) {
  console.log(`\n=== Testing claude -p (shell: ${useShell}, prompt: "${prompt}") ===`);
  
  const claudePath = 'C:\\Users\\moon\\.local\\bin\\claude.exe';

  const child = spawn(claudePath, ['-p', prompt], {
    shell: useShell,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Close stdin immediately
  child.stdin.end();
  
  child.stdout.on('data', d => console.log(`[shell:${useShell}] STDOUT:`, d.toString().trim()));
  child.stderr.on('data', d => console.log(`[shell:${useShell}] STDERR:`, d.toString().trim()));
  
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log(`[shell:${useShell}] TIMEOUT! Killing process...`);
      child.kill();
      resolve(false);
    }, 10000);
    
    child.on('close', code => {
      console.log(`[shell:${useShell}] Process exited with code:`, code);
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function run() {
  console.log('Starting verification...');
  // Test case: shell: false with simple prompt (should act like Test 1 in previous phase)
  await test(false, 'hello');
}

run().catch(console.error);
