# Run Cards Adapter

`RUN-CARDS-ADAPTER` renders compact activity cards only from explicit structured events. Terminal output, pane transcripts, and text heuristics are not card sources.

## Provenance Contract

Every card carries both a `provenance` and `runCardKind`:

| Source | Provenance | Supported cards |
| --- | --- | --- |
| Codex/Claude provider stream | `provider` | thinking, plan, file, approval, command, tool |
| Approved Keelhouse action | `app-action` | approval |
| `report_status` MCP hook | `agent-hook` | thinking, plan, file, approval, command, tool |

Messages without both fields remain ordinary tool output. `runCards.test.ts` enforces this boundary and fails if the chat renderer starts reading terminal snapshots or pane transcripts.

## Behavior

- Provider file-change events retain workspace-relative targets and expose **Review**, opening the Git diff when the file is changed or the editor otherwise.
- Plans and file/approval cards open by default; running and failed cards remain visible.
- Hook callers may report `kind`, `state`, and up to 24 file targets. The app validates the payload and records its origin as `agent-hook`.
- Card attribution, kind, and targets persist in the SQLite chat store through schema migration v5.
- Without a structured adapter or hook event, the raw terminal stays raw and no card is fabricated.

## Verification

Automated tests cover provider thinking, command, file, plan, and approval attribution; hook attribution; terminal-text rejection; SQLite migration and round-trip persistence; and renderer source restrictions. Packaged verification sent real `report_status` plan, file, and command events through the authenticated MCP hook. The file card's **Review** action revealed the Editor with `README.md`, and a hook card bound to the stable chat handle remained visible after the packaged app was killed and relaunched.
