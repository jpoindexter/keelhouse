// SPIKE-2: prove the render + input loop.
// pty -> libghostty-vt (real Ghostty parsing) -> grid snapshot -> Tauri IPC event
// -> canvas paint (frontend); keydown -> Ghostty key Encoder -> bytes -> pty.
//
// Architecture note (the constraint that shapes everything): every libghostty-vt
// type is `!Send`/`!Sync` — the `Terminal` AND the key `Encoder` cannot cross
// threads. So both live inside ONE "terminal thread". A separate reader thread
// does the blocking pty read and forwards raw bytes over a channel. Keystrokes
// also flow to the terminal thread over the same channel; it encodes them (using
// the live terminal's modes) and writes to the pty. Nothing non-Send escapes.

use ignore::WalkBuilder;
use libghostty_vt::key::{Action, Encoder, Event, Key, Mods, OptionAsAlt};
use libghostty_vt::paste;
use libghostty_vt::style::{RgbColor, StyleColor};
use libghostty_vt::terminal::{
    Mode, Options, Point, PointCoordinate, PointSpace, ScrollViewport, Terminal,
};
use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

const INIT_COLS: u16 = 80;
const INIT_ROWS: u16 = 24;
const FALLBACK_FG: [u8; 3] = [220, 220, 220];
const FALLBACK_BG: [u8; 3] = [16, 16, 16];
const MENU_CLEAR: &str = "terminal.clear";
const MENU_OPEN: &str = "workspace.open";
const MAX_TREE_ENTRIES: usize = 8_000;

#[rustfmt::skip]
const LETTER_KEYS: [Key; 26] = [
    Key::A, Key::B, Key::C, Key::D, Key::E, Key::F, Key::G, Key::H, Key::I, Key::J,
    Key::K, Key::L, Key::M, Key::N, Key::O, Key::P, Key::Q, Key::R, Key::S, Key::T,
    Key::U, Key::V, Key::W, Key::X, Key::Y, Key::Z,
];
#[rustfmt::skip]
const DIGIT_KEYS: [Key; 10] = [
    Key::Digit0, Key::Digit1, Key::Digit2, Key::Digit3, Key::Digit4,
    Key::Digit5, Key::Digit6, Key::Digit7, Key::Digit8, Key::Digit9,
];

/// Messages into the terminal thread.
enum Msg {
    Data(Vec<u8>),
    Key {
        code: String,
        text: Option<String>,
        shift: bool,
        alt: bool,
        ctrl: bool,
        sup: bool,
    },
    Paste(String),
    Scroll {
        delta: isize,
    },
    Resize {
        cols: u16,
        rows: u16,
    },
}

