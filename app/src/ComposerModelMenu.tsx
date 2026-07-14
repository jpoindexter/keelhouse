import type { ChatProvider } from "./chatConversation";
import { chatProviderLabel } from "./chatConversation";
import type { ComposerModelChoice } from "./composerModels";
import { AppIcon } from "./icons";

type ModelMenuProps = {
  activeIndex: number;
  choices: ComposerModelChoice[];
  model: string;
  provider: ChatProvider;
  onActiveIndexChange: (index: number) => void;
  onChoose: (provider: ChatProvider, model: string) => void;
};

export function ComposerModelMenu({ activeIndex, choices, model, provider, onActiveIndexChange, onChoose }: ModelMenuProps) {
  return (
    <div className="composer-model-picker__list" role="listbox" aria-label="Available models">
      {(["codex", "claude"] as const).map((groupProvider) => {
        const group = choices.filter((choice) => choice.provider === groupProvider);
        if (group.length === 0) return null;
        return (
          <div className="composer-model-picker__group" key={groupProvider}>
            <div className="composer-model-picker__heading">{chatProviderLabel(groupProvider)}</div>
            {group.map((choice) => {
              const index = choices.indexOf(choice);
              const selected = provider === choice.provider && model.trim() === choice.id;
              return (
                <button
                  className={index === activeIndex ? "is-active" : ""}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={`${choice.provider}:${choice.id || "default"}`}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onClick={() => onChoose(choice.provider, choice.id)}
                >
                  <span><strong>{choice.label}</strong><small>{choice.detail}</small></span>
                  {selected ? <AppIcon name="check" /> : null}
                </button>
              );
            })}
          </div>
        );
      })}
      {choices.length === 0 ? <div className="composer-model-picker__empty">No matching models</div> : null}
    </div>
  );
}

export function CustomModelForm({
  provider,
  value,
  onBack,
  onChange,
  onSubmit,
}: {
  provider: ChatProvider;
  value: string;
  onBack: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form className="composer-model-picker__custom" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label htmlFor="composer-custom-model">Custom {chatProviderLabel(provider)} model ID</label>
      <input id="composer-custom-model" autoFocus maxLength={128} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      <div>
        <button type="button" onClick={onBack}>Back</button>
        <button type="submit" disabled={!value.trim()}>Use model</button>
      </div>
    </form>
  );
}
