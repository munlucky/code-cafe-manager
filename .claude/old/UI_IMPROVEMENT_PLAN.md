# Desktop UI Improvement Plan (based on PRD v2)

## 1. Overview
The goal is to transition `CodeCafe Manager` into a **"Desktop-First"** application where users can manage multiple projects (Cafes) and orchestrate AI workflows without touching the external terminal.

## 2. Core UI Modules (Screens)

### 2.1 Global Lobby (The Cafe Street)
**Goal**: Manage multiple git repositories ("Cafes") at a glance.
-   **Structure**: Card Grid Layout.
-   **Card Content**:
    -   Cafe Name (Repo Name)
    -   Path (local path)
    -   Active Orders Badge (e.g., "3 Brewing")
    -   Repo Status (Branch name, dirty/clean)
-   **Actions**:
    -   `Add Cafe`: File picker dialog to select folder.
    -   `Enter`: Click card to navigate to Cafe Dashboard.

### 2.2 Cafe Dashboard (Inside a Cafe)
**Goal**: Manage Orders within a specific project.
-   **Layout**: Sidebar (Menu/Global Nav) + Main Content Area + Context Sidebar (optional).
-   **Order List (Kanban/List)**:
    -   Columns: `Pending`, `Brewing` (Running), `Served` (Completed), `Failed`.
    -   Order Card: ID, Recipe Name, Start Time, Current Stage.
-   **Quick Action**: "New Order" Button (FAB or Top Right).
    -   Opens `Order Creation Modal`.

### 2.3 Order Creation & Role Mapping (The Kiosk)
**Goal**: Configure new run and assign Agents.
-   **Step 1: Select Recipe**: Choose Workflow (YAML).
-   **Step 2: Role/Barista Allocation**:
    -   Configure **which Barista (Agent)** to assign for each Stage.
    -   `Barista` = `Role` (Template) + `Provider` (Terminal Type).
    -   Example: Code Stage -> Create 2 Baristas with `Coder` Role (Provider: Codex).
-   **Step 3: Inputs**: Form fields for variables (e.g., Issue details).

### 2.4 Order Live View & Context (The CCTV)
**Goal**: Real-time observability and Shared Memory verification.
-   **Split View**:
    -   **Left (Process)**: Visualization of Barista (Agent) workflow DAG.
    -   **Center (Terminal)**: Real-time PTY Grid of allocated Terminals.
        -   *Note*: N Baristas might share M Terminals (Queuing).
    -   **Right (Context/Memory)**:
        -   Real-time rendering of the Shared Context file (`context.md`) in the current Worktree.
        -   Observe what information Agents are exchanging.

### 2.5 Role Manager (Agent Studio)
**Goal**: Manage Agent (Role) Templates.
-   **List**: Default Roles (Planner, Coder...) and Custom Roles.
-   **Editor**:
    -   Edit System Prompt.
    -   Connect available Skills (Tools).
    -   Recommend Providers.

### 2.6 Settings & Provider Connect
**Goal**: In-App Authentication.
-   **Provider List**: Claude, Codex, etc.
-   **Connect Workflow**:
    -   Click "Connect Claude".
    -   Opens an **Embedded Terminal** component (xterm.js).
    -   Runs `claude login`.
    -   User interacts within the window.
    -   Detects success exit code -> Marks as "Connected".

## 3. Component Architecture (Atomic UI)
To support this, we need a robust Component Library (`packages/ui`).

-   **Atoms**: `Button`, `Input`, `Badge`, `Card`, `Spinner`.
-   **Molecules**: `RepoCard`, `OrderCard`, `LogViewer` (xterm.js wrapper).
-   **Organisms**: `OrderList`, `RecipeForm`, `TerminalGrid`.
-   **Templates**: `LobbyLayout`, `DashboardLayout`.

## 4. Tech Stack Recommendations
-   **Framework**: React (existing).
-   **Styling**: TailwindCSS (existing) + `shadcn/ui` (recommended for rapid high-quality components).
-   **State Management**: Zustand (Global Store for Cafes, Orders).
-   **Terminal**: `xterm.js` + `xterm-addon-fit`.
-   **Icons**: Lucide React.