/// One live terminal pane: the channel into its terminal thread + a killer for its
/// shell process, so the pane can be torn down when the workspace folder changes.
struct Pane {
    tx: Sender<Msg>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

/// App state for Tauri commands. Holds the CURRENT pane (None until a folder is
/// opened). Deliberately holds NO libghostty type (Terminal/Encoder are `!Send` and
/// live in the terminal thread); only the `Send` channel sender crosses the boundary.
struct PtyState {
    pane: Mutex<Option<Pane>>,
    watcher: Mutex<Option<WorkspaceWatcher>>,
}

impl PtyState {
    /// Forward a message to the current pane, if one is open.
    fn send(&self, msg: Msg) {
        if let Ok(guard) = self.pane.lock() {
            if let Some(pane) = guard.as_ref() {
                let _ = pane.tx.send(msg);
            }
        }
    }
}

#[derive(Serialize, Clone)]
struct Cell {
    t: String,  // grapheme(s) in the cell; " " when empty
    f: [u8; 3], // resolved foreground rgb
    b: [u8; 3], // resolved background rgb
    bold: bool,
}

#[derive(Serialize, Clone)]
struct Snapshot {
    cols: u16,
    rows: u16,
    cx: u16,          // cursor col
    cy: u16,          // cursor row
    cvis: bool,       // cursor visible
    sb: usize,        // scrollback rows available
    cells: Vec<Cell>, // row-major, len == cols * rows
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PaneExit {
    command: String,
    code: u32,
    message: String,
}

struct WorkspaceWatcher {
    _debouncer: Debouncer<RecommendedWatcher>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceTreeChanged {
    root: String,
    count: usize,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum FileTreeKind {
    Directory,
    File,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileTreeNode {
    id: String,
    name: String,
    path: String,
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileTreeNode>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileTreeResponse {
    root: String,
    nodes: Vec<FileTreeNode>,
    truncated: bool,
}

struct FileTreeBuilder {
    name: String,
    path: String,
    kind: FileTreeKind,
    children: BTreeMap<String, FileTreeBuilder>,
}

impl FileTreeBuilder {
    fn root(path: String) -> Self {
        Self {
            name: path.clone(),
            path,
            kind: FileTreeKind::Directory,
            children: BTreeMap::new(),
        }
    }

    fn insert(&mut self, parts: &[String], path: String, is_dir: bool) {
        if parts.is_empty() {
            return;
        }
        let name = &parts[0];
        let child = self
            .children
            .entry(name.to_lowercase())
            .or_insert_with(|| FileTreeBuilder {
                name: name.clone(),
                path: String::new(),
                kind: FileTreeKind::Directory,
                children: BTreeMap::new(),
            });
        if parts.len() == 1 {
            child.name = name.clone();
            child.path = path;
            child.kind = if is_dir {
                FileTreeKind::Directory
            } else {
                FileTreeKind::File
            };
            return;
        }
        child.kind = FileTreeKind::Directory;
        child.insert(&parts[1..], path, is_dir);
    }

    fn into_children(self) -> Vec<FileTreeNode> {
        let mut children: Vec<_> = self.children.into_values().map(Self::into_node).collect();
        children.sort_by(|a, b| {
            let ak = if a.kind == "directory" { 0 } else { 1 };
            let bk = if b.kind == "directory" { 0 } else { 1 };
            ak.cmp(&bk)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        children
    }

    fn into_node(self) -> FileTreeNode {
        let FileTreeBuilder {
            name,
            path,
            kind,
            children,
        } = self;
        let kind_name = match kind {
            FileTreeKind::Directory => "directory",
            FileTreeKind::File => "file",
        }
        .to_string();
        let children = if kind == FileTreeKind::Directory {
            Some(
                FileTreeBuilder {
                    name: String::new(),
                    path: String::new(),
                    kind,
                    children,
                }
                .into_children(),
            )
        } else {
            None
        };
        FileTreeNode {
            id: path.clone(),
            name,
            path,
            kind: kind_name,
            children,
        }
    }
}

/// User/workspace-selected command to launch inside the pty. The frontend owns the
/// profile choice; the backend only turns it into the process to spawn.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchProfile {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    use_login_shell: bool,
}

impl Default for LaunchProfile {
    fn default() -> Self {
        Self {
            command: std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into()),
            args: vec!["-l".into()],
            use_login_shell: false,
        }
    }
}

impl LaunchProfile {
    fn normalized(self) -> Self {
        if self.command.trim().is_empty() {
            Self::default()
        } else {
            Self {
                command: self.command,
                args: self.args,
                use_login_shell: self.use_login_shell,
            }
        }
    }
}

/// Map a W3C `KeyboardEvent.code` to a Ghostty `Key` + its unshifted base char.
/// Ghostty's `Key` enum mirrors the W3C code names (KeyA -> A, ArrowUp, Enter, ...).
fn key_from_code(code: &str) -> (Key, Option<char>) {
    if let Some(rest) = code.strip_prefix("Key") {
        if let Some(c) = rest.chars().next() {
            if rest.len() == 1 && c.is_ascii_uppercase() {
                return (
                    LETTER_KEYS[(c as u8 - b'A') as usize],
                    Some(c.to_ascii_lowercase()),
                );
            }
        }
    }
    if let Some(rest) = code.strip_prefix("Digit") {
        if let Some(d) = rest.chars().next() {
            if rest.len() == 1 && d.is_ascii_digit() {
                return (DIGIT_KEYS[(d as u8 - b'0') as usize], Some(d));
            }
        }
    }
    match code {
        "Enter" => (Key::Enter, None),
        "Tab" => (Key::Tab, None),
        "Space" => (Key::Space, Some(' ')),
        "Backspace" => (Key::Backspace, None),
        "Escape" => (Key::Escape, None),
        "Delete" => (Key::Delete, None),
        "Insert" => (Key::Insert, None),
        "ArrowUp" => (Key::ArrowUp, None),
        "ArrowDown" => (Key::ArrowDown, None),
        "ArrowLeft" => (Key::ArrowLeft, None),
        "ArrowRight" => (Key::ArrowRight, None),
        "Home" => (Key::Home, None),
        "End" => (Key::End, None),
        "PageUp" => (Key::PageUp, None),
        "PageDown" => (Key::PageDown, None),
        "Minus" => (Key::Minus, Some('-')),
        "Equal" => (Key::Equal, Some('=')),
        "BracketLeft" => (Key::BracketLeft, Some('[')),
        "BracketRight" => (Key::BracketRight, Some(']')),
        "Backslash" => (Key::Backslash, Some('\\')),
        "Semicolon" => (Key::Semicolon, Some(';')),
        "Quote" => (Key::Quote, Some('\'')),
        "Backquote" => (Key::Backquote, Some('`')),
        "Comma" => (Key::Comma, Some(',')),
        "Period" => (Key::Period, Some('.')),
        "Slash" => (Key::Slash, Some('/')),
        "F1" => (Key::F1, None),
        "F2" => (Key::F2, None),
        "F3" => (Key::F3, None),
        "F4" => (Key::F4, None),
        "F5" => (Key::F5, None),
        "F6" => (Key::F6, None),
        "F7" => (Key::F7, None),
        "F8" => (Key::F8, None),
        "F9" => (Key::F9, None),
        "F10" => (Key::F10, None),
        "F11" => (Key::F11, None),
        "F12" => (Key::F12, None),
        "NumpadEnter" => (Key::NumpadEnter, None),
        _ => (Key::Unidentified, None),
    }
}

/// Resolve a cell color (None -> default, Palette -> palette lookup, Rgb -> direct).
fn resolve(c: StyleColor, palette: &[RgbColor; 256], default: [u8; 3]) -> [u8; 3] {
    match c {
        StyleColor::None => default,
        StyleColor::Rgb(rgb) => [rgb.r, rgb.g, rgb.b],
        StyleColor::Palette(idx) => {
            let p = palette[idx.0 as usize];
            [p.r, p.g, p.b]
        }
    }
}

/// Read the full visible viewport out of the terminal into a serializable snapshot.
fn snapshot(term: &Terminal) -> Snapshot {
    let cols = term.cols().unwrap_or(INIT_COLS);
    let rows = term.rows().unwrap_or(INIT_ROWS);
    let palette = term
        .color_palette()
        .unwrap_or([RgbColor { r: 0, g: 0, b: 0 }; 256]);
    let dfg = term
        .default_fg_color()
        .ok()
        .flatten()
        .map(|c| [c.r, c.g, c.b])
        .unwrap_or(FALLBACK_FG);
    let dbg = term
        .default_bg_color()
        .ok()
        .flatten()
        .map(|c| [c.r, c.g, c.b])
        .unwrap_or(FALLBACK_BG);

    let mut cells = Vec::with_capacity(cols as usize * rows as usize);
    let mut buf = [' '; 8];
    for y in 0..rows {
        for x in 0..cols {
            let point = Point::Viewport(PointCoordinate { x, y: y as u32 });
            let mut t = String::new();
            let mut f = dfg;
            let mut b = dbg;
            let mut bold = false;
            if let Ok(gr) = term.grid_ref(point) {
                if let Ok(n) = gr.graphemes(&mut buf) {
                    for ch in buf.iter().take(n) {
                        t.push(*ch);
                    }
                }
                if let Ok(st) = gr.style() {
                    f = resolve(st.fg_color, &palette, dfg);
                    b = resolve(st.bg_color, &palette, dbg);
                    bold = st.bold;
                    if st.inverse {
                        std::mem::swap(&mut f, &mut b);
                    }
                }
            }
            if t.is_empty() {
                t.push(' ');
            }
            cells.push(Cell { t, f, b, bold });
        }
    }
    let mut cx = term.cursor_x().unwrap_or(0);
    let mut cy = term.cursor_y().unwrap_or(0);
    let mut cvis = term.is_cursor_visible().unwrap_or(true);
    if cvis {
        let cursor_ref = term.grid_ref(Point::Active(PointCoordinate {
            x: cx,
            y: cy as u32,
        }));
        match cursor_ref.as_ref().ok().and_then(|grid_ref| {
            term.point_from_grid_ref(grid_ref, PointSpace::Viewport)
                .ok()
                .flatten()
        }) {
            Some(point) => {
                cx = point.x;
                cy = point.y.min(u16::MAX as u32) as u16;
            }
            None => {
                cvis = false;
            }
        }
    }
    Snapshot {
        cols,
        rows,
        cx,
        cy,
        cvis,
        sb: term.scrollback_rows().unwrap_or(0),
        cells,
    }
}

/// Encode one key event through Ghostty's real encoder (respecting the terminal's
/// live modes) and write the resulting bytes to the pty.
fn handle_key(
    term: &Terminal,
    encoder: &mut Encoder,
    writer: &mut dyn Write,
    scratch: &mut Vec<u8>,
    code: &str,
    text: Option<String>,
    shift: bool,
    alt: bool,
    ctrl: bool,
    sup: bool,
) {
    if code == "Backspace" && alt && !shift && !ctrl && !sup {
        let _ = writer.write_all(&[0x17]);
        let _ = writer.flush();
        return;
    }

    let (key, base) = key_from_code(code);
    let mut ev = match Event::new() {
        Ok(e) => e,
        Err(_) => return,
    };
    ev.set_action(Action::Press);
    ev.set_key(key);

    let mut mods = Mods::empty();
    if shift {
        mods |= Mods::SHIFT;
    }
    if alt {
        mods |= Mods::ALT;
    }
    if ctrl {
        mods |= Mods::CTRL;
    }
    if sup {
        mods |= Mods::SUPER;
    }
    ev.set_mods(mods);

    // utf8 text: only printable, non-control text (the encoder derives ctrl/meta
    // sequences from key+mods itself — see set_utf8 docs).
    if let Some(t) = text {
        if let Some(c) = t.chars().next() {
            if !c.is_control() {
                ev.set_utf8(Some(t));
            }
        }
    }
    if let Some(c) = base {
        ev.set_unshifted_codepoint(c);
    }

    encoder.set_options_from_terminal(term);
    scratch.clear();
    if encoder.encode_to_vec(&ev, scratch).is_ok() && !scratch.is_empty() {
        let _ = writer.write_all(scratch);
        let _ = writer.flush();
    }
}

/// Encode pasted text (bracketed if the terminal has bracketed-paste mode on) and
/// write it to the pty. `paste::encode` strips unsafe control bytes internally.
fn handle_paste(term: &Terminal, writer: &mut dyn Write, text: String) {
    let bracketed = term.mode(Mode::BRACKETED_PASTE).unwrap_or(false);
    let mut data = text.into_bytes();
    let mut out = vec![0u8; data.len() + 16];
    if let Ok(n) = paste::encode(&mut data, bracketed, &mut out) {
        let _ = writer.write_all(&out[..n]);
        let _ = writer.flush();
    }
}

/// Frontend -> terminal thread: a key event (structured; encoded backend-side).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn send_key(
    state: State<PtyState>,
    code: String,
    text: Option<String>,
    shift: bool,
    alt: bool,
    ctrl: bool,
    sup: bool,
) {
    state.send(Msg::Key {
        code,
        text,
        shift,
        alt,
        ctrl,
        sup,
    });
}

/// Frontend -> terminal thread: pasted text (Cmd+V).
#[tauri::command]
fn paste(state: State<PtyState>, text: String) {
    state.send(Msg::Paste(text));
}

/// Frontend -> terminal thread: viewport resized to cols x rows.
#[tauri::command]
fn resize_pty(state: State<PtyState>, cols: u16, rows: u16) {
    state.send(Msg::Resize {
        cols: cols.max(2),
        rows: rows.max(2),
    });
}

/// Frontend -> terminal thread: scroll the visible viewport. Negative is up into
/// history; positive is down toward live output.
#[tauri::command]
fn scroll_pty(state: State<PtyState>, delta: isize) {
    state.send(Msg::Scroll { delta });
}

fn is_noisy_dir(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".next"
            | ".turbo"
            | ".vite"
            | "build"
            | "coverage"
            | "dist"
            | "node_modules"
            | "target"
    )
}

fn watch_event_is_relevant(root: &str, path: &Path) -> bool {
    let root = Path::new(root);
    let rel = match path.strip_prefix(root) {
        Ok(rel) => rel,
        Err(_) => return false,
    };
    !rel.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .map(is_noisy_dir)
            .unwrap_or(false)
    })
}

fn start_workspace_watcher(app: AppHandle, root: String) -> Result<WorkspaceWatcher, String> {
    let event_root = root.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(250),
        move |result: DebounceEventResult| {
            if let Ok(events) = result {
                let relevant_count = events
                    .iter()
                    .filter(|event| watch_event_is_relevant(&event_root, &event.path))
                    .count();
                if relevant_count > 0 {
                    let _ = app.emit(
                        "workspace-tree-changed",
                        WorkspaceTreeChanged {
                            root: event_root.clone(),
                            count: relevant_count,
                        },
                    );
                }
            }
        },
    )
    .map_err(|err| format!("Could not start workspace watcher: {err}"))?;
    debouncer
        .watcher()
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|err| format!("Could not watch workspace folder {root}: {err}"))?;
    Ok(WorkspaceWatcher {
        _debouncer: debouncer,
    })
}

