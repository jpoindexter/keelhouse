import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

type NativeAppEventOptions<TGrid, TPaneExit> = {
  onGrid: (payload: TGrid) => void;
  onOpenFolder: () => void;
  onSaveFile: () => void;
  onFindInFile: () => void;
  onCloseEditorTab: () => void;
  onPaneExit: (payload: TPaneExit) => void;
};

export function useNativeAppEvents<TGrid, TPaneExit>(options: NativeAppEventOptions<TGrid, TPaneExit>): void {
  useEffect(() => {
    const listeners = [
      listen<TGrid>("grid", (event) => options.onGrid(event.payload)),
      listen("menu-open-folder", options.onOpenFolder),
      listen("menu-save-file", options.onSaveFile),
      listen("menu-find-in-file", options.onFindInFile),
      listen("menu-close-editor-tab", options.onCloseEditorTab),
      listen<TPaneExit>("pane-exit", (event) => options.onPaneExit(event.payload)),
    ];
    return () => {
      for (const listener of listeners) void listener.then((stop) => stop());
    };
  }, []);
}
