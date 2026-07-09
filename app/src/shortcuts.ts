export type ShortcutStatus = "active" | "native" | "planned" | "passthrough";

export type Shortcut = {
  id: string;
  label: string;
  scope: "Workspace" | "Editor" | "Terminal" | "Composer" | "Chrome";
  keys: string[];
  status: ShortcutStatus;
  behavior: string;
  exception?: string;
};

export const SHORTCUTS: Shortcut[] = [
  {
    id: "workspace.open",
    label: "Open folder",
    scope: "Workspace",
    keys: ["Cmd+O"],
    status: "active",
    behavior: "Open the native folder picker and switch the active workspace.",
  },
  {
    id: "editor.save",
    label: "Save file",
    scope: "Editor",
    keys: ["Cmd+S"],
    status: "active",
    behavior: "Save the active dirty editor buffer through the guarded write path.",
  },
  {
    id: "editor.find",
    label: "Find/replace",
    scope: "Editor",
    keys: ["Cmd+F", "F3", "Cmd+G", "Shift+Cmd+G"],
    status: "native",
    behavior: "Open and navigate CodeMirror's find/replace panel.",
  },
  {
    id: "editor.close-tab",
    label: "Close editor tab",
    scope: "Editor",
    keys: ["Cmd+W"],
    status: "active",
    behavior: "Close the active editor tab; dirty tabs still ask before discarding.",
  },
  {
    id: "terminal.copy-selection",
    label: "Copy terminal selection",
    scope: "Terminal",
    keys: ["Cmd+C"],
    status: "active",
    behavior: "Copy selected terminal text without sending Ctrl+C to the pty.",
    exception: "With no terminal selection, Cmd+C is left to the app/window so it does not interrupt the agent by accident.",
  },
  {
    id: "terminal.paste",
    label: "Paste into terminal",
    scope: "Terminal",
    keys: ["Cmd+V"],
    status: "active",
    behavior: "Read the clipboard and paste through the bracketed-aware pty paste path.",
  },
  {
    id: "terminal.clear",
    label: "Clear terminal",
    scope: "Terminal",
    keys: ["Cmd+K"],
    status: "active",
    behavior: "Send Ctrl+L to the selected terminal pane.",
    exception: "Cmd+K is terminal clear in v0.5; command palette keeps its own future card.",
  },
  {
    id: "terminal.scroll-page",
    label: "Scroll terminal page",
    scope: "Terminal",
    keys: ["Shift+PageUp", "Shift+PageDown"],
    status: "active",
    behavior: "Scroll the Ghostty viewport through terminal scrollback.",
  },
  {
    id: "terminal.keyboard",
    label: "Terminal TUI keys",
    scope: "Terminal",
    keys: ["Arrows", "Ctrl+key", "Option+Arrow", "Option+Backspace", "Shift+Enter"],
    status: "passthrough",
    behavior: "Encode common terminal chords with Ghostty and pass them to the real pty.",
  },
  {
    id: "composer.send",
    label: "Send composer draft",
    scope: "Composer",
    keys: ["Enter"],
    status: "active",
    behavior: "Send the draft to the selected pane or route an app command.",
  },
  {
    id: "composer.newline",
    label: "Composer newline",
    scope: "Composer",
    keys: ["Shift+Enter"],
    status: "active",
    behavior: "Insert a newline without sending.",
  },
  {
    id: "composer.escape",
    label: "Blur composer",
    scope: "Composer",
    keys: ["Escape"],
    status: "active",
    behavior: "Leave the composer without discarding the draft.",
  },
  {
    id: "composer.history",
    label: "Composer history",
    scope: "Composer",
    keys: ["Up", "Down"],
    status: "active",
    behavior: "Recall previous drafts when the composer is empty, then step forward.",
  },
  {
    id: "workspace.quick-open",
    label: "Quick open",
    scope: "Workspace",
    keys: ["Cmd+P"],
    status: "planned",
    behavior: "Planned file quick-open/search entry point.",
    exception: "Not active until SEARCH/COMMAND-PALETTE work lands.",
  },
  {
    id: "chrome.command-palette",
    label: "Command palette",
    scope: "Chrome",
    keys: ["Shift+Cmd+P"],
    status: "active",
    behavior: "Open the compact action palette backed by the shared command labels.",
    exception: "Cmd+K remains terminal clear.",
  },
  {
    id: "terminal.new-pane",
    label: "New terminal pane",
    scope: "Terminal",
    keys: ["Cmd+Shift+`"],
    status: "planned",
    behavior: "New-pane UI exists; keyboard binding remains planned until shortcut conflict handling is explicit.",
    exception: "Use the terminal header or context menu for now.",
  },
  {
    id: "terminal.split-pane",
    label: "Split terminal pane",
    scope: "Terminal",
    keys: ["Cmd+\\"],
    status: "planned",
    behavior: "Planned after the pane strip proves the right default layout.",
    exception: "PANE-MANAGER uses focusable pane buttons before split layout.",
  },
  {
    id: "terminal.focus-next-pane",
    label: "Focus next pane",
    scope: "Terminal",
    keys: ["Cmd+Option+Right", "Cmd+Option+Left"],
    status: "planned",
    behavior: "Planned once multi-pane/project focus exists.",
    exception: "v0.5 has one terminal pane.",
  },
];

export const shortcutById = (id: string) => SHORTCUTS.find((shortcut) => shortcut.id === id);

export const shortcutKeys = (id: string) => shortcutById(id)?.keys.join(" / ") ?? "";

export const shortcutTitle = (id: string, fallback: string) => {
  const keys = shortcutKeys(id);
  return keys ? `${fallback} (${keys})` : fallback;
};
