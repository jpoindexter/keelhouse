import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { isCellSelected, pointFromMouse, selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import "./App.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type LaunchProfile = { id: string; command: string; args: string[]; useLoginShell: boolean };
type PaneExit = { command: string; code: number; message: string };

const FONT_SIZE = 15;
const FONT_FAMILY = "JetBrains Mono, monospace";
const LINE_HEIGHT = 1.25;
const DEFAULT_LAUNCH_PROFILE: LaunchProfile = {
  id: "claude",
  command: "claude",
  args: [],
  useLoginShell: true,
};

const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value != null;

const normalizeLaunchProfile = (value: unknown): LaunchProfile => {
  if (!isRecord(value) || typeof value.command !== "string" || !value.command.trim()) {
    return DEFAULT_LAUNCH_PROFILE;
  }
  const args = Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string") : [];
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id : value.command,
    command: value.command,
    args,
    useLoginShell: typeof value.useLoginShell === "boolean" ? value.useLoginShell : true,
  };
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const latest = useRef<Snapshot | null>(null);
  const frame = useRef<number | null>(null);
  const metrics = useRef({ cw: 9, ch: 19 });
  const selection = useRef<SelectionRange | null>(null);
  const selecting = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const paint = () => {
      frame.current = null;
      const snap = latest.current;
      if (!snap) return;
      const { cw, ch } = metrics.current;
      const dpr = window.devicePixelRatio || 1;
      const w = snap.cols * cw;
      const h = snap.rows * ch;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "top";
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

      for (let y = 0; y < snap.rows; y++) {
        for (let x = 0; x < snap.cols; x++) {
          const cell = snap.cells[y * snap.cols + x];
          if (!cell) continue;
          const selected = isCellSelected(x, y, selection.current);
          ctx.fillStyle = selected ? "#2f6f9f" : rgb(cell.b);
          ctx.fillRect(x * cw, y * ch, cw, ch);
          if (cell.t !== " ") {
            ctx.fillStyle = selected ? "#ffffff" : rgb(cell.f);
            ctx.font = `${cell.bold ? "bold " : ""}${FONT_SIZE}px ${FONT_FAMILY}`;
            ctx.fillText(cell.t, x * cw, y * ch + (ch - FONT_SIZE) / 2);
          }
        }
      }
      if (snap.cvis) {
        ctx.fillStyle = "rgba(230,230,230,0.55)";
        ctx.fillRect(snap.cx * cw, snap.cy * ch, cw, ch);
      }
    };

    const requestPaint = () => {
      if (frame.current == null) frame.current = requestAnimationFrame(paint);
    };

    // Measure the monospace advance once the font is loaded, then report size.
    const setup = async () => {
      await (document as any).fonts?.ready;
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
      const cw = Math.max(1, Math.round(ctx.measureText("M").width));
      const ch = Math.round(FONT_SIZE * LINE_HEIGHT);
      metrics.current = { cw, ch };
      await initWorkspace();
    };

    const terminalSize = () => {
      const rect = terminalHostRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        return { width: rect.width, height: rect.height };
      }
      return { width: window.innerWidth, height: window.innerHeight };
    };

    const sendResize = () => {
      const { cw, ch } = metrics.current;
      const { width, height } = terminalSize();
      const cols = Math.max(2, Math.floor(width / cw));
      const rows = Math.max(2, Math.floor(height / ch));
      invoke("resize_pty", { cols, rows }).catch(() => {});
    };

    const scrollViewport = (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      selection.current = null;
      requestPaint();
      invoke("scroll_pty", { delta: Math.trunc(delta) }).catch(() => {});
    };

    // Workspace: reopen the last folder on startup, else prompt. Opening a folder
    // spawns the selected launch profile in it (backend `open_workspace`) and
    // persists the choice.
    let store: Awaited<ReturnType<typeof load>> | null = null;

    const launchProfile = async () => {
      const saved = await store?.get<unknown>("launchProfile");
      const profile = normalizeLaunchProfile(saved);
      if (!saved) {
        await store?.set("launchProfile", profile);
        await store?.save();
      }
      return profile;
    };

    const openFolder = async (path: string) => {
      try {
        await invoke("open_workspace", { path, profile: await launchProfile() });
        setLaunchError(null);
        sendResize(); // size the fresh pane to the current window
        return true;
      } catch (err) {
        setLaunchError(String(err));
        return false;
      }
    };

    const pickFolder = async () => {
      const dir = await open({ directory: true });
      if (typeof dir !== "string") return;
      const opened = await openFolder(dir);
      if (!opened) return;
      await store?.set("folder", dir);
      await store?.save();
    };

    const initWorkspace = async () => {
      store = await load("workspace.json", { autoSave: true, defaults: {} });
      const last = await store.get<string>("folder");
      if (last) await openFolder(last);
      else await pickFolder();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      // Cmd (meta) combos are app-level, not pty input. Let them through so the
      // native copy/paste clipboard events fire; handle the few we own explicitly.
      if (e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "k") {
          // Clear — map to Ctrl-L (shell clear-screen). Ship-ugly stopgap.
          e.preventDefault();
          invoke("send_key", { code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false }).catch(() => {});
        } else if (k === "c") {
          const snap = latest.current;
          const selectedText = snap && selection.current ? selectionToText(snap.cells, snap.cols, selection.current) : "";
          if (selectedText) {
            e.preventDefault();
            writeText(selectedText).catch(() => {});
          }
        } else if (k === "v") {
          // Paste: the browser `paste` event never fires on a bare canvas, so read
          // the clipboard directly and send it through the (bracketed-aware) command.
          e.preventDefault();
          selection.current = null;
          requestPaint();
          readText().then((t) => t && invoke("paste", { text: t })).catch(() => {});
        }
        return;
      }
      if (e.shiftKey && (e.code === "PageUp" || e.code === "PageDown")) {
        e.preventDefault();
        const rows = latest.current?.rows ?? 24;
        scrollViewport(e.code === "PageUp" ? -(rows - 1) : rows - 1);
        return;
      }
      const code = e.code;
      if (!code) return;
      selection.current = null;
      requestPaint();
      // utf8 text: printable single char only, and only when no ctrl/alt transform.
      const text = e.key.length === 1 && !e.ctrlKey && !e.altKey ? e.key : null;
      e.preventDefault();
      invoke("send_key", {
        code,
        text,
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        sup: false,
      }).catch(() => {});
    };

    const pointForEvent = (e: MouseEvent) => {
      const snap = latest.current;
      if (!snap) return null;
      const { cw, ch } = metrics.current;
      return pointFromMouse(canvas.getBoundingClientRect(), cw, ch, snap.cols, snap.rows, e.clientX, e.clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const point = pointForEvent(e);
      if (!point) return;
      e.preventDefault();
      selection.current = { start: point, end: point };
      selecting.current = true;
      requestPaint();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!selecting.current) return;
      const point = pointForEvent(e);
      if (!point || !selection.current) return;
      selection.current = { ...selection.current, end: point };
      requestPaint();
    };

    const onMouseUp = () => {
      selecting.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      const snap = latest.current;
      if (!snap || snap.sb === 0) return;
      e.preventDefault();
      const { ch } = metrics.current;
      const rawRows = e.deltaY / ch;
      const rows = Math.sign(rawRows) * Math.max(1, Math.round(Math.abs(rawRows)));
      scrollViewport(rows);
    };

    const unlisten = listen<Snapshot>("grid", (ev) => {
      latest.current = ev.payload;
      requestPaint();
    });
    const unlistenMenu = listen("menu-open-folder", () => {
      pickFolder();
    });
    const unlistenPaneExit = listen<PaneExit>("pane-exit", (ev) => {
      setLaunchError(ev.payload.message);
    });

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    const resizeObserver = new ResizeObserver(sendResize);
    if (terminalHostRef.current) resizeObserver.observe(terminalHostRef.current);
    window.addEventListener("resize", sendResize);
    setup();

    return () => {
      unlisten.then((f) => f());
      unlistenMenu.then((f) => f());
      unlistenPaneExit.then((f) => f());
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", sendResize);
      resizeObserver.disconnect();
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="file-rail" aria-label="Project files">
        <div className="panel-title">Files</div>
        <div className="rail-empty">No folder tree</div>
      </aside>

      <main className="workbench">
        <section className="editor-area" aria-label="Editor">
          <div className="editor-tabbar">
            <div className="editor-tab">No file open</div>
          </div>
          <div className="editor-empty">
            <div className="editor-empty-title">Select a file</div>
            <div className="editor-empty-path">Project editor surface</div>
          </div>
        </section>

        <section className="terminal-panel" aria-label="Agent terminal">
          <div className="terminal-titlebar">
            <div>
              <span className="terminal-kicker">Agent</span>
              <span className="terminal-title">Claude</span>
            </div>
          </div>
          <div ref={terminalHostRef} className="terminal-host">
            <canvas ref={canvasRef} className="term" />
          </div>
        </section>
      </main>

      {launchError ? (
        <div className="launch-error" role="alert">
          {launchError}
        </div>
      ) : null}
    </div>
  );
}

export default App;
