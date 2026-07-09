# Zed Reference Framework

Zed is now the primary reference for Keelhouse's workbench chrome and panel model.
Local reference clone: `/Users/jasonpoindexter/Documents/GitHub/zed`, updated to upstream `55b7761` on 2026-07-09.

## Boundary

Use Zed as a reference architecture and interaction model, not as vendored source. Most relevant Zed crates are `GPL-3.0-or-later`; Keelhouse should not copy GPL implementation unless the project intentionally accepts that license boundary. The current Keelhouse stack remains Tauri 2, React, TypeScript, Rust, CodeMirror, and Ghostty VT.

## What To Borrow

- **Workspace shell model:** one central workbench plus registered side/bottom/right surfaces. Zed's relevant files are `crates/workspace/src/multi_workspace.rs`, `crates/workspace/src/workspace.rs`, and `crates/workspace/src/dock.rs`.
- **Panel contract:** panels declare identity, allowed positions, default/min size, icon, toggle action, active/zoom state, and persistence key. Keelhouse should model this as a TypeScript `WorkbenchPanel` contract rather than scattered tray state.
- **Resizable docks:** Zed uses 6px resize handles, clamped sizes, double-click reset, and persisted size state. Keelhouse should use the same behavior for editor, browser, raw terminal, and side drawer.
- **Sidebar contract:** sidebars expose width, focus, notification state, project/thread cycling, and serialized state. Keelhouse should adapt this to Projects, Files, Search, Git, Browser, and Settings drawer modes.
- **Agent panel posture:** Zed's `crates/agent_ui/src/agent_panel.rs` treats agent UI as a first-class panel with terminal-thread awareness, selected agent state, menus, and thread/session metadata. Keelhouse should invert this: the agent cockpit is primary; editor/browser/raw terminal are panels around it.
- **Polished menus:** Zed uses shared `PopoverMenu`, `ContextMenu`, `IconButton`, labels, headers, separators, disabled states, and shortcut-aware tooltips. Keelhouse dropdowns/context menus should be rebuilt on one shared menu primitive.

## What Not To Borrow

- GPUI or Zed's full Rust UI stack.
- Zed's editor-first information hierarchy.
- Extension marketplace, collab, LSP/debugger surfaces, or broad IDE scope.
- Direct code copies from GPL crates without an explicit licensing decision.

## Keelhouse Translation

Create a workbench-shell layer with four explicit concepts:

1. `WorkspaceShell`: top status bar, side drawer slot, agent cockpit center, dock/tray host, bottom status strip.
2. `WorkbenchPanel`: id, title, icon, valid positions, default size, min size, visible/zoomed state, active state, render target, and persistence key.
3. `DrawerMode`: Projects, Files, Search, Git, Browser, Settings, each with focus handling, width persistence, badges, and serialized mode state.
4. `ChromePrimitive`: shared button, icon button, segmented control, select/popover, context menu, tooltip, resize handle, badge, and status pill.

## Chrome Pass Acceptance

- The default screen reads as one large agent-first cockpit, not stacked panes.
- Side drawer modes are real content switches, not decorative icons.
- Editor, browser, and raw terminal can move left, right, bottom, or hide without breaking state.
- Resize handles are visible on hover/focus, keyboard reachable where practical, and double-click reset when supported.
- Menus/dropdowns share one styled primitive with headers, separators, shortcuts, disabled states, and danger states.
- Screenshot QA includes full, narrow, drawer, tray-left, tray-right, tray-bottom, menu, and dropdown states.
