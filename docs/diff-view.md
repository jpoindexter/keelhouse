# Diff View

DIFF-VIEW lets Keelhouse inspect agent-created file changes without switching to VS Code.

## Behavior

- The Source Control drawer reads `git status --short --branch`; clicking a changed file opens a read-only diff review in the editor tray.
- File rail context menus expose **Open Diff** for nodes with Git markers.
- The diff view shows source (`working-tree`, `staged`, `untracked`, or `clean`), status, additions, deletions, old/new line numbers, and unified diff metadata.
- Hunk rows can jump to the changed file and center the editor at the hunk when the file still exists.
- Opening a normal file or closing the diff tab exits review mode.

## Boundaries

- Stage, unstage, discard, and copy-diff actions are implemented by `GIT-ACTIONS-LITE`; this document covers the review surface they attach to.
- The backend validates relative Git paths and rejects absolute paths or parent-directory traversal.
- Untracked text files get a synthetic unified diff. Large or binary untracked files return an explicit error instead of reading arbitrary bytes into the UI.
- Deleted files can be reviewed from Git status, but cannot be opened as editor files.

## Verification

- `npm test -- diffView.test.ts`
- `PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run build`
- `cargo test git_`
- `cargo test synthesizes_untracked_text_diff`
