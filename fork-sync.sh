#!/usr/bin/env bash
# Sync fork main with upstream, rebase the stacked gitea/1..5 PR branches, refresh `custom`.
# Usage: fork-sync.sh [--no-check] [--no-push]
# Run from any worktree of the repo with a clean tree. On a conflict, resolve, `git rebase --continue`, rerun.
set -euo pipefail

STACK=(gitea/1-instance-credentials gitea/2-work-item-api gitea/3-forge-seam gitea/4-tasks-source gitea/5-cli)
CUSTOM=custom
CHECK=1; PUSH=1
for a in "$@"; do case $a in --no-check) CHECK=0;; --no-push) PUSH=0;; *) echo "unknown arg $a"; exit 2;; esac; done

cd "$(git rev-parse --show-toplevel)"
git config rerere.enabled true
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean"; exit 1; }
[ ! -d "$(git rev-parse --git-path rebase-merge)" ] || { echo "a rebase is in progress; finish it first"; exit 1; }
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/stablyai/orca.git

START_BRANCH=$(git symbolic-ref --short -q HEAD || git rev-parse HEAD)
STATE=$(git rev-parse --git-path fork-sync-state)

git fetch -q upstream main
git fetch -q origin

# Fast-forward main (checked out elsewhere is fine: update in that worktree).
if ! git merge-base --is-ancestor main upstream/main; then echo "main has diverged from upstream/main; refusing"; exit 1; fi
main_wt=$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/main$/{print w}')
if [ -n "$main_wt" ]; then git -C "$main_wt" merge -q --ff-only upstream/main; else git update-ref refs/heads/main upstream/main; fi
[ "$PUSH" = 1 ] && git push -q origin main

# Old tips are remembered across an interrupted run so later branches still know their old base.
if [ ! -f "$STATE" ]; then for b in "${STACK[@]}"; do echo "$b $(git rev-parse "$b")"; done > "$STATE"; fi
old_tip() { awk -v b="$1" '$1==b{print $2}' "$STATE"; }

prev=main
for b in "${STACK[@]}"; do
  if git merge-base --is-ancestor "$prev" "$b"; then
    echo "== $b already on $prev"
  else
    if [ "$prev" = main ]; then base=$(git merge-base "$(old_tip "$b")" main); else base=$(old_tip "$prev"); fi
    echo "== rebasing $b onto $prev (old base ${base:0:10})"
    git rebase --onto "$prev" "$base" "$b" || { echo "CONFLICT on $b: resolve, 'git rebase --continue', rerun $0"; exit 1; }
  fi
  if [ "$CHECK" = 1 ]; then
    git checkout -q "$b"
    clean=$(env | grep '^ORCA' | cut -d= -f1 | sed 's/^/-u /' | tr '\n' ' ')
    ORCA_CODE_QUALITY_BASE=$prev env $clean timeout 900 pnpm check:changed || { echo "check:changed failed on $b; fix, amend, rerun"; exit 1; }
  fi
  prev=$b
done

git branch -f "$CUSTOM" "${STACK[-1]}"
if [ "$PUSH" = 1 ]; then git push --force-with-lease origin "${STACK[@]}" "$CUSTOM"; fi
rm -f "$STATE"
git checkout -q "$START_BRANCH"
echo "done: main=$(git rev-parse --short main) custom=$(git rev-parse --short $CUSTOM)"
