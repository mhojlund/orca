# Fork sync runbook (Orca + Gitea stack)

Instructions for an agent session asked to "sync the fork", "rebase the PRs", or "update custom".

## Layout

- Repo: `mhojlund/orca` (remote `origin`), a fork of `stablyai/orca` (remote `upstream`; the script adds it if missing).
- `main` is a pure mirror of `upstream/main`. Fast-forward only. Never commit to it.
- The stacked PR branches, in order, each based on the previous one (PR #1 targets `main`, #2 targets `gitea/1-…`, and so on):
  1. `gitea/1-instance-credentials`
  2. `gitea/2-work-item-api`
  3. `gitea/3-forge-seam`
  4. `gitea/4-tasks-source`
  5. `gitea/5-cli`
- `custom` is the long-lived branch to build and run from: it always equals the top of the stack (`gitea/5-cli`), i.e. `main` plus all five PRs.
- `git rerere` is enabled (shared repo config), so repeated conflict resolutions replay automatically.

## Routine

Run from any worktree of the repo with a clean tree:

```bash
/home/developer/orca/fork-sync.sh              # sync main, rebase stack, check each branch, push
/home/developer/orca/fork-sync.sh --no-check   # skip pnpm check:changed
/home/developer/orca/fork-sync.sh --no-push    # do everything locally
```

The script: fetches `upstream`, fast-forwards `main` (in whichever worktree has it checked out) and pushes it, rebases each stack branch with `git rebase --onto <new previous> <old previous tip>`, runs `pnpm check:changed` per branch (base = previous branch, `ORCA_*` env vars stripped), moves `custom` to the top, and pushes the stack and `custom` with `--force-with-lease`.

Old branch tips are saved in `<git-dir>/fork-sync-state` during a run so an interrupted run can resume. It is deleted on success.

## When it stops

- **Conflict during rebase:** the script names the branch. Resolve the files, `git add`, `GIT_EDITOR=true git rebase --continue`, then rerun the script. Do not run `git rebase --abort` and then rerun without thinking: the state file still holds the old tips, which is what you want, but check `git status` first.
- **`check:changed` fails:** fix it on that branch (amend into the commit that owns the change, or `git commit --fixup=<sha>` then `GIT_SEQUENCE_EDITOR=true git rebase -q --autosquash <base>`), re-stack the branches above it, then rerun the script.
- **`main has diverged from upstream/main`:** someone committed to `main`. Stop and ask the user.

## Past lessons (what upstream changes broke)

- Upstream moved credential file I/O to async (#44661). The Gitea instance store and everything calling `resolveGiteaRequestAuth`, `listStoredGiteaInstances`, `readGiteaInstanceToken` had to become async. Mirror `src/main/jira/site-credential-store.ts` as the pattern for credential stores.
- Ratchet baselines (`config/main-blocking-helper-baseline.txt`, main-sync-fs) conflict often. Take upstream's version, re-add only our lines, then run the ratchet with `--prune`.
- `src/shared/settings/global-settings-types.ts` is at the 300-line lint cap (comments and blanks don't count). Add new settings as a feature-owned group type composed into `GlobalSettingsBase` (see `src/shared/gitea/gitea-task-provider-settings.ts`), not as more fields there.
- Run inside an Orca session, `orcad-push-startup.test.ts` and `worktree-rm-cli.integration.test.ts` fail because of inherited `ORCA_*` env vars. They pass with those stripped; the script does this. Not a real failure.

## Rules

- Follow the repo's `AGENTS.md` (run `pnpm check:changed` once per branch before pushing; never `--no-verify`; no unnecessary tests or comments).
- Keep each PR a separate commit series. Do not squash the stack and do not merge `upstream/main` into any branch; always rebase.
- Fold fixes into the commit that owns them so each PR stays reviewable on its own.
- Force-pushing the stack branches and `custom` is expected here (own fork, `--force-with-lease`). Never force-push `main`.
- Report at the end: new `main` SHA, whether conflicts occurred, which checks failed or were skipped, and the PR mergeable state (`gh pr list -R mhojlund/orca`; note `gh` without `-R` targets upstream).

## If upstream rejects or ignores the PRs

`custom` is the product. Keep syncing at least weekly, since drift makes each rebase costlier. Consider whether the Gitea source could ship as an Orca plugin to reduce conflict surface.