/// Frontend -> filesystem: list a workspace tree using gitignore/app ignore rules.
#[tauri::command]
fn list_workspace_tree(path: String) -> Result<FileTreeResponse, String> {
    let root = validate_workspace_path(&path)?;
    let root_path = Path::new(&root);
    let mut tree = FileTreeBuilder::root(root.clone());
    let mut count = 0usize;
    let mut truncated = false;

    let walker = WalkBuilder::new(&root)
        .standard_filters(true)
        .require_git(false)
        .hidden(false)
        .filter_entry(|entry| {
            entry
                .file_name()
                .to_str()
                .map(|name| !is_noisy_dir(name))
                .unwrap_or(true)
        })
        .build();

    for entry in walker {
        let entry = entry.map_err(|err| format!("Could not read workspace tree: {err}"))?;
        let path = entry.path();
        if path == root_path {
            continue;
        }
        if count >= MAX_TREE_ENTRIES {
            truncated = true;
            break;
        }
        let rel = match path.strip_prefix(root_path) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        let parts: Vec<String> = rel
            .components()
            .map(|component| component.as_os_str().to_string_lossy().into_owned())
            .collect();
        if parts.is_empty() {
            continue;
        }
        let is_dir = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
        tree.insert(&parts, path.to_string_lossy().into_owned(), is_dir);
        count += 1;
    }

    Ok(FileTreeResponse {
        root,
        nodes: tree.into_children(),
        truncated,
    })
}

