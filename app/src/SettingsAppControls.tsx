import { IGNORED_FOLDERS, type SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";

export function SettingsAppControl({ row, props }: { row: SettingsRowDef; props: SettingsModalProps }) {
  if (row.id === "app.ignored") return <span className="settings-modal__value">{IGNORED_FOLDERS.join("  ")}</span>;
  if (row.id === "app.reset") return <button className="settings-modal__action settings-modal__action--danger" type="button" onClick={() => props.onResetLocalData?.()}>Reset…</button>;
  if (row.id === "app.notifications") return <select className="settings-modal__select" aria-label="Background notifications" value={props.notificationsEnabled ? "on" : "off"} onChange={(event) => props.onNotificationsChange?.(event.currentTarget.value === "on")}>
    <option value="off">Off</option><option value="on">On</option>
  </select>;
  if (row.id === "app.theme") return <select className="settings-modal__select" aria-label="Color theme" value={props.theme ?? "graphite"} onChange={(event) => props.onThemeChange?.(event.currentTarget.value as "graphite" | "mono-ghost")}>
    <option value="graphite">Graphite · steel-cyan</option><option value="mono-ghost">Mono ghost</option>
  </select>;
  return null;
}
