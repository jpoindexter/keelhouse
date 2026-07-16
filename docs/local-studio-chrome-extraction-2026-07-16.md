# Local Studio Chrome Extraction — 2026-07-16

Reference: `sybil-solutions/local-studio` at `07be5be7`<br>
Local clone: `/Users/jasonpoindexter/Documents/GitHub/local-studio`

The audit covers the rendered `/agent` workbench at desktop width, its zero-width navigation state, its open right inspector, and the source tokens/components that produce those states. Values marked **observed** come from the live page or source tokens. Product-role mappings are **inferred**.

## Reference system

| Dimension | Reference evidence | Confidence |
|---|---|---|
| Canvas | `#181818` window, header, and panel; `#212121` raised surface | observed |
| Separation | `#ffffff14` borders, `#ffffff0a` soft separators, `#ffffff0d` hover | observed |
| Type | System sans; 14px base, 13px controls, 11–12px metadata | observed |
| Navigation | 275px expanded; 30px rows; 10px row radius; 8px horizontal inset | observed |
| Collapse | Expanded navigation becomes a real 0px column; only a 40px reveal target remains | observed |
| Toolbars | 46px app toolbar and 40px pane toolbar | observed |
| Composer | `clamp(25vw, 48rem, 52vw)` width; raised `#212121` surface; metadata directly below | observed |
| Inspector | 360px fallback width; grouped Session, Skills, Workspace, Browser, and Canvas state | observed |
| Accent | Neutral chrome with blue reserved for links, focus, files, and live state | observed |

## Adopt

- **True canvas collapse.** Keelhouse should let the thread drawer reach zero width instead of leaving a permanent icon rail. The reveal control stays visible in the top-left chrome.
- **Action-only top strip.** Keep the thread title and global toggles, but remove redundant labels and boxed controls from the pane header.
- **Anchored composer metadata.** Put repository path, branch/diff state, provider state, and context usage immediately under the composer so users do not hunt through a status bar.
- **On-demand inspector.** Add a compact Context mode to the existing right dock. Group session, workspace, and tool state with label/value rows and hairline section separators.
- **Unified canvas.** Use one graphite family for window, header, rail, and inspector; communicate hierarchy with small surface deltas and shadows rather than border boxes.

## Adapt

- Local Studio's 275px navigation becomes a denser Keelhouse project-chat drawer, between its current 332px contract and the reference width.
- Local Studio's status-only right panel becomes one mode inside Keelhouse's existing Files / Editor / Browser / Git dock. It does not replace those tools.
- The reference's 24px composer radius is reduced to Keelhouse's tighter integrated surface grammar. We take the anchoring and metadata, not the capsule silhouette.
- The reference's neutral white brand accent stays steel-cyan in Keelhouse. Cyan remains sparse: focus, live state, links, and the single Send position.
- Local Studio hides its entire sidebar on collapse. Keelhouse preserves project identity in the title strip while applying the same zero-width body behavior.

## Reject

- Generic product navigation (`Status`, `Workbench`, `Configure`, `Usage`) that competes with project chats.
- The motivational empty-state hero and its large unused center field; Keelhouse should surface the selected task and recent run evidence.
- Moving terminal into the top pane header. Keelhouse keeps Terminal / Processes / Logs in the bottom utility tray.
- Copying Local Studio's rounded composer, avatar, or monochrome branding literally.
- Showing controller/model-runtime concepts that do not map to Keelhouse's Codex/Claude chat and project workflow.

## Demo target

The updated standalone demo should prove these behaviors at 1440px, 1024px, and 900px:

1. Thread drawer collapses to zero width and restores without shifting control meaning.
2. Context inspector opens as a right-dock mode and can switch to Files, Browser, or Git.
3. Composer remains centered and usable with both side surfaces open or closed.
4. Repository, branch, dirty-file count, provider, and context usage sit directly beneath the composer.
5. Terminal / Processes / Logs stay in a collapsible bottom tray.
6. Every interactive control is a native button/input with visible keyboard focus and an accessible name.
