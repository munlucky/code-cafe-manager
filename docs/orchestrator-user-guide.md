# CodeCafe Orchestrator User Guide

## Introduction

The CodeCafe Orchestrator is a powerful engine designed to manage complex AI coding workflows. It allows you to break down tasks into stages (Plan, Code, Test, Check), assign distinct AI roles to each stage, and execute them automatically or interactively.

## Getting Started

### Installation

The orchestrator is integrated into CodeCafe. Ensure you have the latest version installed.

### Initialization

Before running any workflow, initialize the orchestrator configuration:

```bash
codecafe-orch init
```

This creates a `.orch` directory in your current folder with:
- `workflows/`: Workflow definitions
- `config/`: Configuration files (`assignments.yml`)
- `roles/`: Role templates

## Running Workflows

### Basic Run

To run a workflow (e.g., `feature-dev`):

```bash
codecafe-orch run feature-dev
```

### Interactive Mode (TUI)

For a better experience with real-time visualization:

```bash
codecafe-orch run feature-dev -i
```

This opens a terminal UI showing:
- Current stage and iteration
- Status of each node (running, completed, failed)
- Real-time logs and events

### Resuming a Run

If a run fails or is paused, you can resume it using its Run ID:

```bash
codecafe-orch resume <RUN_ID>
```

## Configuration

### Assignments

You can assign different providers (Claude, Codex) and profiles to stages.

**View Assignments:**
```bash
codecafe-orch assign list
```

**Set Assignment:**
```bash
# Set 'plan' stage to use 'claude-code' with 'planner' role
codecafe-orch assign set plan claude-code planner
```

### Profiles

Profiles define the complexity of the graph for a stage (e.g., `simple`, `committee`).

**Set Profile:**
```bash
codecafe-orch profile set code simple
```

## Logs

Logs are stored in `.orch/runs/<RUN_ID>/events.jsonl`. You can view them via CLI:

```bash
codecafe-orch logs <RUN_ID>
```
