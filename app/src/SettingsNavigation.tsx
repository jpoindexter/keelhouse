import { AppIcon } from "./icons";
import { SETTINGS_CATEGORIES, SETTINGS_CATEGORY_GROUPS, type SettingsCategoryId } from "./settingsModalData";

type SettingsNavigationProps = {
  category: SettingsCategoryId; searching: boolean;
  onCategoryChange: (category: SettingsCategoryId) => void;
};

export function SettingsNavigation({ category, searching, onCategoryChange }: SettingsNavigationProps) {
  return <aside className="settings-workspace__sidebar">
    <label className="settings-workspace__mobile-label" htmlFor="settings-category">Category</label>
    <select id="settings-category" className="settings-workspace__category-select" value={category} onChange={(event) => onCategoryChange(event.currentTarget.value as SettingsCategoryId)}>
      {SETTINGS_CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
    <nav className="settings-workspace__nav" aria-label="Settings categories">
      {SETTINGS_CATEGORY_GROUPS.map((group) => <div className="settings-workspace__nav-group" key={group.id}>
        <div className="settings-workspace__nav-heading">{group.label}</div>
        {SETTINGS_CATEGORIES.filter((entry) => entry.groupId === group.id).map((entry) => <button
          key={entry.id}
          className={`settings-workspace__nav-row ${!searching && entry.id === category ? "settings-workspace__nav-row--active" : ""}`}
          type="button"
          aria-current={!searching && entry.id === category ? "page" : undefined}
          onClick={() => onCategoryChange(entry.id)}
        ><AppIcon name={entry.icon} /><span>{entry.label}</span></button>)}
      </div>)}
    </nav>
  </aside>;
}
