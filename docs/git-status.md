# Git Status File Rail

`GIT-STATUS` projects real `git status --short --branch` output into the file drawer so the explorer carries the same high-signal orientation users expect from VS Code/Zed.

## Behavior

- The Files, Search, and Git drawer modes refresh Git state for the active workspace.
- Existing file nodes receive compact status tokens:
  - `M` modified
  - `U` untracked
  - `A` added
  - `D` deleted
  - `R` renamed
  - `S` staged
- Deleted files that no longer exist on disk are inserted as virtual file rows under their parent folder and rendered with a muted, struck-through label.
- Deleted virtual rows can be selected but are not opened as text files.
- Unsaved editor drafts still use the existing warning dot; Git state uses a separate token so app-local dirty state and repository state do not collapse into one meaning.

## Boundaries

This slice only decorates the file rail and Git drawer list. Read-only review belongs to `DIFF-VIEW`; stage, unstage, discard, and copy diff belong to `GIT-ACTIONS-LITE`.

## Verification

- `app/src/fileGitStatus.test.ts` covers Git short-status classification, relative-to-absolute path mapping, existing-node decoration, and virtual deleted-file insertion.
- `npm run qa:editor` captures the Git marker visual vocabulary in the chrome state QA fixture.
