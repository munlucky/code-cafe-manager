
import { spawn } from 'child_process';
import * as path from 'path';

// c:\dev\code-cafe-manager\packages\orchestrator\scripts\verify-claude-hang.ts

async function test() {
  console.log('Testing claude -p execution...');
  
  // Use known path from logs
  const claudePath = 'C:\\Users\\moon\\.local\\bin\\claude.exe';
  
  console.log(`Using claude path: ${claudePath}`);

  // Test prompt
  const args = ['-p', 'hello', '--verbose'];

  const child = spawn(claudePath, args, {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  console.log('Spawned PID:', child.pid);
  
  // Close stdin immediately - THIS IS THE FIX
  console.log('Closing stdin...');
  child.stdin.end();
  
  child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
  child.stderr.on('data', d => console.log('STDERR:', d.toString()));
  
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('TIMEOUT! Killing process...');
      child.kill();
      resolve(false);
    }, 10000); // 10s timeout
    
    child.on('close', code => {
      console.log('Process exited with code:', code);
      clearTimeout(timer);
      resolve(true);
    });
    
    child.on('error', err => {
      console.error('Process error:', err);
    });
  });
}

test().then(success => {
  if (success) {
    console.log('SUCCESS: Process exited normally');
    process.exit(0);
  } else {
    console.log('FAILURE: Process timed out');
    process.exit(1);
  }
});
