import { AppIcon } from "./icons";
import type { ToolTrayMode } from "./workbenchLayout";

type ToolTrayTabsProps = {
  mode: ToolTrayMode;
  onModeChange: (mode: ToolTrayMode) => void;
  onClose: () => void;
};

const showsEditor = (mode: ToolTrayMode) => mode === "editor" || mode === "split";
const showsBrowser = (mode: ToolTrayMode) => mode === "browser" || mode === "split";

export function ToolTrayTabs({ mode, onModeChange, onClose }: ToolTrayTabsProps) {
  return (
    <nav className="tool-tray-tabs" aria-label="Tool tray surfaces">
      <button
        className={`tool-tray-tabs__tab ${showsEditor(mode) ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={showsEditor(mode)}
        onClick={() => onModeChange("editor")}
      >
        <AppIcon name="file" />
        <span>Editor</span>
      </button>
      <button
        className={`tool-tray-tabs__tab ${showsBrowser(mode) ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={showsBrowser(mode)}
        onClick={() => onModeChange("browser")}
      >
        <AppIcon name="browser" />
        <span>Browser</span>
      </button>
      <span className="tool-tray-tabs__spacer" />
      <button
        className={`tool-tray-tabs__icon ${mode === "split" ? "tool-tray-tabs__icon--active" : ""}`}
        type="button"
        title="Split editor and browser"
        aria-label="Split editor and browser"
        aria-pressed={mode === "split"}
        onClick={() => onModeChange("split")}
      >
        <AppIcon name="workspace" />
      </button>
      <button
        className="tool-tray-tabs__icon"
        type="button"
        title="Hide tools"
        aria-label="Hide tool tray"
        onClick={onClose}
      >
        <AppIcon name="close" />
      </button>
    </nav>
  );
}
