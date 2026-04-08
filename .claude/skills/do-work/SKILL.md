---
name: do-work
description: Execute a unit of work end-to-end — plan, implement, verify, commit. Use when user says "do work", "implement this", "build this feature", or describes a discrete piece of work to complete. Don't use for exploratory research, code review, or when user only wants a plan without implementation.
---

# Do Work

Execute a complete unit of work: plan it, build it, validate it, commit it.

## Pre-loaded context

- Status: !`git status`
- Log: !`git log --oneline -5`

## Workflow

### 1. Understand the task

Read any referenced plan or PRD. Explore the codebase to understand the relevant files, patterns, and conventions. If the task is ambiguous, ask the user to clarify scope before proceeding.

### 2. Plan the implementation (optional)

If the task has not already been planned, create a plan for it.

### 3. Implement

Work through the plan step by step.

### 4. Validate

Run the feedback loops and fix any issues. Repeat until both pass cleanly.

```
pnpm typecheck
pnpm run test
```

### 4. Commit

Once typecheck and tests pass, commit the work.
