# Chat Forks and Safe Checkpoints

Keelhouse can fork a durable chat from any completed user or assistant message. The new chat copies history only through the selected message, records its parent chat/message, and starts without a provider thread, run, or token-usage state. The project rail marks forked chats with the branch icon.

## Workspace Checkpoints

Forking attempts to capture the current Git working-tree delta. A chat context menu can replace that checkpoint or restore it later.

- Capture runs read-only `git status` and `git rev-parse` commands, then stores changed/deleted file bytes under private app data (`0700` directory, `0600` manifests).
- Capture never stages files or changes the index. Tests compare `git write-tree` before and after capture/restore.
- Restore first computes exact `write` and `delete` actions and binds them to a preview token. Any disk change invalidates that token.
- Dirty editor buffers in affected files block restore in both the frontend and Rust command.
- The user must approve the file list before restore.
- Restore creates a recovery checkpoint before direct atomic file writes/deletes. The chat menu retains that recovery checkpoint for reversal.
- Restore refuses a changed `HEAD`, another workspace, symlinks, oversized files, and malformed paths.

The implementation never uses `git add`, `git reset --hard`, `git clean -fd`, or `git apply`. It leaves staged state untouched.

## Verification

Run `npm test`, `npm run build`, and `cargo test`. Native completion additionally requires forking a packaged chat, relaunching it, previewing a restore with staged and dirty files, confirming the dirty-buffer block, and executing restore/recovery while verifying the index tree is unchanged.
