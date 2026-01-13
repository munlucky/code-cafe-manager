# Code Cafe Built-in Roles

This directory contains the built-in roles for the Code Cafe orchestrator. These roles define agent behaviors for common development tasks.

## Available Roles

### 1. Planner (`planner.md`)
Creates implementation plans for features and tasks.

**Recommended Provider:** claude-code
**Skills:** read_file, write_file, analyze_code, search_code

**Variables:**
- `task` (required): Task or feature description to plan
- `requirements` (optional): Additional requirements or constraints
- `context_files` (optional): List of context files to read

### 2. Coder (`coder.md`)
Implements code according to plans and specifications.

**Recommended Provider:** claude-code
**Skills:** read_file, write_file, edit_file, run_tests, lint_code

**Variables:**
- `task` (required): Coding task description
- `plan` (optional): Implementation plan to follow
- `files_to_modify` (optional): List of files to modify

### 3. Tester (`tester.md`)
Tests implementations and reports results.

**Recommended Provider:** claude-code
**Skills:** read_file, write_file, run_tests, run_coverage, analyze_results

**Variables:**
- `task` (required): Testing task description
- `code_changes` (optional): Description of code changes to test
- `test_files` (optional): List of test files to run

### 4. Reviewer (`reviewer.md`)
Reviews code quality and provides feedback.

**Recommended Provider:** claude-code
**Skills:** read_file, analyze_code, check_patterns, security_audit

**Variables:**
- `task` (required): Code review task description
- `files_to_review` (optional): List of files to review
- `focus_areas` (optional): Specific areas to focus on

## Role File Format

Roles are defined in Markdown files with YAML frontmatter:

```markdown
---
id: role-id
name: Role Name
recommended_provider: claude-code
skills:
  - skill_1
  - skill_2
variables:
  - name: var_name
    type: string
    required: true
    description: "Variable description"
---

# Role Name

Role description and instructions...

## Task
{{task}}

{{#if optional_var}}
## Optional Section
{{optional_var}}
{{/if}}

Instructions continue...
```

### Frontmatter Fields

- **id** (required): Unique identifier for the role
- **name** (required): Human-readable name
- **recommended_provider** (required): Recommended AI provider (e.g., `claude-code`, `codex`)
- **skills** (optional): List of skills/capabilities the role uses
- **variables** (optional): List of template variables

### Variable Schema

Each variable in the `variables` array has:
- **name** (required): Variable name used in the template
- **type** (required): Data type (`string`, `number`, `boolean`, `array`, `object`)
- **required** (required): Whether the variable must be provided
- **description** (required): Human-readable description

## Template Syntax

Role templates use [Handlebars](https://handlebarsjs.com/) syntax:

### Variables
```handlebars
{{variableName}}
```

### Conditionals
```handlebars
{{#if condition}}
  Content when true
{{else}}
  Content when false
{{/if}}
```

### Loops
```handlebars
{{#each arrayVariable}}
  - {{this}}
{{/each}}
```

### JSON Output
```handlebars
{{json objectVariable}}
```

## Role Loading Priority

The RoleManager loads roles from multiple directories with this priority:

1. `.orch/roles/` - User-defined custom roles (highest priority)
2. `packages/roles/` - Project built-in roles (this directory)
3. `node_modules/@codecafe/roles/` - Package roles (fallback)

If a role with the same ID exists in multiple directories, the first match wins (according to priority order).

## Creating Custom Roles

To create a custom role:

1. Create a new `.md` file in `.orch/roles/` directory
2. Follow the role file format above
3. Define your role's behavior and template
4. Use the role in your workflows

Example:

```markdown
---
id: my-custom-role
name: My Custom Role
recommended_provider: claude-code
skills:
  - read_file
  - write_file
variables:
  - name: task
    type: string
    required: true
    description: "Task to perform"
---

# My Custom Role

You are a custom agent that does specific tasks.

## Task
{{task}}

Perform the task following these guidelines:
- Guideline 1
- Guideline 2
```

## Best Practices

1. **Keep roles focused**: Each role should have a single, clear responsibility
2. **Use clear variable names**: Make it obvious what each variable is for
3. **Provide good descriptions**: Help users understand how to use the role
4. **Test with different providers**: Verify the role works with various AI providers
5. **Document expected outputs**: Clarify what format the role should produce

## See Also

- [RoleManager API](../orchestrator/src/role/role-manager.ts)
- [Role Types](../core/src/types/role.ts)
- [Handlebars Documentation](https://handlebarsjs.com/)
