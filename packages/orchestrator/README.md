# @codecafe/orchestrator

Multi AI CLI Orchestrator for CodeCafe. This package provides the engine and CLI for managing complex AI workflows involving multiple roles, providers, and stages.

## Features

- **Workflow Engine**: FSM-based workflow execution with DAG support.
- **Multi-Role**: Assign different AI personas (Planner, Coder, Tester) to stages.
- **Provider Agnostic**: Support for Claude Code, Codex, and other providers via `headless` or `assisted` mode.
- **TUI**: Interactive terminal UI for monitoring runs (`codecafe-orch run -i`).
- **Electron Integration**: API for desktop application integration.

## Usage

### CLI

```bash
# Initialize .orch directory
codecafe-orch init

# Run a workflow
codecafe-orch run my-workflow

# Run interactively
codecafe-orch run my-workflow -i

# Manage assignments
codecafe-orch assign set plan claude-code planner

# Manage profiles
codecafe-orch profile set code deep-think
```

## Architecture

- **Engine**: `src/engine/` - FSM & DAG execution logic.
- **Storage**: `src/storage/` - Run state and event logs (JSON/JSONL).
- **UI**: `src/ui/` - Ink-based TUI and Electron IPC handlers.
- **CLI**: `src/cli/` - Command definitions.

## Integration

To integrate with Electron or other consumers, use `registerElectronHandlers`:

```typescript
import { registerElectronHandlers } from '@codecafe/orchestrator';
registerElectronHandlers(ipcMain, orchDir);
```
