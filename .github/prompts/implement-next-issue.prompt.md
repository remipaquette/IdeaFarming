---
mode: agent
description: Pick the next unblocked open issue, implement it end-to-end, document it, and close it. Start fresh — do not rely on conversation history.
---

# Implement Next Issue

Start with a completely clean context. Fetch everything you need from the repo and GitHub — do not rely on anything from a previous conversation.

---

## Step 1 — Ensure `gh` is available

```powershell
$env:PATH = "$env:USERPROFILE\tools\gh;$env:PATH"
gh auth status
```

If not authenticated, run `gh auth login --web`.

---

## Step 2 — Find the next unblocked issue

List all open issues labelled `ready-for-agent`, sorted by number:

```powershell
gh issue list --state open --label "ready-for-agent" --json number,title,body | ConvertFrom-Json | Sort-Object number
```

For each issue, read its **Blocked by** section. An issue is **unblocked** when every issue number referenced in "Blocked by" is already closed.

**Pick the lowest-numbered unblocked issue.** If multiple are unblocked, pick the lowest number.

---

## Step 3 — Load the issue and all context

Fetch the full issue body and comments:

```powershell
gh issue view <number> --comments
```

Then read all domain context — do not skip any of these:

- `CONTEXT.md` — domain glossary; use its terms in all code (variable names, types, API routes)
- `docs/adr/` — architectural decisions; do not contradict them
- `docs/prd.md` — full acceptance criteria and testing decisions

---

## Step 4 — Explore the codebase

Before writing any code, understand what already exists. Use search and file reading tools to:

- Find existing schema migrations and understand the current data model
- Find existing API routes and patterns
- Find existing frontend components and conventions
- Find existing tests and understand the testing style

Build on what exists. Do not reinvent patterns that are already established.

---

## Step 5 — Implement the slice end-to-end

Implement the vertical slice: **schema → API → UI → tests**. Every acceptance criterion in the issue must be met.

Rules:
- Use domain glossary terms from `CONTEXT.md` in code (class names, function names, route paths, type names)
- Follow every ADR — do not contradict them
- Write tests for the modules marked in the PRD Testing Decisions section (`docs/prd.md`)
- Do not add features, refactoring, or improvements beyond what the acceptance criteria require
- Run tests before declaring done

---

## Step 6 — Document and close the issue

When all acceptance criteria pass:

1. Confirm tests pass
2. Post a comment on the issue summarising:
   - What was built (key files/modules touched)
   - Any notable decisions made during implementation
   - Anything a reviewer should know

```powershell
gh issue comment <number> --body "..."
```

3. Close the issue:

```powershell
gh issue close <number>
```

Do **not** modify issue #1 (the PRD) or any already-closed issue.
