import { useRef, useState } from "react";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { PaneLayoutsBySession } from "./sessionRestore";
import {
  createTerminalPaneContexts,
  type ActiveTerminalPaneByContext,
  type TerminalPanesByContext,
} from "./terminalPaneContexts";
import type { PaneLabelsBySession } from "./workspaceBootstrap";

type MutableValue<T> = { current: T };

type TerminalPaneControllerOptions = {
  activeSessionForProject: (root: string | null) => string | null;
  activeWorkspace: MutableValue<string | null>;
  persistPaneLayout: (root: string, sessionId: string, panes: ManagedTerminalPane[]) => void;
};

export function useTerminalPaneController<Snapshot>(options: TerminalPaneControllerOptions) {
  const panesRef = useRef<ManagedTerminalPane[]>([]);
  const panesByContextRef = useRef<TerminalPanesByContext>({});
  const activePaneIdsRef = useRef<ActiveTerminalPaneByContext>({});
  const activePaneIdRef = useRef<number | null>(null);
  const paneLabelsRef = useRef<PaneLabelsBySession>({});
  const paneLayoutsRef = useRef<PaneLayoutsBySession>({});
  const snapshotsRef = useRef<Record<number, Snapshot>>({});
  const requestPaintRef = useRef<() => void>(() => {});
  const intentionallyTerminatedPaneIdsRef = useRef<Set<number>>(new Set());
  const [panes, setPanes] = useState<ManagedTerminalPane[]>([]);
  const [activePaneId, setActivePaneIdState] = useState<number | null>(null);
  const setActivePaneId = (paneId: number | null) => {
    activePaneIdRef.current = paneId;
    setActivePaneIdState(paneId);
  };
  const setPaneLabels = (labels: PaneLabelsBySession) => {
    paneLabelsRef.current = labels;
  };
  const contexts = createTerminalPaneContexts({
    activePaneIds: activePaneIdsRef,
    activeSessionForProject: options.activeSessionForProject,
    activeWorkspace: options.activeWorkspace,
    panes: panesRef,
    panesByContext: panesByContextRef,
    persistPaneLayout: options.persistPaneLayout,
    setActivePaneId,
    setPanes,
  });
  return {
    ...contexts, activePaneId, activePaneIdRef, activePaneIdsRef,
    intentionallyTerminatedPaneIdsRef, paneLabelsRef, paneLayoutsRef,
    panes, panesByContextRef, panesRef, requestPaintRef, setPaneLabels, snapshotsRef,
  };
}
