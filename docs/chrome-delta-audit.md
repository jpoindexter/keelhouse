# Chrome Delta Audit — 2026-07-11

Why this exists: the shipped chrome passed `npm run qa:chrome-contract` while visually diverging from the accepted `demo/keelhouse-chrome-demo.html`. The gate greps tokens and strings; it cannot see visual weight. Jason confirmed the drift by eye. This is the durable record of the delta that drove the chrome re-convergence cards (CHROME-CONTROL-GRAMMAR → CHROME-CONTRACT-V2, plus RUN-CARDS-ADAPTER in v2). Decision: DECISIONS.md 2026-07-11.

## Delta table (demo spec vs shipped app at audit time)

| Surface | Demo (approved) | App (shipped 2026-07-10) | Delta type |
|---|---|---|---|
| Control grammar | 3 types: flat text-action (600wt, hover→accent-strong), transparent 18px icon, ONE filled Send (24px, `#67c3d1`, 4px radius) | ~50 boxed buttons via shared classes `.rail-open-button, .editor-command, .editor-save, .browser-button, .terminal-pane-button, .agent-composer__button, .draft-modal__button` (1px border + `--control-bg` #282828 + 4px radius) | Restyle (core) |
| Tabs | Flat strip, active = `inset 0 2px 0 var(--accent)` top underline + elevated bg | Surface/layout switchers already flat with underline actives; pane pills and scope tabs still boxed | Partial restyle |
| Rows | Active = `#252732` + `inset 3px 0 0 var(--accent)` left stripe; hover `#22242d`; 34px min | Row-active token exists; rows carry boxed affordances (Switch buttons) | Restyle |
| Run surface | Centered `min(860px, 100% - 56px)` column; 12px muted meta; thinking = 2px left border; cards 6px radius `#191a22` + `0 12px 34px` shadow; approval = accent-soft strip | Full-width dump, bold "Live agent output" banner, no cards, no rhythm | Recompose |
| Composer | Elevated card: 12px radius, `#343642` border, `0 22px 60px` shadow, gradient wrap, borderless textarea (78px min), 34px flat-chip bar, 24px filled ↑ send | 4px-radius input + boxed Send/Stop + boxed chips | Recompose |
| Sidebar | 11px/600 uppercase section labels (`.06em`, faint), 34px rows, 28px-indent thread rows with recency stamps, 7px dots, left-stripe active | "PROJECT THREADS" header + icon mode-switcher + boxed row affordances | Restyle |
| Titlebar/status | 36px gradient titlebar (`linear-gradient(#22232b,#1b1c23)`): centered crumb (strong project + faint `⎇ branch`), flat top actions, accent agent chip; 24px 3-section statusbar | 38px flat titlebar with boxed Commands/Open Folder; statusbar close (24px, 11px) | Restyle |
| Tray/dock nav | Tab strips: dock `Files/Editor/Browser/Git + ×` (38px), tray `Terminal/Processes/Logs/Browser Preview` (34px), underline actives, collapsible | Tools popover + drawer modes; movable trays (KEEP); no tab-strip metaphor | Structural (hybrid) |
| First-open | Demo layout visible: sidebar + run + right dock (Files) + tray strip | `DEFAULT_WORKBENCH_LAYOUT: "hidden"` — tools hidden | Default change |
| Overlays | Menus 6px radius, 24px uppercase-mono labels, 28px `icon\|label\|kbd` rows; palette 640px/10px radius/42px input/32px left-stripe rows; settings modal 900×560 with 230px nav | Context menu 4–5px radius, palette 6px — close; settings modal not built (v2) | Align |
| Typography | Inter 13px base / 12px meta+mono / 11px labels; 600 headers | Not on the demo scale | Restyle |
| Depth | Shadows for elevation (card `0 12px 34px`, composer `0 22px 60px`, menu `0 18px 42px`); borders as hairlines only | Border-heavy, minimal shadow | Restyle |

## What carries over unchanged

- Full 3-tier token system in `app/src/App.css`; steel-cyan tokens already exact (`#67c3d1` / `#9bd9e3` / `#162c33`).
- `useWorkbenchLayout.ts` docking, persistence, resizers (hybrid decision keeps all of it).
- `icons.tsx` lucide single-family icon contract.
- The 44-assertion `scripts/check-chrome-contract.mjs` gate — extended, not replaced, by CHROME-CONTRACT-V2.

## Boundary re-affirmed

The demo's structured thinking/working-plan/edited-file/approval cards require real agent events. Keelhouse never infers provider chat/tool/thinking structure from terminal text. The 2026-07-13 Codex JSON adapter now supplies user, assistant, command, file, status, and error events; richer approval cards and non-Codex providers still require explicit adapters (RUN-CARDS-ADAPTER).

## Lesson for gates

A grep gate proves tokens and strings, not composition or weight. CHROME-CONTRACT-V2 adds class-level prohibitions (boxed control backgrounds on named button classes) and requires demo-vs-app side-by-side screenshots in `docs/qa/chrome-delta/` so drift of this kind fails loudly.
