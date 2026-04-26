---
name: ideadd
description: Commit the user's manual edits to docs/BRAINDUMP.md, open a PR, merge it, and delete the branch automatically.
user-invocable: true
allowed-tools: Bash
---

The user has already edited `docs/BRAINDUMP.md` manually. Commit those changes and ship them via a full git workflow — branch → commit → PR → merge → cleanup.

## Instructions

Execute every step in order. Do not skip any step.

### Step 1 — Verify there are changes to ship

1. Run `git diff docs/BRAINDUMP.md` to confirm the file has uncommitted local changes.
2. If there are no changes, tell the user and stop.

### Step 2 — Ensure a clean starting point

1. Run `git branch --show-current` to know the current branch.
2. **If on a side branch:**
   - Check for other uncommitted changes besides `docs/BRAINDUMP.md` (`git status --short`).
   - If other files have uncommitted changes, **stop and tell the user** — do not stash or commit on their behalf.
   - If only `docs/BRAINDUMP.md` is dirty, switch to main: `git checkout main` (the unstaged change travels with the working tree).
3. **If on main (or after switching):**
   - Pull latest: `git pull origin main`.
   - Confirm the pull succeeded before continuing.

### Step 3 — Create a side branch

- Use the branch name `idea/braindump-<timestamp>` where `<timestamp>` is the current date in `YYYYMMDD` format (e.g. `idea/braindump-20260417`).
- Run: `git checkout -b <branch-name>`.

### Step 4 — Commit, push, open PR, and merge

1. Stage the file: `git add docs/BRAINDUMP.md`.
2. Commit: `git commit -m "idea: update braindump"`.
3. Push: `git push -u origin <branch-name>`.
4. Read the diff from Step 1 and extract the added lines (lines starting with `+` that are not the `+++` header). Format them as a bullet list for the PR body.
5. Create PR with a body that lists the specific additions:
```
gh pr create --title "idea: update braindump" --body "$(cat <<'EOF'
Updates BRAINDUMP.md with new ideas:

<bullet list of added lines extracted from the diff>
EOF
)"
```
6. Wait for all PR checks to pass:
```
gh pr checks --watch
```
   If any check fails, report it to the user and stop — do not merge.
7. Merge and delete remote branch:
```
gh pr merge --merge --delete-branch
```

### Step 5 — Update local main and return to previous branch (if any)

1. Record the branch that was active before Step 2 (if it was a side branch, not main).
2. Switch to main and pull: `git checkout main && git pull origin main`.
3. Delete the local idea branch: `git branch -d <branch-name>`.
4. If a previous side branch was recorded:
   - Rebase it onto updated main: `git checkout <previous-branch> && git rebase main`.
   - If rebase conflicts occur, tell the user and stop — do not resolve automatically.
5. Report the final state: current branch, whether rebase was done, and confirmation that main is up to date.
