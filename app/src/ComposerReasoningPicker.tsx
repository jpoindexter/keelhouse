import type { ComposerReasoningEffort } from "./composerHarness";
import { AppIcon } from "./icons";

const OPTIONS: { value: ComposerReasoningEffort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

export const composerReasoningLabel = (effort: ComposerReasoningEffort) =>
  OPTIONS.find((option) => option.value === effort)?.label ?? "Default";

export function ComposerReasoningPicker({
  value,
  disabled = false,
  onSelect,
}: {
  value: ComposerReasoningEffort;
  disabled?: boolean;
  onSelect: (value: ComposerReasoningEffort) => void | Promise<void>;
}) {
  return (
    <details className="agent-composer__menu composer-reasoning-picker">
      <summary className="agent-composer__control" aria-label={`Reasoning effort: ${composerReasoningLabel(value)}`}>
        <AppIcon name="thinking" />
        <span>{composerReasoningLabel(value)}</span>
        <AppIcon name="chevronDown" />
      </summary>
      <div className="composer-reasoning-picker__popover" role="menu" aria-label="Reasoning effort">
        <div className="composer-reasoning-picker__heading">Reasoning effort</div>
        {OPTIONS.map((option) => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={value === option.value}
            disabled={disabled}
            key={option.value}
            onClick={(event) => {
              void onSelect(option.value);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <span>{option.label}</span>
            {value === option.value ? <AppIcon name="check" /> : null}
          </button>
        ))}
      </div>
    </details>
  );
}
