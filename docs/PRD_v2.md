# PRD.md — CodeCafe Manager (v3: Desktop-First & Cafe Scale)

> **Summary**: `CodeCafe` is a local CLI-based **Multi-AI Orchestration Platform**.  
> Users manage multiple projects (**Cafe**) via **CodeCafe Manager (Desktop)** and execute multiple tasks (**Order**) in parallel.  
> The core features include **Workspace Isolation** via `git-worktree` and **Real-time AI Observation (CCTV)**. All workflows are completed within the Desktop App.

---

## 1. Core Values & Goals

1.  **Desktop-First Experience**: All flows (Setup, Execution, Monitoring) must be available in the Desktop App. The CLI is limited to a background engine or a secondary tool for "Initial Auth".
2.  **Project as a Cafe**: A single Git Repository is called a **"Cafe"**. Users can manage N Cafes simultaneously.
3.  **Isolation by Default**: When an Order is created, a `git-worktree` is automatically created to ensure the AI works in an isolated environment without polluting the main branch.
4.  **Parallel Orchestration**: Multiple Orders run concurrently within a Cafe. Users can observe the real-time activity of Provider (AI) terminals like a "CCTV".

---

## 2. User Workflow

### 2.1 Flow Summary
1.  **Cafe Open (Register Project)**: Select a local Git project folder to register with CodeCafe.
2.  **New Order (Create Task)**:
    -   Enter Cafe -> Click "New Order".
    -   Select **Recipe (Workflow)** (e.g., `feature-dev`, `bug-fix`, `code-review`).
    -   Enter **Issue/Prompt**.
3.  **Workspace Prep**:
    -   System automatically creates a `git-worktree` (e.g., `order/123-feat-login`).
    -   Context is copied to the isolated workspace.
4.  **Brewing (Execution & Observation)**:
    -   Defined stages (Plan → Code → Test) run sequentially.
    -   User watches real-time terminal outputs of each Provider (Claude/Codex) in the Desktop UI.
5.  **Serve (Completion)**:
    -   Review result report.
    -   Clean up `git worktree` or create a PR.

---

## 3. Functional Requirements

### 3.1 CodeCafe Manager (Desktop UI)
**[Essential Screens & Features]**

#### (A) Global Lobby (Cafe Selection)
-   List of registered Cafes (Projects).
-   Summary of active orders and status for each Cafe.
-   `Add Cafe`: Import local folder.

#### (B) Cafe Dashboard (Inside a Cafe)
-   **Order List**: List of active/completed orders (Kanban or List View).
-   **Create Order**:
    -   Select Workflow Template.
    -   Input Form (Variables, Requirements).
    -   Dynamic Provider Assignment (Plan=Claude, Code=Codex).

#### (C) Order Live View (The Brewing Monitor)
-   **Workflow Graph**: Visualization of the current executing Node/Stage.
-   **Terminal Grid**: Mirrors the PTY (Pseudo-Terminal) of running Providers.
    -   *Why?* Users want to see the AI actually typing and executing commands.
-   **Intervention**: Pause, Retry, or "Direct Input" prompt for Assisted Mode.

#### (D) Settings & Providers
-   **Embedded Terminal**: Built-in terminal for initial setup.
    -   *Q: How to handle initial AI CLI auth?*
    -   *A:* If browser auth (e.g., `claude login`) is required, open the embedded terminal in **"Settings > Providers"** to guide the user locally.

### 3.2 Core Engine (Orchestrator)
-   **Multi-Cafe Support**: The engine loads `.orch` settings for a specific Cafe on demand without loading all contexts into memory.
-   **Git Worktree Manager**:
    -   Pre-Order: Auto-execute `git worktree add ...`.
    -   Post-Order: `git worktree remove` or keep based on user choice.
-   **Resource Management (Terminal Pool)**:
    -   **Provider**: A service supplier (Claude, Codex) that provides "Executable Environments (Terminals)".
    -   **Terminal**: An actual process/session created by the Provider. (Resource)
    -   **Barista (Agent)**: A "Logical Worker" with a specific Role and Context. (Worker)
    -   **Mapping**: At runtime, a `Barista` leases a `Terminal`, injects the prompt, and performs the task. The Terminal is returned or reused after the task.

### 3.3 Agent & Context Management
-   **Shared Context (Memory Board)**:
    -   File-based shared memory (e.g., `.codecafe/run/context.md`) created for each Order (Worktree).
    -   All Baristas (Providers) can Read/Write/Append to this Context file to collaborate.
-   **Role System (Template & Skills)**:
    -   Managed by **Role** units, not just simple prompts.
    -   `Role` = `System Prompt Template` + `Skills (Tools DEFINITION)` + `Recommended Provider`.
    -   Default Roles: `Planner`, `Coder`, `Tester`, `Reviewer`.
    -   Users can assign N Roles to each Stage (e.g., 3 Coders + 1 Reviewer in parallel for the Code stage).

---

## 4. Terminology

| Term | Description | Note |
| :--- | :--- | :--- |
| **Cafe** | Managed Local Project (Git Repo) | 1 Cafe = 1 Repo |
| **Order** | A Single Task Request (Workflow Instance) | Order ID assigned |
| **Recipe** | Workflow Template (YAML Definition) | Plan->Code->Test... |
| **Role** | Agent Role Definition (Template + Skills) | Planner, Coder, Reviewer |
| **Barista** | **Logical Agent** performing the task | Role Instance (ex: Coder-1) |
| **Terminal** | Physical **Process** where prompt executes | Provider Session (ex: Claude Process) |
| **Guest** | User | |
| **Table** | Isolated Workspace | `git-worktree` folder |

---

## 5. Initial Setup & CLI Role
We follow the **"Everything in Desktop"** principle.

1.  **Reduced CLI Role**: `codecafe-cli` is reserved for CI/CD or Headless modes. General users do not need to use the CLI directly.
2.  **Provider Auth (Initial Setup)**:
    -   CLI tools like Claude Code require a one-time `login`.
    -   CodeCafe Desktop provides a **"Settings > Providers"** tab.
    -   Clicking [Connect Claude] opens an internal `node-pty` terminal to show the auth link/browser.
    -   The user completes authentication within CodeCafe without opening a separate terminal app.
