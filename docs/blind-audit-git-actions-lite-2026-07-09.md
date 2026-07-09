# Blind-Spot Audit: GIT-ACTIONS-LITE

Frameworks applied: blind-bias-blind-spot, blind-calibration, blind-chestertons-fence, blind-consider-the-opposite, blind-curse-of-knowledge, blind-dunning-kruger, blind-falsification, blind-inversion, blind-johari-window, blind-ladder-of-inference, blind-outside-view, blind-premortem, blind-red-team, blind-steelman, blind-survivorship-bias, blind-unknown-unknowns -- 6 independent findings, 4 same-model-repetition notes.

## Findings

1. **Discard can silently fight the editor buffer unless the Git action coordinates with dirty/open files.** (via blind-premortem, blind-inversion, blind-falsification)
   Evidence: `DIRTY-DRAFT-PROTECTION` protects editor navigation and tab close, but `GIT-ACTIONS-LITE` adds a new destructive path: "discard file with confirmation" from file status/diff surfaces. DIFF-VIEW currently opens read-only review and normal file opening clears review state.
   Severity: high -- expected damage is local data loss or confusing stale buffers; plausibility is high because discard mutates files outside CodeMirror's save/conflict path.
   Mitigation: before discard, block or warn when the target has an unsaved editor buffer; after any Git mutation, refresh Git status/tree and reload or mark affected open buffers stale.

2. **Mixed staged and unstaged files can make "stage", "unstage", and "copy diff" mean different things than the user thinks.** (via blind-ladder-of-inference, blind-curse-of-knowledge, blind-consider-the-opposite)
   Evidence: `git_file_diff` returns the unstaged diff first and only returns staged diff if there is no unstaged diff. The roadmap done criterion says stage, unstage, discard, and copy diff are available from file status/diff surfaces, but does not specify whole-file versus current-diff-slice behavior.
   Severity: high -- expected damage is reviewing/copying one layer while mutating another; plausibility is medium-high because mixed staged/unstaged files are common during agent review.
   Mitigation: label actions exactly: "Stage file", "Unstage file", "Discard unstaged changes", "Copy shown diff". Do not imply copy/stage applies to hidden staged content unless the UI can expose both layers.

3. **Untracked, deleted, and renamed files need separate command paths; one generic discard command will be wrong.** (via blind-chestertons-fence, blind-red-team, blind-unknown-unknowns)
   Evidence: Git status already inserts virtual deleted file rows and DIFF-VIEW synthesizes untracked text diffs. Git restore-style discard handles tracked working-tree edits, but untracked discard means deleting the file and renamed/deleted paths have different index/worktree states.
   Severity: medium-high -- expected damage is either failed actions or deleting the wrong path; plausibility is medium because the current Git status model already surfaces these states.
   Mitigation: backend should receive the file status or re-read status server-side, branch by state, and use path-validated commands: add for stage, restore --staged for unstage, restore for tracked discard, and explicit remove for untracked discard after confirmation.

4. **A green build will not prove Git actions work unless tests execute real Git repositories.** (via blind-falsification, blind-dunning-kruger, blind-calibration)
   Evidence: DIFF-VIEW has Rust tests for path validation and synthetic untracked diff, and frontend tests for parsing. GIT-ACTIONS-LITE will need mutation semantics that cannot be proven by typechecking or parser tests.
   Severity: medium -- expected damage is shipping a UI that looks wired but fails on real repositories; plausibility is high without end-to-end git command tests.
   Mitigation: add Rust temp-repo tests that initialize git, commit a base file, then verify stage, unstage, discard tracked changes, discard untracked file, and copy/read diff behavior.

5. **The UI may become a Git client by accretion if this slice adds too many controls.** (via blind-steelman, blind-outside-view, blind-inversion)
   Evidence: ROADMAP explicitly says "v1 must-have after DIFF-VIEW, not a full git client." The product boundary says local Git is core, but broad source-hosting and workflow automation are adapter-lane or later scope.
   Severity: medium -- expected damage is losing the agent-first cockpit hierarchy; plausibility is medium because stage/unstage/discard/copy naturally invite branch, commit, push, PR, and conflict features.
   Mitigation: keep only per-file actions attached to the existing diff/status surfaces. Defer branch/commit/push/PR, multi-file staging, and history to later roadmap cards.

6. **There is no screenshot/interaction proof for the new diff/action surface yet.** (via blind-johari-window, blind-survivorship-bias, blind-curse-of-knowledge)
   Evidence: `npm run qa:editor` currently captures selected, dirty, context-menu, chrome-states, save-error, save-conflict, find-replace, missing, no-file, narrow, narrow-composer, and dirty-modal states. It does not capture a diff review or Git action controls.
   Severity: medium -- expected damage is visual regressions in the exact surface the user complained about; plausibility is medium because prior UI feedback focused on layout and polish.
   Mitigation: add a static diff-review/action state to the QA fixture or run a live app smoke before marking GIT-ACTIONS-LITE done.

## Same-Model-Repetition Notes

- Bias blind spot and calibration both repeated the same caution: do not treat "narrow" or "straightforward" as proof that Git mutation is safe.
- Consider-the-opposite and steelman both repeated the same product concern: a fuller Git client has a real user appeal, but conflicts with the roadmap boundary.
- Unknown-unknowns and premortem both repeated the same missing category: file states outside "modified tracked file".
- Johari Window and survivorship bias both repeated the same evidence gap: no outside/user-visible proof yet for this surface.

## Residual

- This audit did not run a second model or external reviewer, so the findings are still same-agent self-audit until spot-checked.
- This audit did not execute a live Git mutation implementation; implementation had only begun with an app-action type edit.
- This audit did not inspect Zed's exact review-changes implementation, only the local roadmap and current Keelhouse code.
- No standalone finding from blind-survivorship-bias beyond the QA/user-feedback evidence gap.
- Self-audit caveat: this audit graded its own evidence; nothing here was spot-checked by an outsider or a second model.
