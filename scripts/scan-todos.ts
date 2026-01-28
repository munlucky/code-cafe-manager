/**
 * TODO/FIXME Scanner
 * Scans packages for TODO/FIXME comments and generates GitHub Issue format output
 */

import * as fs from 'fs';
import * as path from 'path';

interface TodoItem {
  file: string;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME';
}

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

function scanFile(filePath: string): TodoItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const todos: TodoItem[] = [];

  const patterns = [
    /\/\/\s*TODO:?\s*(.+)/gi,
    /\/\/\s*FIXME:?\s*(.+)/gi,
  ];

  lines.forEach((line, index) => {
    patterns.forEach(pattern => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach(match => {
        if (match.index !== undefined) {
          const type = match[0].includes('FIXME') ? 'FIXME' : 'TODO';
          todos.push({
            file: path.relative(ROOT, filePath),
            line: index + 1,
            text: match[1]?.trim() || '',
            type,
          });
        }
      });
    });
  });

  return todos;
}

function scanDirectory(dir: string): TodoItem[] {
  const todos: TodoItem[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, coverage
        if (['node_modules', 'dist', 'coverage', '.vitest'].includes(entry.name)) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
        todos.push(...scanFile(fullPath));
      }
    }
  }

  walk(dir);
  return todos;
}

function main() {
  console.log('# TODO/FIXME Scan Results\n');
  console.log(`Scanned: ${PACKAGES_DIR}\n`);

  const todos = scanDirectory(PACKAGES_DIR);

  if (todos.length === 0) {
    console.log('✅ No TODO/FIXME comments found!');
    return;
  }

  console.log(`Found ${todos.length} TODO/FIXME comments:\n`);

  // Group by type
  const byType = todos.reduce((acc, todo) => {
    if (!acc[todo.type]) acc[todo.type] = [];
    acc[todo.type].push(todo);
    return acc;
  }, {} as Record<string, TodoItem[]>);

  // Print summary
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`## ${type} (${items.length})\n`);
    items.forEach(todo => {
      console.log(`- \`${todo.file}:${todo.line}\` - ${todo.text}`);
    });
    console.log();
  });

  // GitHub Issue format
  console.log('\n---\n\n## GitHub Issue Format\n');
  todos.forEach((todo, index) => {
    console.log(`### Issue ${index + 1}: ${todo.text}`);
    console.log(`**Location:** \`${todo.file}:${todo.line}\``);
    console.log(`**Type:** ${todo.type}`);
    console.log(`**Labels:** tech-debt, good-first-issue\n`);
  });
}

main();
