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
use std::fs;
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

const INIT_COLS: u16 = 80;
const INIT_ROWS: u16 = 24;
const FALLBACK_FG: [u8; 3] = [220, 220, 220];
const FALLBACK_BG: [u8; 3] = [16, 16, 16];
const MENU_CLEAR: &str = "terminal.clear";
const MENU_CLOSE_EDITOR_TAB: &str = "editor.closeTab";
const MENU_FIND: &str = "editor.find";
const MENU_OPEN: &str = "workspace.open";
const MENU_SAVE: &str = "editor.save";
const MAX_TREE_ENTRIES: usize = 8_000;
const MAX_TEXT_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_SEARCH_FILE_BYTES: u64 = 512 * 1024;
const MAX_SEARCH_MATCHES: usize = 200;

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
#[derive(Clone)]
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
    ScrollToRow {
        row: u32,
    },
    SearchScrollback {
        query: String,
        reply: Sender<Vec<TerminalSearchHit>>,
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

/// App state for Tauri commands. Holds live pane handles and the currently
/// focused pane. Deliberately holds NO libghostty type (Terminal/Encoder are
/// `!Send` and live in each terminal thread); only `Send` channel senders cross
/// the boundary.
struct PtyState {
    panes: Mutex<BTreeMap<u64, Pane>>,
    active_pane_id: Mutex<Option<u64>>,
    watcher: Mutex<Option<WorkspaceWatcher>>,
    next_pane_id: Mutex<u64>,
}

impl PtyState {
    /// Forward a message to the focused pane, if one is open.
    fn send(&self, msg: Msg) {
        let active_id = self.active_pane_id.lock().ok().and_then(|guard| *guard);
        if let Some(active_id) = active_id {
            if let Ok(guard) = self.panes.lock() {
                if let Some(pane) = guard.get(&active_id) {
                    let _ = pane.tx.send(msg);
                }
            }
        }
    }

    fn broadcast(&self, msg: Msg) {
        if let Ok(guard) = self.panes.lock() {
            for pane in guard.values() {
                let _ = pane.tx.send(msg.clone());
            }
        }
    }

    fn insert_and_focus(&self, pane_id: u64, pane: Pane) {
        if let Ok(mut guard) = self.panes.lock() {
            guard.insert(pane_id, pane);
        }
        let _ = self.focus(pane_id);
    }

    fn close(&self, pane_id: u64) -> Result<Option<u64>, String> {
        let (removed, next_active) = {
            let mut panes = self
                .panes
                .lock()
                .map_err(|_| "Could not close terminal pane.".to_string())?;
            let removed = panes.remove(&pane_id);
            let next_active = panes.keys().next().copied();
            (removed, next_active)
        };
        let Some(mut pane) = removed else {
            return Err(format!("Terminal pane {pane_id} is no longer available."));
        };
        let _ = pane.killer.kill();
        let mut active = self
            .active_pane_id
            .lock()
            .map_err(|_| "Could not update focused terminal pane.".to_string())?;
        if *active == Some(pane_id) {
            *active = next_active;
        }
        Ok(*active)
    }

    fn terminate(&self, pane_id: u64) -> Result<(), String> {
        let mut panes = self
            .panes
            .lock()
            .map_err(|_| "Could not terminate terminal pane.".to_string())?;
        let Some(pane) = panes.get_mut(&pane_id) else {
            return Err(format!("Terminal pane {pane_id} is no longer available."));
        };
        pane.killer
            .kill()
            .map_err(|err| format!("Could not terminate terminal pane {pane_id}: {err}"))
    }

    fn replace_and_focus(
        &self,
        old_pane_id: u64,
        new_pane_id: u64,
        mut new_pane: Pane,
    ) -> Result<(), String> {
        let removed = {
            let mut panes = self
                .panes
                .lock()
                .map_err(|_| "Could not restart terminal pane.".to_string())?;
            if !panes.contains_key(&old_pane_id) {
                let _ = new_pane.killer.kill();
                return Err(format!(
                    "Terminal pane {old_pane_id} is no longer available."
                ));
            }
            panes.insert(new_pane_id, new_pane);
            panes.remove(&old_pane_id)
        };
        if let Some(mut pane) = removed {
            let _ = pane.killer.kill();
        }
        let mut active = self
            .active_pane_id
            .lock()
            .map_err(|_| "Could not focus restarted terminal pane.".to_string())?;
        *active = Some(new_pane_id);
        Ok(())
    }

    fn focus(&self, pane_id: u64) -> Result<(), String> {
        let exists = self
            .panes
            .lock()
            .map_err(|_| "Could not read terminal panes.".to_string())?
            .contains_key(&pane_id);
        if !exists {
            return Err(format!("Terminal pane {pane_id} is no longer available."));
        }
        let mut active = self
            .active_pane_id
            .lock()
            .map_err(|_| "Could not focus terminal pane.".to_string())?;
        *active = Some(pane_id);
        Ok(())
    }

    fn allocate_pane_id(&self) -> u64 {
        let Ok(mut guard) = self.next_pane_id.lock() else {
            return 1;
        };
        *guard += 1;
        *guard
    }
}

#[derive(Serialize, Clone)]
struct Cell {
    t: String,  // grapheme(s) in the cell; " " when empty
    f: [u8; 3], // resolved foreground rgb
    b: [u8; 3], // resolved background rgb
    bold: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct TerminalSearchHit {
    /// Absolute screen row (scrollback + active), 0 = oldest retained row.
    row: u32,
    col: u16,
    text: String,
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
struct GridPayload {
    pane_id: u64,
    snapshot: Snapshot,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PaneExit {
    pane_id: u64,
    command: String,
    code: u32,
    message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OpenWorkspaceResponse {
    root: String,
    pane_id: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OpenPaneResponse {
    pane_id: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ClosePaneResponse {
    active_pane_id: Option<u64>,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextFileResponse {
    path: String,
    content: String,
    bytes: u64,
    modified_ms: Option<u64>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WorkspaceTextSearchMatch {
    path: String,
    relative_path: String,
    line: usize,
    column: usize,
    line_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileOpResponse {
    path: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GitStatusFile {
    path: String,
    index: String,
    worktree: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GitStatusResponse {
    is_repository: bool,
    branch: Option<String>,
    ahead: u32,
    behind: u32,
    staged: usize,
    unstaged: usize,
    untracked: usize,
    files: Vec<GitStatusFile>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct GitDiffResponse {
    path: String,
    diff: String,
    source: String,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum GitFileAction {
    Stage,
    Unstage,
    Discard,
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

/// Read one full-screen-space row (scrollback + active area) as plain text.
fn screen_row_text(term: &Terminal, y: u32, cols: u16) -> String {
    let mut text = String::new();
    let mut buf = [' '; 8];
    for x in 0..cols {
        let point = Point::Screen(PointCoordinate { x, y });
        let mut pushed = false;
        if let Ok(gr) = term.grid_ref(point) {
            if let Ok(n) = gr.graphemes(&mut buf) {
                for ch in buf.iter().take(n) {
                    text.push(*ch);
                    pushed = true;
                }
            }
        }
        if !pushed {
            text.push(' ');
        }
    }
    text
}

const TERMINAL_SEARCH_MAX_HITS: usize = 200;

/// Case-insensitive substring search across scrollback + active screen rows.
fn search_terminal_rows(term: &Terminal, query: &str) -> Vec<TerminalSearchHit> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Vec::new();
    }
    let cols = term.cols().unwrap_or(INIT_COLS);
    let rows = term.rows().unwrap_or(INIT_ROWS) as u32;
    let total = term.scrollback_rows().unwrap_or(0) as u32 + rows;
    let mut hits = Vec::new();
    for y in 0..total {
        let text = screen_row_text(term, y, cols);
        if let Some(byte_col) = text.to_lowercase().find(&needle) {
            let col = text[..byte_col].chars().count().min(u16::MAX as usize) as u16;
            hits.push(TerminalSearchHit {
                row: y,
                col,
                text: text.trim_end().to_string(),
            });
            if hits.len() >= TERMINAL_SEARCH_MAX_HITS {
                break;
            }
        }
    }
    hits
}

fn emit_grid(app: &AppHandle, pane_id: u64, term: &Terminal) {
    let _ = app.emit(
        "grid",
        GridPayload {
            pane_id,
            snapshot: snapshot(term),
        },
    );
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
    state.broadcast(Msg::Resize {
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

fn app_state_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create app data dir: {e}"))?;
    Ok(dir.join(name))
}

const HEALTH_LOG_CAP_BYTES: u64 = 128 * 1024;

/// Marks a running session. Present at startup ⇒ the previous session did not
/// close cleanly (the clean-close path removes it). Returns whether a stale
/// marker was found so the frontend can offer recovery.
#[tauri::command]
fn begin_session(app: AppHandle) -> Result<bool, String> {
    let lock = app_state_file(&app, ".session-lock")?;
    let crashed = lock.exists();
    std::fs::write(&lock, "running").map_err(|e| format!("Could not write session lock: {e}"))?;
    Ok(crashed)
}

#[tauri::command]
fn end_session_clean(app: AppHandle) -> Result<(), String> {
    let lock = app_state_file(&app, ".session-lock")?;
    if lock.exists() {
        std::fs::remove_file(&lock).map_err(|e| format!("Could not clear session lock: {e}"))?;
    }
    Ok(())
}

/// Append one line to a size-capped local health log. Local-only; no telemetry.
#[tauri::command]
fn log_health_event(app: AppHandle, message: String) -> Result<(), String> {
    let path = app_state_file(&app, "health.log")?;
    if std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0) > HEALTH_LOG_CAP_BYTES {
        let _ = std::fs::remove_file(&path);
    }
    let line = format!("{}\n", message.replace('\n', " "));
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Could not open health log: {e}"))?;
    file.write_all(line.as_bytes())
        .map_err(|e| format!("Could not write health log: {e}"))
}

/// Delete the app's auxiliary local-state files. The Tauri Store (workspace.json)
/// is cleared by the frontend before calling this; here we remove the files the
/// store does not own. Confirmation is the frontend's responsibility.
fn reset_local_state_in(dir: &Path) -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    for name in [".session-lock", "health.log", ".window-state.json"] {
        let path = dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("Could not remove {name}: {e}"))?;
            removed.push(name.to_string());
        }
    }
    Ok(removed)
}

#[tauri::command]
fn reset_local_state(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {e}"))?;
    reset_local_state_in(&dir)
}

#[tauri::command]
fn scroll_terminal_to_row(state: State<PtyState>, row: u32) {
    state.send(Msg::ScrollToRow { row });
}

#[tauri::command]
fn search_terminal_scrollback(
    state: State<PtyState>,
    query: String,
) -> Result<Vec<TerminalSearchHit>, String> {
    let (reply, receive) = channel();
    state.send(Msg::SearchScrollback { query, reply });
    receive
        .recv_timeout(std::time::Duration::from_millis(1500))
        .map_err(|_| "Terminal search timed out. Is a pane focused and running?".to_string())
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

#[tauri::command]
fn search_workspace_text(
    root: String,
    query: String,
    max_matches: Option<usize>,
) -> Result<Vec<WorkspaceTextSearchMatch>, String> {
    let root = validate_workspace_path(&root)?;
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let limit = max_matches.unwrap_or(80).clamp(1, MAX_SEARCH_MATCHES);
    if let Some(matches) = ripgrep_workspace_text_search(&root, query, limit)? {
        return Ok(matches);
    }
    walk_workspace_text_search(&root, query, limit)
}

fn ripgrep_workspace_text_search(
    root: &str,
    query: &str,
    limit: usize,
) -> Result<Option<Vec<WorkspaceTextSearchMatch>>, String> {
    let output = match Command::new("rg")
        .args([
            "--json",
            "--fixed-strings",
            "--ignore-case",
            "--line-number",
            "--column",
            "--max-filesize",
            "512K",
            "--glob",
            "!**/node_modules/**",
            "--glob",
            "!**/target/**",
            "--glob",
            "!**/dist/**",
            "--glob",
            "!**/build/**",
            "--glob",
            "!**/coverage/**",
            "--glob",
            "!**/.next/**",
            "--glob",
            "!**/.turbo/**",
            "--glob",
            "!**/.vite/**",
            query,
            root,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(output) => output,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(format!("Could not run workspace text search: {err}")),
    };

    if !output.status.success() && output.status.code() != Some(1) {
        return Err(format!(
            "Could not search workspace text: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let root_path = Path::new(root);
    let mut matches = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if matches.len() >= limit {
            break;
        }
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if value.get("type").and_then(|kind| kind.as_str()) != Some("match") {
            continue;
        }
        let Some(data) = value.get("data") else {
            continue;
        };
        let Some(path_text) = data
            .get("path")
            .and_then(|path| path.get("text"))
            .and_then(|text| text.as_str())
        else {
            continue;
        };
        let line_number = data
            .get("line_number")
            .and_then(|line| line.as_u64())
            .unwrap_or(1) as usize;
        let line_text = data
            .get("lines")
            .and_then(|lines| lines.get("text"))
            .and_then(|text| text.as_str())
            .unwrap_or("")
            .trim_end_matches(['\r', '\n'])
            .trim()
            .chars()
            .take(240)
            .collect::<String>();
        let column = data
            .get("submatches")
            .and_then(|submatches| submatches.as_array())
            .and_then(|submatches| submatches.first())
            .and_then(|submatch| submatch.get("start"))
            .and_then(|start| start.as_u64())
            .map(|start| start as usize + 1)
            .unwrap_or(1);
        let path = PathBuf::from(path_text);
        let relative_path = path
            .strip_prefix(root_path)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        matches.push(WorkspaceTextSearchMatch {
            path: path.to_string_lossy().into_owned(),
            relative_path,
            line: line_number,
            column,
            line_text,
        });
    }

    Ok(Some(matches))
}

fn walk_workspace_text_search(
    root: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<WorkspaceTextSearchMatch>, String> {
    let root_path = Path::new(root);
    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();

    let walker = WalkBuilder::new(root)
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
        let entry = entry.map_err(|err| format!("Could not search workspace text: {err}"))?;
        if matches.len() >= limit {
            break;
        }
        let path = entry.path();
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
        {
            continue;
        }
        let Ok(metadata) = fs::metadata(path) else {
            continue;
        };
        if metadata.len() > MAX_SEARCH_FILE_BYTES {
            continue;
        }
        let Ok(raw) = fs::read(path) else {
            continue;
        };
        let Ok(content) = String::from_utf8(raw) else {
            continue;
        };
        let relative_path = path
            .strip_prefix(root_path)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        for (line_index, line) in content.lines().enumerate() {
            if matches.len() >= limit {
                break;
            }
            let line_lower = line.to_lowercase();
            let Some(byte_index) = line_lower.find(&query_lower) else {
                continue;
            };
            matches.push(WorkspaceTextSearchMatch {
                path: path.to_string_lossy().into_owned(),
                relative_path: relative_path.clone(),
                line: line_index + 1,
                column: line
                    .char_indices()
                    .take_while(|(index, _)| *index < byte_index)
                    .count()
                    + 1,
                line_text: line.trim().chars().take(240).collect(),
            });
        }
    }

    Ok(matches)
}

/// Frontend -> filesystem: read a UTF-8 text file inside the selected workspace.
#[tauri::command]
fn read_text_file(root: String, path: String) -> Result<TextFileResponse, String> {
    let file_path = validate_workspace_file_path(&root, &path)?;
    let metadata = fs::metadata(&file_path)
        .map_err(|err| format!("Could not inspect file {}: {err}", file_path.display()))?;
    let bytes = metadata.len();
    if bytes > MAX_TEXT_FILE_BYTES {
        return Err(format!(
            "File is too large for the editor slice: {} bytes, limit is {} bytes.",
            bytes, MAX_TEXT_FILE_BYTES
        ));
    }
    let raw = fs::read(&file_path)
        .map_err(|err| format!("Could not read file {}: {err}", file_path.display()))?;
    let content = String::from_utf8(raw)
        .map_err(|_| format!("File is not valid UTF-8 text: {}", file_path.display()))?;
    Ok(TextFileResponse {
        path: file_path.to_string_lossy().into_owned(),
        content,
        bytes,
        modified_ms: modified_ms(&metadata),
    })
}

/// Frontend -> filesystem: overwrite an existing UTF-8 text file inside the
/// selected workspace. Creation/rename/delete live in later file-ops slices.
#[tauri::command]
fn write_text_file(
    root: String,
    path: String,
    content: String,
    expected_modified_ms: Option<u64>,
) -> Result<TextFileResponse, String> {
    let file_path = validate_workspace_file_path(&root, &path)?;
    let before_metadata = fs::metadata(&file_path)
        .map_err(|err| format!("Could not inspect file {}: {err}", file_path.display()))?;
    let current_modified_ms = modified_ms(&before_metadata);
    if expected_modified_ms.is_some() && expected_modified_ms != current_modified_ms {
        return Err(format!(
            "File changed on disk since it was opened: {}. Reload the file or copy your draft before overwriting.",
            file_path.display()
        ));
    }
    let bytes = content.len() as u64;
    if bytes > MAX_TEXT_FILE_BYTES {
        return Err(format!(
            "File is too large for the editor slice: {} bytes, limit is {} bytes.",
            bytes, MAX_TEXT_FILE_BYTES
        ));
    }
    fs::write(&file_path, content.as_bytes())
        .map_err(|err| format!("Could not save file {}: {err}", file_path.display()))?;
    let metadata = fs::metadata(&file_path).map_err(|err| {
        format!(
            "Could not inspect saved file {}: {err}",
            file_path.display()
        )
    })?;
    Ok(TextFileResponse {
        path: file_path.to_string_lossy().into_owned(),
        content,
        bytes,
        modified_ms: modified_ms(&metadata),
    })
}

#[tauri::command]
fn create_workspace_file(
    root: String,
    parent: String,
    name: String,
) -> Result<FileOpResponse, String> {
    let path = validate_new_child_path(&root, &parent, &name)?;
    fs::write(&path, "")
        .map_err(|err| format!("Could not create file {}: {err}", path.display()))?;
    Ok(FileOpResponse {
        path: path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn create_workspace_folder(
    root: String,
    parent: String,
    name: String,
) -> Result<FileOpResponse, String> {
    let path = validate_new_child_path(&root, &parent, &name)?;
    fs::create_dir(&path)
        .map_err(|err| format!("Could not create folder {}: {err}", path.display()))?;
    Ok(FileOpResponse {
        path: path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn rename_workspace_path(
    root: String,
    path: String,
    name: String,
) -> Result<FileOpResponse, String> {
    let path = validate_workspace_existing_path(&root, &path)?;
    let target = sibling_with_name(&path, &name)?;
    fs::rename(&path, &target).map_err(|err| {
        format!(
            "Could not rename {} to {}: {err}",
            path.display(),
            target.display()
        )
    })?;
    Ok(FileOpResponse {
        path: target.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn delete_workspace_path(root: String, path: String) -> Result<(), String> {
    let path = validate_workspace_existing_path(&root, &path)?;
    if path.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|err| format!("Could not delete folder {}: {err}", path.display()))?;
    } else {
        fs::remove_file(&path)
            .map_err(|err| format!("Could not delete file {}: {err}", path.display()))?;
    }
    Ok(())
}

#[tauri::command]
fn duplicate_workspace_path(root: String, path: String) -> Result<FileOpResponse, String> {
    let path = validate_workspace_existing_path(&root, &path)?;
    let target = duplicate_target(&path)?;
    if path.is_dir() {
        copy_dir_recursive(&path, &target)?;
    } else {
        fs::copy(&path, &target).map_err(|err| {
            format!(
                "Could not duplicate file {} to {}: {err}",
                path.display(),
                target.display()
            )
        })?;
    }
    Ok(FileOpResponse {
        path: target.to_string_lossy().into_owned(),
    })
}

fn parse_git_status_output(output: &str) -> GitStatusResponse {
    let mut branch = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut files = Vec::new();

    for line in output.lines() {
        if let Some(header) = line.strip_prefix("## ") {
            let (branch_part, meta) = header.split_once('[').unwrap_or((header, ""));
            branch = Some(
                branch_part
                    .split("...")
                    .next()
                    .unwrap_or(branch_part)
                    .trim()
                    .to_string(),
            )
            .filter(|value| !value.is_empty());
            if let Some(meta) = meta.strip_suffix(']') {
                for part in meta.split(',') {
                    let part = part.trim();
                    if let Some(value) = part.strip_prefix("ahead ") {
                        ahead = value.parse().unwrap_or(0);
                    } else if let Some(value) = part.strip_prefix("behind ") {
                        behind = value.parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }
        if line.len() < 4 {
            continue;
        }
        let index = line.chars().next().unwrap_or(' ').to_string();
        let worktree = line.chars().nth(1).unwrap_or(' ').to_string();
        let raw_path = line[3..].trim();
        let path = raw_path
            .rsplit_once(" -> ")
            .map(|(_, target)| target)
            .unwrap_or(raw_path)
            .to_string();
        files.push(GitStatusFile {
            path,
            index,
            worktree,
        });
    }

    let staged = files
        .iter()
        .filter(|file| file.index != " " && file.index != "?")
        .count();
    let unstaged = files
        .iter()
        .filter(|file| file.worktree != " " && file.worktree != "?")
        .count();
    let untracked = files.iter().filter(|file| file.index == "?").count();

    GitStatusResponse {
        is_repository: true,
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        files,
    }
}

/// Read-only lookup of the `origin` remote URL for the Settings source-control
/// panel's repo/PR/issue link buttons. Returns None when there's no `origin`
/// remote rather than erroring, since that's the common non-repo case.
#[tauri::command]
fn git_remote_url(root: String) -> Result<Option<String>, String> {
    let root = validate_workspace_path(&root)?;
    let output = Command::new("git")
        .args(["-C", &root, "remote", "get-url", "origin"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Could not run git remote get-url: {err}"))?;
    if !output.status.success() {
        return Ok(None);
    }
    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if url.is_empty() { None } else { Some(url) })
}

#[tauri::command]
fn git_status(root: String) -> Result<GitStatusResponse, String> {
    let root = validate_workspace_path(&root)?;
    let output = Command::new("git")
        .args(["-C", &root, "status", "--short", "--branch"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Could not run git status: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResponse {
                is_repository: false,
                branch: None,
                ahead: 0,
                behind: 0,
                staged: 0,
                unstaged: 0,
                untracked: 0,
                files: Vec::new(),
            });
        }
        return Err(format!("Could not read git status: {}", stderr.trim()));
    }

    let mut response = parse_git_status_output(&String::from_utf8_lossy(&output.stdout));
    if response
        .branch
        .as_deref()
        .is_some_and(|branch| branch.starts_with("HEAD"))
    {
        let head = Command::new("git")
            .args(["-C", &root, "rev-parse", "--short", "HEAD"])
            .output()
            .ok()
            .filter(|result| result.status.success())
            .map(|result| String::from_utf8_lossy(&result.stdout).trim().to_string())
            .filter(|sha| !sha.is_empty());
        response.branch = Some(head.map_or_else(|| "Detached".into(), |sha| format!("@ {sha}")));
    }

    Ok(response)
}

fn validate_git_relative_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Git path is required.".into());
    }
    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("Git path must be relative to the workspace.".into());
    }
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            _ => return Err("Git path must stay inside the workspace.".into()),
        }
    }
    if parts.is_empty() {
        return Err("Git path is required.".into());
    }
    Ok(parts.join("/"))
}

fn run_git_diff(root: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C", root])
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Could not run git diff: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "Could not read git diff: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn run_git_checked(root: &str, args: &[&str], label: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["-C", root])
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Could not {label}: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "Could not {label}: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

fn git_status_for_path(root: &str, relative_path: &str) -> Result<Option<GitStatusFile>, String> {
    let output = Command::new("git")
        .args([
            "-C",
            root,
            "status",
            "--short",
            "--branch",
            "--",
            relative_path,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Could not run git status: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "Could not read git status: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(
        parse_git_status_output(&String::from_utf8_lossy(&output.stdout))
            .files
            .into_iter()
            .find(|file| file.path == relative_path),
    )
}

fn synthetic_untracked_diff(
    root: &str,
    relative_path: &str,
) -> Result<Option<GitDiffResponse>, String> {
    let file_path = PathBuf::from(root).join(relative_path);
    if !file_path.exists() || !file_path.is_file() {
        return Ok(None);
    }
    let metadata = fs::metadata(&file_path)
        .map_err(|err| format!("Could not inspect file {}: {err}", file_path.display()))?;
    let bytes = metadata.len();
    if bytes > MAX_TEXT_FILE_BYTES {
        return Err(format!(
            "File is too large for diff preview: {} bytes, limit is {} bytes.",
            bytes, MAX_TEXT_FILE_BYTES
        ));
    }
    let raw = fs::read(&file_path)
        .map_err(|err| format!("Could not read file {}: {err}", file_path.display()))?;
    let content = String::from_utf8(raw)
        .map_err(|_| format!("File is not valid UTF-8 text: {}", file_path.display()))?;
    let line_count = content.lines().count();
    let mut diff = format!(
        "diff --git a/{0} b/{0}\nnew file mode 100644\n--- /dev/null\n+++ b/{0}\n@@ -0,0 +1,{1} @@\n",
        relative_path,
        line_count
    );
    for line in content.lines() {
        diff.push('+');
        diff.push_str(line);
        diff.push('\n');
    }
    Ok(Some(GitDiffResponse {
        path: relative_path.into(),
        diff,
        source: "untracked".into(),
    }))
}

#[tauri::command]
fn git_file_diff(root: String, path: String) -> Result<GitDiffResponse, String> {
    let root = validate_workspace_path(&root)?;
    let relative_path = validate_git_relative_path(&path)?;
    let unstaged = run_git_diff(&root, &["diff", "--no-ext-diff", "--", &relative_path])?;
    if !unstaged.trim().is_empty() {
        return Ok(GitDiffResponse {
            path: relative_path,
            diff: unstaged,
            source: "working-tree".into(),
        });
    }
    let staged = run_git_diff(
        &root,
        &["diff", "--cached", "--no-ext-diff", "--", &relative_path],
    )?;
    if !staged.trim().is_empty() {
        return Ok(GitDiffResponse {
            path: relative_path,
            diff: staged,
            source: "staged".into(),
        });
    }
    if let Some(diff) = synthetic_untracked_diff(&root, &relative_path)? {
        return Ok(diff);
    }
    Ok(GitDiffResponse {
        path: relative_path,
        diff: String::new(),
        source: "clean".into(),
    })
}

#[tauri::command]
fn git_file_action(
    root: String,
    path: String,
    action: GitFileAction,
) -> Result<GitStatusResponse, String> {
    let root = validate_workspace_path(&root)?;
    let relative_path = validate_git_relative_path(&path)?;
    let status = git_status_for_path(&root, &relative_path)?;
    match action {
        GitFileAction::Stage => {
            run_git_checked(&root, &["add", "--", &relative_path], "stage file")?;
        }
        GitFileAction::Unstage => {
            let Some(status) = status.as_ref() else {
                return Err("File has no staged changes to unstage.".into());
            };
            if status.index == " " || status.index == "?" {
                return Err("File has no staged changes to unstage.".into());
            }
            if status.index == "A" {
                run_git_checked(
                    &root,
                    &["rm", "--cached", "--", &relative_path],
                    "unstage file",
                )?;
            } else {
                run_git_checked(
                    &root,
                    &["restore", "--staged", "--", &relative_path],
                    "unstage file",
                )?;
            }
        }
        GitFileAction::Discard => {
            let Some(status) = status.as_ref() else {
                return Err("File has no unstaged changes to discard.".into());
            };
            if status.index == "?" {
                run_git_checked(
                    &root,
                    &["clean", "-f", "--", &relative_path],
                    "discard file",
                )?;
            } else if status.worktree != " " {
                run_git_checked(
                    &root,
                    &["restore", "--worktree", "--", &relative_path],
                    "discard file",
                )?;
            } else {
                return Err("File has no unstaged changes to discard.".into());
            }
        }
    }
    git_status(root)
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

/// Turn a free-text label into a filesystem/branch-safe slug. Empty or fully
/// non-alphanumeric input falls back to a short timestamp so callers always
/// get a usable, non-colliding name.
fn worktree_slug(label: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;
    for ch in label.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_was_dash = false;
        } else if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        slug = format!("session-{suffix}");
    }
    slug
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorktreeResponse {
    path: String,
    branch: String,
}

/// Create a disposable `git worktree` under `<root>/.worktrees/<slug>` on a new
/// branch, for running a second agent on the same repo without cwd conflicts.
#[tauri::command]
fn create_project_worktree(root: String, label: String) -> Result<WorktreeResponse, String> {
    let root = validate_workspace_path(&root)?;
    let slug = worktree_slug(&label);
    let branch = format!("worktree/{slug}");
    let worktree_dir = Path::new(&root).join(".worktrees").join(&slug);
    if worktree_dir.exists() {
        return Err(format!(
            "A worktree already exists at .worktrees/{slug}. Choose a different name."
        ));
    }
    std::fs::create_dir_all(Path::new(&root).join(".worktrees"))
        .map_err(|err| format!("Could not create .worktrees directory: {err}"))?;
    let worktree_path = worktree_dir.to_string_lossy().into_owned();
    run_git_checked(
        &root,
        &["worktree", "add", "-b", &branch, &worktree_path],
        "create the worktree",
    )?;
    let canonical = worktree_dir
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or(worktree_path);
    Ok(WorktreeResponse {
        path: canonical,
        branch,
    })
}

/// Remove a worktree and its branch. `worktree_path` must be an existing git
/// worktree of `root`; the branch is only deleted after the worktree itself
/// is gone, so a failed removal never leaves an orphaned branch.
#[tauri::command]
fn remove_project_worktree(
    root: String,
    worktree_path: String,
    branch: String,
) -> Result<(), String> {
    let root = validate_workspace_path(&root)?;
    run_git_checked(
        &root,
        &["worktree", "remove", "--force", &worktree_path],
        "remove the worktree",
    )?;
    run_git_checked(
        &root,
        &["branch", "-D", &branch],
        "delete the worktree branch",
    )?;
    Ok(())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CliToolStatus {
    installed: bool,
    authenticated: Option<bool>,
    account: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SourceControlStatusResponse {
    git: CliToolStatus,
    gh: CliToolStatus,
    glab: CliToolStatus,
}

/// Best-effort account-name extraction from a CLI auth-status line. Only ever
/// reads a bare username token; never touches a "Token:" line, so a masked or
/// unmasked credential can never end up in the returned string.
fn extract_account_name(output: &str) -> Option<String> {
    for line in output.lines() {
        if line.contains("Token") {
            continue;
        }
        for marker in [" account ", " as "] {
            if let Some(idx) = line.find(marker) {
                let rest = &line[idx + marker.len()..];
                let name: String = rest
                    .trim_start()
                    .chars()
                    .take_while(|ch| ch.is_alphanumeric() || *ch == '-' || *ch == '_' || *ch == '.')
                    .collect();
                if !name.is_empty() {
                    return Some(name);
                }
            }
        }
    }
    None
}

/// Detect a hosting CLI's presence and auth health without ever reading or
/// forwarding token material. `auth_args` is omitted for `git`, which has no
/// login concept of its own (credentials live in its credential helper).
fn cli_tool_status(binary: &str, auth_args: Option<&[&str]>) -> CliToolStatus {
    let version_ok = Command::new(binary)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);
    if !version_ok {
        return CliToolStatus {
            installed: false,
            authenticated: None,
            account: None,
        };
    }
    let Some(args) = auth_args else {
        return CliToolStatus {
            installed: true,
            authenticated: None,
            account: None,
        };
    };
    match Command::new(binary)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(out) => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            CliToolStatus {
                installed: true,
                authenticated: Some(out.status.success()),
                account: if out.status.success() {
                    extract_account_name(&combined)
                } else {
                    None
                },
            }
        }
        Err(_) => CliToolStatus {
            installed: true,
            authenticated: None,
            account: None,
        },
    }
}

/// Detect git/gh/glab presence and auth health for the Settings source-control
/// panel. Read-only: never stores, logs, or returns credential material.
#[tauri::command]
fn source_control_status() -> SourceControlStatusResponse {
    SourceControlStatusResponse {
        git: cli_tool_status("git", None),
        gh: cli_tool_status("gh", Some(&["auth", "status"])),
        glab: cli_tool_status("glab", Some(&["auth", "status"])),
    }
}

/// Open a workspace folder by spawning a pane in `path` using the selected launch
/// profile. Existing panes stay alive so other projects can keep running.
#[tauri::command]
fn open_workspace(
    app: AppHandle,
    state: State<PtyState>,
    path: String,
    profile: Option<LaunchProfile>,
) -> Result<OpenWorkspaceResponse, String> {
    let cwd = validate_workspace_path(&path)?;
    let profile = profile.unwrap_or_default().normalized();
    preflight_profile(&profile, &cwd)?;
    let pane_id = state.allocate_pane_id();
    let new = spawn_pane(app, cwd.clone(), profile, pane_id)?;
    state.insert_and_focus(pane_id, new);
    Ok(OpenWorkspaceResponse { root: cwd, pane_id })
}

/// Spawn an additional pane in an existing workspace and focus it without
/// tearing down already-running panes.
#[tauri::command]
fn create_pane(
    app: AppHandle,
    state: State<PtyState>,
    path: String,
    profile: Option<LaunchProfile>,
) -> Result<OpenPaneResponse, String> {
    let cwd = validate_workspace_path(&path)?;
    let profile = profile.unwrap_or_default().normalized();
    preflight_profile(&profile, &cwd)?;
    let pane_id = state.allocate_pane_id();
    let new = spawn_pane(app, cwd, profile, pane_id)?;
    state.insert_and_focus(pane_id, new);
    Ok(OpenPaneResponse { pane_id })
}

/// Focus an already-running pane. Input commands are always routed to this pane.
#[tauri::command]
fn focus_pane(state: State<PtyState>, pane_id: u64) -> Result<(), String> {
    state.focus(pane_id)
}

/// Close one pane by killing its child process and removing its input route.
#[tauri::command]
fn close_pane(state: State<PtyState>, pane_id: u64) -> Result<ClosePaneResponse, String> {
    Ok(ClosePaneResponse {
        active_pane_id: state.close(pane_id)?,
    })
}

/// Kill a pane's child process but keep the pane record/transcript for exit state.
#[tauri::command]
fn terminate_pane(state: State<PtyState>, pane_id: u64) -> Result<(), String> {
    state.terminate(pane_id)
}

/// Replace one pane with a fresh process using the supplied profile and cwd.
#[tauri::command]
fn restart_pane(
    app: AppHandle,
    state: State<PtyState>,
    path: String,
    pane_id: u64,
    profile: Option<LaunchProfile>,
) -> Result<OpenPaneResponse, String> {
    let cwd = validate_workspace_path(&path)?;
    let profile = profile.unwrap_or_default().normalized();
    preflight_profile(&profile, &cwd)?;
    let new_pane_id = state.allocate_pane_id();
    let new_pane = spawn_pane(app, cwd, profile, new_pane_id)?;
    state.replace_and_focus(pane_id, new_pane_id, new_pane)?;
    Ok(OpenPaneResponse {
        pane_id: new_pane_id,
    })
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

fn validate_workspace_file_path(root: &str, path: &str) -> Result<PathBuf, String> {
    let root = validate_workspace_path(root)?;
    let root_path = PathBuf::from(&root);
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No file was selected.".into());
    }
    let candidate = Path::new(trimmed);
    if !candidate.exists() {
        return Err(format!("File does not exist: {trimmed}"));
    }
    if !candidate.is_file() {
        return Err(format!("Selected path is not a file: {trimmed}"));
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|err| format!("Cannot open file {trimmed}: {err}"))?;
    if !canonical.starts_with(&root_path) {
        return Err(format!("File is outside the selected workspace: {trimmed}"));
    }
    Ok(canonical)
}

fn validate_workspace_existing_path(root: &str, path: &str) -> Result<PathBuf, String> {
    let root = validate_workspace_path(root)?;
    let root_path = PathBuf::from(&root);
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No path was selected.".into());
    }
    let candidate = Path::new(trimmed);
    if !candidate.exists() {
        return Err(format!("Path does not exist: {trimmed}"));
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|err| format!("Cannot inspect path {trimmed}: {err}"))?;
    if canonical == root_path {
        return Err("Cannot operate on the workspace root.".into());
    }
    if !canonical.starts_with(&root_path) {
        return Err(format!("Path is outside the selected workspace: {trimmed}"));
    }
    Ok(canonical)
}

fn validate_new_child_path(root: &str, parent: &str, name: &str) -> Result<PathBuf, String> {
    let root = validate_workspace_path(root)?;
    let root_path = PathBuf::from(&root);
    let parent_trimmed = parent.trim();
    if parent_trimmed.is_empty() {
        return Err("No parent folder was selected.".into());
    }
    let parent = Path::new(parent_trimmed);
    if !parent.exists() {
        return Err(format!("Parent folder does not exist: {parent_trimmed}"));
    }
    let parent = parent
        .canonicalize()
        .map_err(|err| format!("Cannot inspect parent folder {parent_trimmed}: {err}"))?;
    if !parent.starts_with(&root_path) {
        return Err(format!(
            "Parent folder is outside the selected workspace: {parent_trimmed}"
        ));
    }
    if !parent.is_dir() {
        return Err(format!("Parent path is not a folder: {}", parent.display()));
    }
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty.".into());
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err(format!("Name is not valid for a workspace item: {trimmed}"));
    }
    let path = parent.join(trimmed);
    if !path.starts_with(&root_path) {
        return Err(format!(
            "New path is outside the selected workspace: {trimmed}"
        ));
    }
    if path.exists() {
        return Err(format!("Path already exists: {}", path.display()));
    }
    Ok(path)
}

fn sibling_with_name(path: &Path, name: &str) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Cannot find parent folder for {}", path.display()))?;
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty.".into());
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err(format!("Name is not valid for a workspace item: {trimmed}"));
    }
    let target = parent.join(trimmed);
    if target.exists() {
        return Err(format!("Path already exists: {}", target.display()));
    }
    Ok(target)
}

fn duplicate_target(path: &Path) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Cannot find parent folder for {}", path.display()))?;
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("copy");
    let ext = path.extension().and_then(|value| value.to_str());
    for index in 1..1000 {
        let copy_name = if index == 1 {
            match ext {
                Some(ext) => format!("{stem} copy.{ext}"),
                None => format!("{stem} copy"),
            }
        } else {
            match ext {
                Some(ext) => format!("{stem} copy {index}.{ext}"),
                None => format!("{stem} copy {index}"),
            }
        };
        let target = parent.join(copy_name);
        if !target.exists() {
            return Ok(target);
        }
    }
    Err(format!(
        "Could not find an available duplicate name for {}",
        path.display()
    ))
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir(to).map_err(|err| format!("Could not create folder {}: {err}", to.display()))?;
    for entry in fs::read_dir(from)
        .map_err(|err| format!("Could not read folder {}: {err}", from.display()))?
    {
        let entry = entry.map_err(|err| format!("Could not read folder entry: {err}"))?;
        let source = entry.path();
        let target = to.join(entry.file_name());
        let kind = entry
            .file_type()
            .map_err(|err| format!("Could not inspect {}: {err}", source.display()))?;
        if kind.is_dir() {
            copy_dir_recursive(&source, &target)?;
        } else if kind.is_file() {
            fs::copy(&source, &target).map_err(|err| {
                format!(
                    "Could not duplicate file {} to {}: {err}",
                    source.display(),
                    target.display()
                )
            })?;
        }
    }
    Ok(())
}

fn modified_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
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
fn spawn_pane(
    app: AppHandle,
    cwd: String,
    profile: LaunchProfile,
    pane_id: u64,
) -> Result<Pane, String> {
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
                pane_id,
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
                            Ok(Msg::ScrollToRow { row }) => {
                                term.scroll_viewport(ScrollViewport::Top);
                                if row > 0 {
                                    term.scroll_viewport(ScrollViewport::Delta(row as isize));
                                }
                            }
                            Ok(Msg::SearchScrollback { query, reply }) => {
                                let _ = reply.send(search_terminal_rows(&term, &query));
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
                    emit_grid(&app, pane_id, &term);
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
                    emit_grid(&app, pane_id, &term);
                }
                Msg::Paste(t) => {
                    term.scroll_viewport(ScrollViewport::Bottom);
                    handle_paste(&term, &mut *writer, t);
                    emit_grid(&app, pane_id, &term);
                }
                Msg::Scroll { delta } => {
                    term.scroll_viewport(ScrollViewport::Delta(delta));
                    emit_grid(&app, pane_id, &term);
                }
                Msg::ScrollToRow { row } => {
                    term.scroll_viewport(ScrollViewport::Top);
                    if row > 0 {
                        term.scroll_viewport(ScrollViewport::Delta(row as isize));
                    }
                    emit_grid(&app, pane_id, &term);
                }
                Msg::SearchScrollback { query, reply } => {
                    let _ = reply.send(search_terminal_rows(&term, &query));
                }
                Msg::Resize { cols, rows } => {
                    do_resize(&master, &mut term, cols, rows);
                    emit_grid(&app, pane_id, &term);
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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .menu(|handle| {
            let menu = Menu::default(handle)?;
            let open =
                MenuItem::with_id(handle, MENU_OPEN, "Open Folder…", true, Some("CmdOrCtrl+O"))?;
            let save = MenuItem::with_id(handle, MENU_SAVE, "Save", true, Some("CmdOrCtrl+S"))?;
            let find = MenuItem::with_id(handle, MENU_FIND, "Find…", true, Some("CmdOrCtrl+F"))?;
            let close_tab = MenuItem::with_id(
                handle,
                MENU_CLOSE_EDITOR_TAB,
                "Close Editor Tab",
                true,
                Some("CmdOrCtrl+W"),
            )?;
            let clear = MenuItem::with_id(handle, MENU_CLEAR, "Clear", true, Some("CmdOrCtrl+K"))?;
            let file =
                Submenu::with_items(handle, "File", true, &[&open, &save, &find, &close_tab])?;
            let terminal = Submenu::with_items(handle, "Terminal", true, &[&clear])?;
            menu.append(&file)?;
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
            MENU_SAVE => {
                let _ = app.emit("menu-save-file", ());
            }
            MENU_FIND => {
                let _ = app.emit("menu-find-in-file", ());
            }
            MENU_CLOSE_EDITOR_TAB => {
                let _ = app.emit("menu-close-editor-tab", ());
            }
            _ => {}
        })
        .setup(|app| {
            // No pane yet — the frontend opens the last folder (or the picker) on
            // startup, which spawns the first pane via `open_workspace`.
            app.manage(PtyState {
                panes: Mutex::new(BTreeMap::new()),
                active_pane_id: Mutex::new(None),
                watcher: Mutex::new(None),
                next_pane_id: Mutex::new(0),
            });
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_key,
            paste,
            resize_pty,
            scroll_pty,
            scroll_terminal_to_row,
            search_terminal_scrollback,
            begin_session,
            end_session_clean,
            log_health_event,
            create_project_worktree,
            remove_project_worktree,
            source_control_status,
            reset_local_state,
            open_workspace,
            create_pane,
            focus_pane,
            close_pane,
            terminate_pane,
            restart_pane,
            list_workspace_tree,
            search_workspace_text,
            watch_workspace_tree,
            read_text_file,
            write_text_file,
            create_workspace_file,
            create_workspace_folder,
            rename_workspace_path,
            delete_workspace_path,
            duplicate_workspace_path,
            git_status,
            git_remote_url,
            git_file_diff,
            git_file_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Result as IoResult;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug)]
    struct TestKiller {
        kills: Arc<AtomicUsize>,
    }

    impl ChildKiller for TestKiller {
        fn kill(&mut self) -> IoResult<()> {
            self.kills.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        fn clone_killer(&self) -> Box<dyn ChildKiller + Send + Sync> {
            Box::new(Self {
                kills: Arc::clone(&self.kills),
            })
        }
    }

    fn test_pane(kills: Arc<AtomicUsize>) -> Pane {
        let (tx, _rx) = channel::<Msg>();
        Pane {
            tx,
            killer: Box::new(TestKiller { kills }),
        }
    }

    fn test_terminal(cols: u16, rows: u16) -> Terminal<'static, 'static> {
        Terminal::new(Options {
            cols,
            rows,
            max_scrollback: 100,
        })
        .expect("create terminal")
    }

    #[test]
    fn pty_state_focuses_and_closes_multiple_panes() {
        let kills = Arc::new(AtomicUsize::new(0));
        let state = PtyState {
            panes: Mutex::new(BTreeMap::new()),
            active_pane_id: Mutex::new(None),
            watcher: Mutex::new(None),
            next_pane_id: Mutex::new(0),
        };

        state.insert_and_focus(1, test_pane(Arc::clone(&kills)));
        state.insert_and_focus(2, test_pane(Arc::clone(&kills)));
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            Some(2)
        );

        state.focus(1).expect("focus first pane");
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            Some(1)
        );

        let next = state.close(1).expect("close first pane");
        assert_eq!(next, Some(2));
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            Some(2)
        );
        assert!(!state.panes.lock().expect("pane lock").contains_key(&1));
        assert_eq!(kills.load(Ordering::SeqCst), 1);

        let next = state.close(2).expect("close final pane");
        assert_eq!(next, None);
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            None
        );
        assert_eq!(kills.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn pty_state_replaces_and_focuses_restarted_pane() {
        let kills = Arc::new(AtomicUsize::new(0));
        let state = PtyState {
            panes: Mutex::new(BTreeMap::new()),
            active_pane_id: Mutex::new(None),
            watcher: Mutex::new(None),
            next_pane_id: Mutex::new(0),
        };

        state.insert_and_focus(1, test_pane(Arc::clone(&kills)));
        state
            .replace_and_focus(1, 2, test_pane(Arc::clone(&kills)))
            .expect("restart pane");

        let panes = state.panes.lock().expect("pane lock");
        assert!(!panes.contains_key(&1));
        assert!(panes.contains_key(&2));
        drop(panes);
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            Some(2)
        );
        assert_eq!(kills.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn pty_state_terminates_without_removing_pane() {
        let kills = Arc::new(AtomicUsize::new(0));
        let state = PtyState {
            panes: Mutex::new(BTreeMap::new()),
            active_pane_id: Mutex::new(None),
            watcher: Mutex::new(None),
            next_pane_id: Mutex::new(0),
        };

        state.insert_and_focus(1, test_pane(Arc::clone(&kills)));
        state.terminate(1).expect("terminate pane");

        assert!(state.panes.lock().expect("pane lock").contains_key(&1));
        assert_eq!(
            *state.active_pane_id.lock().expect("active pane lock"),
            Some(1)
        );
        assert_eq!(kills.load(Ordering::SeqCst), 1);
    }

    fn snapshot_line(snapshot: &Snapshot, row: usize) -> String {
        let cols = snapshot.cols as usize;
        snapshot.cells[row * cols..(row + 1) * cols]
            .iter()
            .map(|cell| cell.t.as_str())
            .collect::<String>()
    }

    fn encode_key(code: &str, shift: bool, alt: bool, ctrl: bool) -> Vec<u8> {
        let term = test_terminal(INIT_COLS, INIT_ROWS);
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

    fn temp_root(prefix: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("{prefix}-{suffix}"))
    }

    fn run_test_git(root: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .expect("run git");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn cmd_k_menu_clear_encodes_ctrl_l() {
        assert_eq!(encode_key("KeyL", false, false, true), vec![0x0c]);
    }

    #[test]
    fn reset_local_state_removes_only_known_aux_files() {
        let dir = std::env::temp_dir().join(format!("keelhouse-reset-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for name in [
            ".session-lock",
            "health.log",
            ".window-state.json",
            "workspace.json",
        ] {
            std::fs::write(dir.join(name), b"x").unwrap();
        }

        let removed = reset_local_state_in(&dir).unwrap();
        assert_eq!(removed.len(), 3);
        assert!(!dir.join(".session-lock").exists());
        assert!(!dir.join("health.log").exists());
        assert!(!dir.join(".window-state.json").exists());
        // workspace.json is owned by the Tauri Store; the frontend clears it,
        // so this command must leave it in place.
        assert!(dir.join("workspace.json").exists());

        // Idempotent: a second run finds nothing to remove.
        assert!(reset_local_state_in(&dir).unwrap().is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn terminal_search_finds_scrollback_and_active_rows_case_insensitive() {
        let mut term = test_terminal(20, 3);
        for i in 0..8 {
            term.vt_write(format!("line number {}\r\n", i).as_bytes());
        }
        term.vt_write(b"Needle HERE");

        let hits = search_terminal_rows(&term, "needle");
        assert_eq!(hits.len(), 1);
        assert!(hits[0].text.contains("Needle HERE"));
        assert_eq!(hits[0].col, 0);

        let scrollback_hits = search_terminal_rows(&term, "NUMBER 0");
        assert_eq!(scrollback_hits.len(), 1);
        assert_eq!(scrollback_hits[0].row, 0);

        let all = search_terminal_rows(&term, "line number");
        assert_eq!(all.len(), 8);
        assert!(search_terminal_rows(&term, "   ").is_empty());
        assert!(search_terminal_rows(&term, "absent").is_empty());
    }

    #[test]
    fn snapshot_resolves_ansi_truecolor_cells() {
        let mut term = test_terminal(10, 4);
        term.vt_write(b"\x1b[38;2;1;2;3;48;2;4;5;6mX");

        let snap = snapshot(&term);
        let cell = &snap.cells[0];
        assert_eq!(cell.t, "X");
        assert_eq!(cell.f, [1, 2, 3]);
        assert_eq!(cell.b, [4, 5, 6]);
    }

    #[test]
    fn snapshot_reads_alternate_screen_and_restores_main_screen() {
        let mut term = test_terminal(12, 4);
        term.vt_write(b"main\x1b[?1049hALT");

        let alt = snapshot(&term);
        assert!(snapshot_line(&alt, 0).contains("ALT"));

        term.vt_write(b"\x1b[?1049l");
        let main = snapshot(&term);
        assert!(snapshot_line(&main, 0).starts_with("main"));
    }

    #[test]
    fn terminal_resize_updates_snapshot_dimensions() {
        let mut term = test_terminal(10, 4);
        term.resize(132, 40, 0, 0).expect("resize terminal");

        let snap = snapshot(&term);
        assert_eq!(snap.cols, 132);
        assert_eq!(snap.rows, 40);
        assert_eq!(snap.cells.len(), 132 * 40);
    }

    #[test]
    fn fast_output_preserves_scrollback_and_live_tail() {
        let mut term = test_terminal(24, 5);
        for i in 0..300 {
            term.vt_write(format!("line {i:03}\r\n").as_bytes());
        }

        let snap = snapshot(&term);
        assert!(snap.sb > 0);
        let visible = (0..snap.rows as usize)
            .map(|row| snapshot_line(&snap, row))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(visible.contains("line 299"));
    }

    #[test]
    fn bracketed_paste_wraps_payload_when_terminal_mode_is_enabled() {
        let mut term = test_terminal(10, 4);
        term.vt_write(b"\x1b[?2004h");
        let mut out = Vec::new();

        handle_paste(&term, &mut out, "hello\n".into());

        assert!(out.starts_with(b"\x1b[200~"));
        assert!(out.ends_with(b"\x1b[201~"));
        assert!(out.windows(5).any(|window| window == b"hello"));
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
    fn text_file_roundtrip_stays_inside_workspace() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-test-{suffix}"));
        let file = root.join("note.txt");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&file, "before\n").expect("write file");

        let root_s = root.to_string_lossy().into_owned();
        let file_s = file.to_string_lossy().into_owned();
        let read = read_text_file(root_s.clone(), file_s.clone()).expect("read text file");
        assert_eq!(read.content, "before\n");

        let written = write_text_file(root_s, file_s, "after\n".into(), read.modified_ms)
            .expect("write text file");
        assert_eq!(written.content, "after\n");
        assert!(written.modified_ms.is_some());
        assert_eq!(
            fs::read_to_string(&file).expect("read saved file"),
            "after\n"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn text_file_write_rejects_stale_modified_time() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-conflict-test-{suffix}"));
        let file = root.join("note.txt");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&file, "external\n").expect("write file");

        let err = write_text_file(
            root.to_string_lossy().into_owned(),
            file.to_string_lossy().into_owned(),
            "draft\n".into(),
            Some(0),
        )
        .expect_err("stale write should fail");

        assert!(err.contains("File changed on disk since it was opened"));
        assert_eq!(
            fs::read_to_string(&file).expect("read original file"),
            "external\n"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn text_file_rejects_paths_outside_workspace() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-root-{suffix}"));
        let outside = std::env::temp_dir().join(format!("agent-cli-editor-outside-{suffix}.txt"));
        fs::create_dir_all(&root).expect("create root");
        fs::write(&outside, "outside").expect("write outside file");

        let err = read_text_file(
            root.to_string_lossy().into_owned(),
            outside.to_string_lossy().into_owned(),
        )
        .expect_err("outside file should fail");
        assert!(err.contains("outside the selected workspace"));

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(outside);
    }

    #[test]
    fn text_file_rejects_large_files_before_full_editor_load() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-large-root-{suffix}"));
        let file = root.join("large.txt");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&file, vec![b'a'; (MAX_TEXT_FILE_BYTES + 1) as usize]).expect("write large file");

        let err = read_text_file(
            root.to_string_lossy().into_owned(),
            file.to_string_lossy().into_owned(),
        )
        .expect_err("large file should fail");
        assert!(err.contains("File is too large for the editor slice"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn text_file_rejects_binary_utf8_invalid_files() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-binary-root-{suffix}"));
        let file = root.join("binary.bin");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&file, [0xff, 0xfe, 0xfd, 0x00]).expect("write binary file");

        let err = read_text_file(
            root.to_string_lossy().into_owned(),
            file.to_string_lossy().into_owned(),
        )
        .expect_err("binary file should fail");
        assert!(err.contains("File is not valid UTF-8 text"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn text_file_rejects_large_save_buffers() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-editor-large-save-root-{suffix}"));
        let file = root.join("note.txt");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&file, "before").expect("write file");

        let err = write_text_file(
            root.to_string_lossy().into_owned(),
            file.to_string_lossy().into_owned(),
            "a".repeat((MAX_TEXT_FILE_BYTES + 1) as usize),
            None,
        )
        .expect_err("large save should fail");
        assert!(err.contains("File is too large for the editor slice"));
        assert_eq!(fs::read_to_string(&file).expect("read file"), "before");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn workspace_file_ops_create_rename_duplicate_delete_inside_root() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-file-ops-root-{suffix}"));
        fs::create_dir_all(&root).expect("create root");
        let root_s = root.to_string_lossy().into_owned();

        let folder = create_workspace_folder(root_s.clone(), root_s.clone(), "src".into())
            .expect("create folder");
        assert!(Path::new(&folder.path).is_dir());

        let file = create_workspace_file(root_s.clone(), folder.path.clone(), "main.txt".into())
            .expect("create file");
        assert!(Path::new(&file.path).is_file());
        fs::write(&file.path, "hello").expect("seed file");

        let renamed =
            rename_workspace_path(root_s.clone(), file.path.clone(), "renamed.txt".into())
                .expect("rename file");
        assert!(!Path::new(&file.path).exists());
        assert_eq!(
            fs::read_to_string(&renamed.path).expect("read renamed"),
            "hello"
        );

        let duplicate =
            duplicate_workspace_path(root_s.clone(), renamed.path.clone()).expect("duplicate file");
        assert!(duplicate.path.ends_with("renamed copy.txt"));
        assert_eq!(
            fs::read_to_string(&duplicate.path).expect("read duplicate"),
            "hello"
        );

        delete_workspace_path(root_s.clone(), duplicate.path.clone()).expect("delete duplicate");
        assert!(!Path::new(&duplicate.path).exists());

        let folder_copy = duplicate_workspace_path(root_s.clone(), folder.path.clone())
            .expect("duplicate folder");
        assert!(Path::new(&folder_copy.path).join("renamed.txt").is_file());

        delete_workspace_path(root_s, folder.path).expect("delete folder");
        assert!(!root.join("src").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn workspace_file_ops_reject_bad_names_and_outside_paths() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("agent-cli-file-ops-guard-root-{suffix}"));
        let outside = std::env::temp_dir().join(format!("agent-cli-file-ops-outside-{suffix}.txt"));
        fs::create_dir_all(&root).expect("create root");
        fs::write(&outside, "outside").expect("write outside");
        let root_s = root.to_string_lossy().into_owned();

        let bad_name = create_workspace_file(root_s.clone(), root_s.clone(), "../bad.txt".into())
            .expect_err("bad name should fail");
        assert!(bad_name.contains("Name is not valid"));

        let outside_err =
            delete_workspace_path(root_s.clone(), outside.to_string_lossy().into_owned())
                .expect_err("outside delete should fail");
        assert!(outside_err.contains("outside the selected workspace"));
        assert!(outside.exists());

        let root_err =
            delete_workspace_path(root_s.clone(), root_s).expect_err("root delete should fail");
        assert!(root_err.contains("workspace root"));

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(outside);
    }

    #[test]
    fn parses_git_status_summary_and_files() {
        let parsed = parse_git_status_output(
            "## main...origin/main [ahead 1, behind 2]\n M src/app.ts\nM  README.md\n?? docs/new.md\nR  old.txt -> new.txt\n",
        );

        assert!(parsed.is_repository);
        assert_eq!(parsed.branch.as_deref(), Some("main"));
        assert_eq!(parsed.ahead, 1);
        assert_eq!(parsed.behind, 2);
        assert_eq!(parsed.staged, 2);
        assert_eq!(parsed.unstaged, 1);
        assert_eq!(parsed.untracked, 1);
        assert_eq!(
            parsed
                .files
                .iter()
                .map(|file| file.path.as_str())
                .collect::<Vec<_>>(),
            vec!["src/app.ts", "README.md", "docs/new.md", "new.txt"],
        );
    }

    #[test]
    fn git_status_labels_detached_head_with_short_sha() {
        let root = temp_root("detached-head-repo");
        fs::create_dir_all(&root).expect("create root");
        run_test_git(&root, &["init"]);
        fs::write(root.join("app.txt"), "base\n").expect("write base");
        run_test_git(&root, &["add", "app.txt"]);
        run_test_git(
            &root,
            &[
                "-c",
                "user.name=Keelhouse Test",
                "-c",
                "user.email=keelhouse@example.test",
                "commit",
                "-m",
                "base",
            ],
        );
        run_test_git(&root, &["checkout", "--detach"]);

        let status = git_status(root.to_string_lossy().into_owned()).expect("read git status");
        let branch = status.branch.expect("detached label");
        assert!(
            branch.starts_with("@ "),
            "unexpected detached label: {branch}"
        );
        assert!(branch.len() >= 9, "short SHA missing from {branch}");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validates_git_relative_paths() {
        assert_eq!(
            validate_git_relative_path("src/app.ts").expect("relative path"),
            "src/app.ts"
        );
        assert!(validate_git_relative_path("../secret").is_err());
        assert!(validate_git_relative_path("/tmp/secret").is_err());
        assert!(validate_git_relative_path("").is_err());
    }

    #[test]
    fn synthesizes_untracked_text_diff() {
        let root = temp_root("git-diff-untracked");
        fs::create_dir_all(root.join("src")).expect("create src");
        fs::write(root.join("src/new.txt"), "one\ntwo\n").expect("write file");
        let diff = synthetic_untracked_diff(root.to_str().expect("utf8 root"), "src/new.txt")
            .expect("synthetic diff")
            .expect("diff exists");
        assert_eq!(diff.path, "src/new.txt");
        assert_eq!(diff.source, "untracked");
        assert!(diff.diff.contains("--- /dev/null"));
        assert!(diff.diff.contains("+++ b/src/new.txt"));
        assert!(diff.diff.contains("+one\n+two\n"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn git_file_actions_stage_unstage_and_discard_tracked_changes() {
        let root = temp_root("git-actions-tracked");
        fs::create_dir_all(root.join("src")).expect("create src");
        run_test_git(&root, &["init"]);
        fs::write(root.join("src/app.txt"), "base\n").expect("write base");
        run_test_git(&root, &["add", "src/app.txt"]);
        run_test_git(
            &root,
            &[
                "-c",
                "user.name=Keelhouse Test",
                "-c",
                "user.email=keelhouse@example.test",
                "commit",
                "-m",
                "base",
            ],
        );
        fs::write(root.join("src/app.txt"), "changed\n").expect("write changed");
        let root_s = root.to_string_lossy().into_owned();
        let staged = git_file_action(root_s.clone(), "src/app.txt".into(), GitFileAction::Stage)
            .expect("stage file");
        assert_eq!(staged.staged, 1);
        assert_eq!(staged.unstaged, 0);
        let unstaged =
            git_file_action(root_s.clone(), "src/app.txt".into(), GitFileAction::Unstage)
                .expect("unstage file");
        assert_eq!(unstaged.staged, 0);
        assert_eq!(unstaged.unstaged, 1);
        let clean = git_file_action(root_s, "src/app.txt".into(), GitFileAction::Discard)
            .expect("discard file");
        assert!(clean.files.is_empty());
        assert_eq!(
            fs::read_to_string(root.join("src/app.txt")).expect("read restored"),
            "base\n"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn git_file_actions_stage_unstage_and_discard_untracked_file() {
        let root = temp_root("git-actions-untracked");
        fs::create_dir_all(root.join("src")).expect("create src");
        run_test_git(&root, &["init"]);
        fs::write(root.join("src/new.txt"), "new\n").expect("write new");
        let root_s = root.to_string_lossy().into_owned();
        let staged = git_file_action(root_s.clone(), "src/new.txt".into(), GitFileAction::Stage)
            .expect("stage untracked file");
        assert_eq!(staged.staged, 1);
        let untracked =
            git_file_action(root_s.clone(), "src/new.txt".into(), GitFileAction::Unstage)
                .expect("unstage new file");
        assert_eq!(untracked.untracked, 1);
        let clean = git_file_action(root_s, "src/new.txt".into(), GitFileAction::Discard)
            .expect("discard untracked file");
        assert!(clean.files.is_empty());
        assert!(!root.join("src/new.txt").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn git_remote_url_reads_origin_and_returns_none_without_one() {
        let root = temp_root("remote-url-repo");
        fs::create_dir_all(&root).expect("create root");
        run_test_git(&root, &["init"]);
        let root_s = root.to_string_lossy().into_owned();

        assert_eq!(git_remote_url(root_s.clone()).expect("call succeeds"), None);

        run_test_git(
            &root,
            &[
                "remote",
                "add",
                "origin",
                "https://github.com/jpoindexter/keelhouse.git",
            ],
        );
        assert_eq!(
            git_remote_url(root_s).expect("call succeeds"),
            Some("https://github.com/jpoindexter/keelhouse.git".to_string())
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn extract_account_name_reads_gh_and_glab_formats_and_skips_token_lines() {
        let gh_output = "github.com\n  ✓ Logged in to github.com account jpoindexter (keyring)\n  - Token: gho_************************************\n";
        assert_eq!(
            extract_account_name(gh_output),
            Some("jpoindexter".to_string())
        );

        let glab_output = "gitlab.com\n  ✓ Logged in to gitlab.com as jpoindexter (oauth_token)\n  ✓ Token: glpat-****************\n";
        assert_eq!(
            extract_account_name(glab_output),
            Some("jpoindexter".to_string())
        );

        assert_eq!(extract_account_name("no recognizable auth line here"), None);
    }

    #[test]
    fn cli_tool_status_reports_missing_binary_without_error() {
        let status = cli_tool_status(
            "definitely-not-a-real-cli-binary",
            Some(&["auth", "status"]),
        );
        assert!(!status.installed);
        assert_eq!(status.authenticated, None);
        assert_eq!(status.account, None);
    }

    #[test]
    fn cli_tool_status_detects_real_git_with_no_auth_concept() {
        let status = cli_tool_status("git", None);
        assert!(status.installed);
        assert_eq!(status.authenticated, None);
    }

    #[test]
    fn worktree_slug_sanitizes_and_falls_back_on_empty_input() {
        assert_eq!(worktree_slug("Fix API flow!"), "fix-api-flow");
        assert_eq!(worktree_slug("  spaced   out  "), "spaced-out");
        assert!(worktree_slug("!!!").starts_with("session-"));
        assert!(worktree_slug("").starts_with("session-"));
    }

    #[test]
    fn worktree_create_and_remove_round_trips_a_real_repo() {
        let root = temp_root("worktree-repo");
        fs::create_dir_all(&root).expect("create root");
        run_test_git(&root, &["init"]);
        fs::write(root.join("app.txt"), "base\n").expect("write base");
        run_test_git(&root, &["add", "app.txt"]);
        run_test_git(
            &root,
            &[
                "-c",
                "user.name=Keelhouse Test",
                "-c",
                "user.email=keelhouse@example.test",
                "commit",
                "-m",
                "base",
            ],
        );
        let root_s = root.to_string_lossy().into_owned();

        let created = create_project_worktree(root_s.clone(), "Fix API flow".into())
            .expect("create worktree");
        assert!(created.path.ends_with(".worktrees/fix-api-flow"));
        assert_eq!(created.branch, "worktree/fix-api-flow");
        assert!(Path::new(&created.path).join("app.txt").exists());

        let collision = create_project_worktree(root_s.clone(), "Fix API flow".into());
        assert!(collision.is_err(), "duplicate slug must be rejected");

        remove_project_worktree(root_s.clone(), created.path.clone(), created.branch.clone())
            .expect("remove worktree");
        assert!(!Path::new(&created.path).exists());
        let branches = Command::new("git")
            .args(["-C", &root_s, "branch", "--list", &created.branch])
            .output()
            .expect("list branches");
        assert!(String::from_utf8_lossy(&branches.stdout).trim().is_empty());

        let _ = fs::remove_dir_all(root);
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
    fn workspace_text_search_matches_text_and_skips_noisy_dirs() {
        let root = temp_root("agent-cli-search-root");
        fs::create_dir_all(root.join("src")).expect("create src");
        fs::create_dir_all(root.join("node_modules/pkg")).expect("create node_modules");
        fs::write(
            root.join("src/app.ts"),
            "const KeelhouseSearch = true;\nsecond line\n",
        )
        .expect("write source");
        fs::write(
            root.join("node_modules/pkg/index.js"),
            "KeelhouseSearch should be ignored\n",
        )
        .expect("write noisy dependency");

        let results = search_workspace_text(
            root.to_string_lossy().into_owned(),
            "keelhousesearch".into(),
            Some(20),
        )
        .expect("search workspace text");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].relative_path, "src/app.ts");
        assert_eq!(results[0].line, 1);
        assert_eq!(results[0].column, 7);
        assert!(results[0].line_text.contains("KeelhouseSearch"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn workspace_text_search_caps_matches() {
        let root = temp_root("agent-cli-search-cap-root");
        fs::create_dir_all(&root).expect("create root");
        fs::write(root.join("many.txt"), "needle\nneedle\nneedle\n").expect("write matches");

        let results = search_workspace_text(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            Some(2),
        )
        .expect("search workspace text");

        assert_eq!(results.len(), 2);
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
