# Superconductor (super.engineering) — UX reference notes

The signed binary (`resources/super.engineering.app`, 117MB) was removed from git 2026-07-07 — see `DECISIONS.md`. You can't mine UX patterns from a compiled binary, so committing the executable had no benefit, only licensing exposure. Kept: `Info.plist`, `super.icns`, and the settings-key feature map below (extracted via `strings` on the binary before removal — this is the actually-useful part).

The app itself is still installed at `/Applications/super.engineering.app` if you want to re-inspect it directly.

## Identity

- Bundle ID: `com.zarifpour.superconductor`
- Version: 0.1.0 (nightly channel, `releases.superconductor.so`)
- Stack: native Rust, GPUI (no Electron, no embedded browser)

## Feature map (from persisted-settings keys — this is what R3 should steal if it fires)

Workspace/tab model:
- `workspace_tab_placement`, `workspace_vertical_tab_rail_width`, `show_workspace_numbers_on_cmd_hold`
- `active_project_id`, `active_workspace_id`, `main_repo_path`, `project_ids`, `workspace_type`

Panel/layout persistence:
- `right_panel_layout_mode`, `right_panel_width`, `right_panel_hidden`, `right_panel_tab`
- `left_sidebar_width`, `left_sidebar_hidden`, `left_sidebar_layout`, `auto_hide_sidebars`
- `stacked_shell_weight`, `bottom_terminal_weight`, `bottom_terminal_collapsed`
- `center_top_bar_visible`, `center_bottom_bar_visible`

Worktree management:
- `worktree_sort_mode`, `sidebar_worktree_limit`, `global_worktree_root`
- `delete_local_branch_on_cleanup`, `delete_remote_tracking_branches_on_cleanup`
- `auto_fast_forward`, `auto_fast_forward_default_branch`, `automatic_branch_naming`

Agent orchestration:
- `provider_profile_overrides`, `custom_models`, `ai_routing`, `ai_execution`
- `default_tool`, `default_add_action`, `codex_dangerous_bypass`
- Agent hook events (from binary strings): `before_agent`, `after_tool_call`, `turn_started`, `turn_completed`, `permission_request`, `approval_requested`, `user_input_requested`, `plan_mode_prompt`, `subagent_start`/`subagent_stop`
- Supports: Claude Code, Codex, Gemini CLI, GitHub Copilot CLI, Cursor Agent, Nous Hermes, Kiro (per referenced install docs)

Review:
- `diff_word_wrap`, `diff_view_mode`, `review_submit`, `show_file_edits_inline`, `show_live_edits_in_chat`

Notes for R3 (Tauri build), if it ever fires: the tab/worktree/panel-persistence model above is the part worth studying closely — it's the closest existing implementation of "tabs = projects, worktree = task" this project has found in the wild.
