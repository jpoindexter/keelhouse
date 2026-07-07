# Editor-fidelity spike

The one test the audit flagged as cheap and load-bearing: does a TUI editor satisfy "I expected it to look like VSCode's"? 1-2 hours, resolves before a week gets sunk into zellij config.

## Run it

```bash
cd "spike"
hx sample.tsx
```

`hx` (helix) is now installed — real tree-sitter syntax highlighting, line numbers, gutter, on by default, no config needed for this test. `sample.tsx` is representative real code, same shape as `indx`'s `panel.tsx`.

Put it next to your VSCode screenshot from earlier in this conversation and look for 5 minutes:

- Line numbers, gutter — present?
- Syntax highlighting — distinct colors for keywords/strings/types, or flat?
- Can you tell a diff/change apart from surrounding code at a glance?
- Does it feel usable for real editing, or just "technically has the features"?

Ctrl+C or `:q` to quit.

## Report back

Tell me pass or fail — I'll log the verdict in `DECISIONS.md` under the 2026-07-07 zellij-trial entry, and it either clears the way for the zellij trial or moves R3 (Tauri) up the priority list per the threshold already written there.
