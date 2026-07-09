# Git Actions Lite

`GIT-ACTIONS-LITE` adds the smallest useful mutation layer on top of Git status and diff review.

## Behavior

- Diff review exposes **Stage**, **Unstage**, **Discard**, and **Copy diff** actions.
- File rail context menus expose **Open Diff**, **Stage File**, **Unstage File**, and **Discard Unstaged Changes** for Git-marked rows.
- Stage runs against the whole file path. Unstage removes staged changes for that path. Discard only affects unstaged working-tree changes or untracked files.
- Copy diff copies the currently shown diff, not hidden staged/unstaged layers.
- After a Git action, Keelhouse refreshes Git status, refreshes the file tree, and either reloads the diff for the still-changed file or closes the review when the file becomes clean.

## Safety Rules

- All paths are validated as repository-relative paths before Git commands run.
- The backend re-reads Git status for the target file before mutating it.
- Discard is destructive and routes through the app action gate.
- Discard is blocked when the same file has an unsaved editor draft, so CodeMirror cannot silently re-save stale content over the Git result.
- Untracked discard uses `git clean -f -- <path>`; tracked discard uses `git restore --worktree -- <path>`.

## Verification

- `cargo test git_file_actions`
- `npm run build`
- `npm test`
- `npm run qa:editor` includes the `diff-review` screenshot state.