/// Frontend -> filesystem: start or replace the live watcher for the current
/// workspace. The watcher only emits a refresh signal; `list_workspace_tree` stays
/// the single source of truth for rail data.
#[tauri::command]
fn watch_workspace_tree(
    app: AppHandle,
    state: State<PtyState>,
    path: String,
) -> Result<(), String> {
    let root = validate_workspace_path(&path)?;
    let watcher = start_workspace_watcher(app, root)?;
    if let Ok(mut guard) = state.watcher.lock() {
        guard.replace(watcher);
    }
    Ok(())
}

/// Open (or switch to) a workspace folder: spawn a fresh pane in `path` using the
/// selected launch profile and tear down the previous one. Persistence of the last
/// folder/profile is done frontend-side.
#[tauri::command]
fn open_workspace(
    app: AppHandle,
    state: State<PtyState>,
    path: String,
    profile: Option<LaunchProfile>,
) -> Result<(), String> {
    let cwd = validate_workspace_path(&path)?;
    let profile = profile.unwrap_or_default().normalized();
    preflight_profile(&profile, &cwd)?;
    let new = spawn_pane(app, cwd, profile)?;
    if let Ok(mut guard) = state.pane.lock() {
        if let Some(mut old) = guard.replace(new) {
            let _ = old.killer.kill();
        }
    }
    Ok(())
}

