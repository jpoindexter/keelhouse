# Runtime Comparison

Captured: 2026-07-12T21:54:55.489Z
Status: observational-comparison

This captures current real workloads. It does not prove the equivalent-workflow North Star until VS Code and Keelhouse run the same controlled scenario.

## Samples

- Packaged Keelhouse: 263.9 MB RSS, 0.0% CPU, 8.0 processes (5 samples). Three restored projects; five panes in the active project (three shells, one exited Codex, one Gemini at the trust prompt).
- Current VS Code workload: 14915.3 MB RSS, 201.1% CPU, 482.0 processes (5 samples). Existing long-running user workload with extensions and multiple windows; observational baseline only, not a controlled equivalent run.

## Remaining Proof

Run the same one-project, two-agent, and three-project workflows in both apps from comparable cold starts, then record elapsed time and process-tree deltas.

