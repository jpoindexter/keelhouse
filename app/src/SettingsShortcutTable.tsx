import { useState } from "react";

import { eventToCombo, findKeybindingConflicts, resolveShortcutKeys, SHORTCUTS, type KeybindingOverrides } from "./shortcuts";

type SettingsShortcutTableProps = {
  keybindingOverrides: KeybindingOverrides;
  onKeybindingOverrideChange?: (id: string, keys: string[] | null) => void;
};

function ShortcutRow({ shortcut, capturing, overridden, editable, onCapture, onChange }: {
  shortcut: (typeof SHORTCUTS)[number]; capturing: boolean; overridden: boolean; editable: boolean;
  onCapture: (active: boolean) => void; onChange?: (id: string, keys: string[] | null) => void;
}) {
  return <tr>
    <td>{shortcut.label}</td>
    <td>{capturing ? <input className="settings-modal__capture" aria-label={`Press new keys for ${shortcut.label}`} placeholder="Press keys…" autoFocus readOnly onKeyDown={(event) => {
      event.preventDefault();
      if (event.key === "Escape") { event.stopPropagation(); onCapture(false); return; }
      const combo = eventToCombo(event);
      if (combo) { onChange?.(shortcut.id, [combo]); onCapture(false); }
    }} onBlur={() => onCapture(false)} /> : <>{resolveShortcutKeys(shortcut.id).join(" / ")}{overridden ? <span className="settings-modal__overridden"> (custom)</span> : null}</>}</td>
    <td>{shortcut.scope}</td>
    <td>{editable ? <span className="settings-modal__shortcut-actions"><button className="settings-modal__action" type="button" onClick={() => onCapture(true)}>Rebind</button>{overridden ? <button className="settings-modal__action" type="button" onClick={() => onChange?.(shortcut.id, null)}>Reset</button> : null}</span> : null}</td>
  </tr>;
}

export function SettingsShortcutTable({ keybindingOverrides, onKeybindingOverrideChange }: SettingsShortcutTableProps) {
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const conflicts = findKeybindingConflicts();
  const shortcuts = SHORTCUTS.filter((shortcut) => shortcut.status === "active" || shortcut.status === "native");
  return <>
    {conflicts.length > 0 ? <div className="settings-modal__conflict" role="alert">{conflicts.map((conflict) => `${conflict.keys} is bound to ${conflict.ids.join(" and ")}`).join("; ")}. Rebind one of them.</div> : null}
    <table className="settings-modal__shortcuts">
      <thead><tr><th scope="col">Action</th><th scope="col">Keys</th><th scope="col">Scope</th><th scope="col"><span className="settings-modal__sr">Edit</span></th></tr></thead>
      <tbody>{shortcuts.map((shortcut) => <ShortcutRow key={shortcut.id} shortcut={shortcut} capturing={capturingId === shortcut.id} overridden={Boolean(keybindingOverrides[shortcut.id])} editable={shortcut.status === "active" && Boolean(onKeybindingOverrideChange)} onCapture={(active) => setCapturingId(active ? shortcut.id : null)} onChange={onKeybindingOverrideChange} />)}</tbody>
    </table>
  </>;
}