/// Quote one shell token for the login-shell profile path.
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

fn validate_workspace_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No workspace folder was selected.".into());
    }
    let path = Path::new(trimmed);
    if !path.exists() {
        return Err(format!("Workspace folder does not exist: {trimmed}"));
    }
    if !path.is_dir() {
        return Err(format!("Workspace path is not a folder: {trimmed}"));
    }
    path.canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|err| format!("Cannot open workspace folder {trimmed}: {err}"))
}

fn command_exists_on_path(command: &str) -> bool {
    let cmd_path = Path::new(command);
    if cmd_path.components().count() > 1 {
        return cmd_path.is_file();
    }
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(command).is_file()))
        .unwrap_or(false)
}

fn preflight_profile(profile: &LaunchProfile, cwd: &str) -> Result<(), String> {
    let command = profile.command.trim();
    if command.is_empty() {
        return Err("Launch profile command is empty.".into());
    }
    if profile.use_login_shell {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        let status = Command::new(&shell)
            .arg("-l")
            .arg("-c")
            .arg(format!("command -v -- {} >/dev/null", shell_quote(command)))
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|err| format!("Cannot run login shell {shell} to check `{command}`: {err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "Cannot find `{command}` in the login-shell PATH. Open a normal terminal and run `command -v {command}`, or update the launch profile."
            ))
        }
    } else if command_exists_on_path(command) {
        Ok(())
    } else {
        Err(format!(
            "Cannot find `{command}` on PATH. Use a full path or enable login-shell launch for shell-managed tools."
        ))
    }
}

fn profile_command(profile: &LaunchProfile) -> CommandBuilder {
    if profile.use_login_shell {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l");
        cmd.arg("-c");
        let mut line = format!("exec {}", shell_quote(&profile.command));
        for arg in &profile.args {
            line.push(' ');
            line.push_str(&shell_quote(arg));
        }
        cmd.arg(line);
        cmd
    } else {
        let mut cmd = CommandBuilder::new(&profile.command);
        for arg in &profile.args {
            cmd.arg(arg);
        }
        cmd
    }
}

/// Spawn a fresh terminal pane: the selected profile in `cwd` (or $HOME), a reader
/// thread forwarding pty bytes, and a terminal thread owning the `!Send` Terminal +
/// Encoder that emits grid snapshots via `app`. Returns a launch error if the
/// pty/process cannot start.
fn spawn_pane(app: AppHandle, cwd: String, profile: LaunchProfile) -> Result<Pane, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: INIT_ROWS,
            cols: INIT_COLS,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("Could not open a pty for `{}`: {err}", profile.command))?;

    let mut cmd = profile_command(&profile);
    cmd.env("TERM", "xterm-256color");
    cmd.cwd(&cwd);
    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| format!("Could not launch `{}` in {cwd}: {err}", profile.command))?;
    drop(pair.slave);
    let killer = child.clone_killer();

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("Could not attach reader for `{}`: {err}", profile.command))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("Could not attach writer for `{}`: {err}", profile.command))?;
    let master = pair.master;

    let (tx, rx) = channel::<Msg>();

    // Reader thread: blocking pty read -> forward raw bytes.
    let tx_read = tx.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if tx_read.send(Msg::Data(buf[..n].to_vec())).is_err() {
                        break;
                    }
                }
            }
        }
    });

    let app_exit = app.clone();
    let command_name = profile.command.clone();
    std::thread::spawn(move || {
        let (code, message) = match child.wait() {
            Ok(status) => {
                let code = status.exit_code();
                (
                    code,
                    format!(
                        "`{}` exited with code {code}. If this happened during startup, check the CLI auth/session in a normal terminal.",
                        command_name
                    ),
                )
            }
            Err(err) => (
                1,
                format!("Could not observe `{}` process status: {err}", command_name),
            ),
        };
        let _ = app_exit.emit(
            "pane-exit",
            PaneExit {
                command: command_name,
                code,
                message,
            },
        );
    });

    // Terminal thread: owns Terminal + Encoder (both !Send, created here) + master
    // (resize) + writer (input). Process status is monitored separately via the
    // Send child handle; Terminal/Encoder never leave this thread.
    std::thread::spawn(move || {
        let master = master;
        let mut writer = writer;
        let mut scratch: Vec<u8> = Vec::with_capacity(64);
        let mut term = match Terminal::new(Options {
            cols: INIT_COLS,
            rows: INIT_ROWS,
            max_scrollback: 5000,
        }) {
            Ok(t) => t,
            Err(_) => return,
        };
        let mut encoder = match Encoder::new() {
            Ok(e) => e,
            Err(_) => return,
        };
        encoder.set_macos_option_as_alt(OptionAsAlt::True);

        let do_resize = |master: &Box<dyn portable_pty::MasterPty + Send>,
                         term: &mut Terminal,
                         cols: u16,
                         rows: u16| {
            let _ = master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
            let _ = term.resize(cols, rows, 0, 0);
        };

        while let Ok(msg) = rx.recv() {
            match msg {
                Msg::Data(bytes) => {
                    term.vt_write(&bytes);
                    loop {
                        match rx.try_recv() {
                            Ok(Msg::Data(more)) => term.vt_write(&more),
                            Ok(Msg::Scroll { delta }) => {
                                term.scroll_viewport(ScrollViewport::Delta(delta))
                            }
                            Ok(Msg::Resize { cols, rows }) => {
                                do_resize(&master, &mut term, cols, rows)
                            }
                            Ok(Msg::Key {
                                code,
                                text,
                                shift,
                                alt,
                                ctrl,
                                sup,
                            }) => {
                                term.scroll_viewport(ScrollViewport::Bottom);
                                handle_key(
                                    &term,
                                    &mut encoder,
                                    &mut *writer,
                                    &mut scratch,
                                    &code,
                                    text,
                                    shift,
                                    alt,
                                    ctrl,
                                    sup,
                                )
                            }
                            Ok(Msg::Paste(t)) => {
                                term.scroll_viewport(ScrollViewport::Bottom);
                                handle_paste(&term, &mut *writer, t)
                            }
                            Err(_) => break,
                        }
                    }
                    let _ = app.emit("grid", snapshot(&term));
                }
                Msg::Key {
                    code,
                    text,
                    shift,
                    alt,
                    ctrl,
                    sup,
                } => {
                    term.scroll_viewport(ScrollViewport::Bottom);
                    handle_key(
                        &term,
                        &mut encoder,
                        &mut *writer,
                        &mut scratch,
                        &code,
                        text,
                        shift,
                        alt,
                        ctrl,
                        sup,
                    );
                    let _ = app.emit("grid", snapshot(&term));
                }
                Msg::Paste(t) => {
                    term.scroll_viewport(ScrollViewport::Bottom);
                    handle_paste(&term, &mut *writer, t);
                    let _ = app.emit("grid", snapshot(&term));
                }
                Msg::Scroll { delta } => {
                    term.scroll_viewport(ScrollViewport::Delta(delta));
                    let _ = app.emit("grid", snapshot(&term));
                }
                Msg::Resize { cols, rows } => {
                    do_resize(&master, &mut term, cols, rows);
                    let _ = app.emit("grid", snapshot(&term));
                }
            }
        }
    });

    Ok(Pane { tx, killer })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .menu(|handle| {
            let menu = Menu::default(handle)?;
            let open =
                MenuItem::with_id(handle, MENU_OPEN, "Open Folder…", true, Some("CmdOrCtrl+O"))?;
            let clear = MenuItem::with_id(handle, MENU_CLEAR, "Clear", true, Some("CmdOrCtrl+K"))?;
            let terminal = Submenu::with_items(handle, "Terminal", true, &[&open, &clear])?;
            menu.append(&terminal)?;
            Ok(menu)
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_CLEAR => {
                if let Some(state) = app.try_state::<PtyState>() {
                    state.send(Msg::Key {
                        code: "KeyL".into(),
                        text: None,
                        shift: false,
                        alt: false,
                        ctrl: true,
                        sup: false,
                    });
                }
            }
            MENU_OPEN => {
                let _ = app.emit("menu-open-folder", ());
            }
            _ => {}
        })
        .setup(|app| {
            // No pane yet — the frontend opens the last folder (or the picker) on
            // startup, which spawns the first pane via `open_workspace`.
            app.manage(PtyState {
                pane: Mutex::new(None),
                watcher: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_key,
            paste,
            resize_pty,
            scroll_pty,
            open_workspace,
            list_workspace_tree,
            watch_workspace_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn encode_key(code: &str, shift: bool, alt: bool, ctrl: bool) -> Vec<u8> {
        let term = Terminal::new(Options {
            cols: INIT_COLS,
            rows: INIT_ROWS,
            max_scrollback: 100,
        })
        .expect("create terminal");
        let mut encoder = Encoder::new().expect("create encoder");
        encoder.set_macos_option_as_alt(OptionAsAlt::True);
        let mut scratch = Vec::new();
        let mut out = Vec::new();
        handle_key(
            &term,
            &mut encoder,
            &mut out,
            &mut scratch,
            code,
            None,
            shift,
            alt,
            ctrl,
            false,
        );
        out
    }

    #[test]
    fn cmd_k_menu_clear_encodes_ctrl_l() {
        assert_eq!(encode_key("KeyL", false, false, true), vec![0x0c]);
    }

    #[test]
    fn option_left_encodes_meta_arrow_left() {
        assert_eq!(
            encode_key("ArrowLeft", false, true, false),
            b"\x1b[1;3D".to_vec()
        );
    }

    #[test]
    fn option_right_encodes_meta_arrow_right() {
        assert_eq!(
            encode_key("ArrowRight", false, true, false),
            b"\x1b[1;3C".to_vec()
        );
    }

    #[test]
    fn option_backspace_encodes_meta_delete_word() {
        assert_eq!(encode_key("Backspace", false, true, false), vec![0x17]);
    }

    #[test]
    fn shell_quote_preserves_spaces() {
        assert_eq!(shell_quote("agent cli"), "'agent cli'");
    }

    #[test]
    fn shell_quote_escapes_single_quotes() {
        assert_eq!(shell_quote("that's fine"), "'that'\\''s fine'");
    }

    #[test]
    fn validate_workspace_rejects_missing_path() {
        let err = validate_workspace_path("/definitely/missing/agent-cli-workspace")
            .expect_err("missing path should fail");
        assert!(err.contains("does not exist"));
    }

    #[test]
    fn validate_workspace_accepts_current_dir() {
        let cwd = std::env::current_dir().expect("current dir");
        let validated = validate_workspace_path(cwd.to_str().expect("utf8 cwd"))
            .expect("current dir should validate");
        assert_eq!(
            validated,
            cwd.canonicalize()
                .expect("canonical cwd")
                .to_string_lossy()
                .into_owned()
        );
    }

    #[test]
    fn preflight_rejects_missing_non_login_command() {
        let cwd = std::env::current_dir()
            .expect("current dir")
            .to_string_lossy()
            .into_owned();
        let err = preflight_profile(
            &LaunchProfile {
                command: "definitely-missing-agent-cli-command".into(),
                args: vec![],
                use_login_shell: false,
            },
            &cwd,
        )
        .expect_err("missing command should fail");
        assert!(err.contains("Cannot find"));
    }

    #[test]
    fn preflight_rejects_missing_login_shell_command() {
        let cwd = std::env::current_dir()
            .expect("current dir")
            .to_string_lossy()
            .into_owned();
        let err = preflight_profile(
            &LaunchProfile {
                command: "definitely-missing-agent-cli-command".into(),
                args: vec![],
                use_login_shell: true,
            },
            &cwd,
        )
        .expect_err("missing command should fail");
        assert!(err.contains("login-shell PATH"));
    }

    fn tree_contains(nodes: &[FileTreeNode], name: &str) -> bool {
        nodes.iter().any(|node| {
            node.name == name
                || node
                    .children
                    .as_ref()
                    .map(|children| tree_contains(children, name))
                    .unwrap_or(false)
        })
    }

    #[test]
    fn list_workspace_tree_skips_noisy_dirs_and_keeps_gitignore_visible() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-tree-test-{suffix}"));
        fs::create_dir_all(root.join("src")).expect("create src");
        fs::create_dir_all(root.join("node_modules/pkg")).expect("create node_modules");
        fs::create_dir_all(root.join("target/debug")).expect("create target");
        fs::write(root.join(".gitignore"), "ignored.txt\n").expect("write gitignore");
        fs::write(root.join("visible.txt"), "visible").expect("write visible");
        fs::write(root.join("ignored.txt"), "ignored").expect("write ignored");
        fs::write(root.join("src/main.rs"), "fn main() {}\n").expect("write src");
        fs::write(root.join("node_modules/pkg/index.js"), "").expect("write node module");
        fs::write(root.join("target/debug/app"), "").expect("write target file");

        let tree = list_workspace_tree(root.to_string_lossy().into_owned()).expect("tree");
        assert!(tree_contains(&tree.nodes, "src"));
        assert!(tree_contains(&tree.nodes, "main.rs"));
        assert!(tree_contains(&tree.nodes, ".gitignore"));
        assert!(tree_contains(&tree.nodes, "visible.txt"));
        assert!(!tree_contains(&tree.nodes, "ignored.txt"));
        assert!(!tree_contains(&tree.nodes, "node_modules"));
        assert!(!tree_contains(&tree.nodes, "target"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn watch_event_filter_ignores_noisy_tree_paths() {
        let root = "/tmp/agent-cli-watch-root";
        assert!(watch_event_is_relevant(
            root,
            Path::new("/tmp/agent-cli-watch-root/src/main.rs")
        ));
        assert!(!watch_event_is_relevant(
            root,
            Path::new("/tmp/agent-cli-watch-root/node_modules/pkg/index.js")
        ));
        assert!(!watch_event_is_relevant(
            root,
            Path::new("/tmp/agent-cli-watch-root/target/debug/app")
        ));
        assert!(!watch_event_is_relevant(
            root,
            Path::new("/tmp/other-root/src/main.rs")
        ));
    }
}
