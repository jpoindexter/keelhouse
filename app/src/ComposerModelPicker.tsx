import type { ChatProvider } from "./chatConversation";
import { chatProviderLabel } from "./chatConversation";
import { ComposerModelPopover } from "./ComposerModelPopover";
import { AppIcon } from "./icons";
import { useComposerModelPicker } from "./useComposerModelPicker";

type ComposerModelPickerProps = {
  provider: ChatProvider;
  model: string;
  configuredModels: Partial<Record<ChatProvider, string>>;
  disabled?: boolean;
  onManageModels: () => void;
  onSelect: (provider: ChatProvider, model: string) => void | Promise<void>;
};

export function ComposerModelPicker(props: ComposerModelPickerProps) {
  const state = useComposerModelPicker(props);
  const activeModel = props.model.trim() || props.configuredModels[props.provider]?.trim() || `${chatProviderLabel(props.provider)} default`;
  return (
    <div className="composer-model-picker" ref={state.rootRef} onKeyDown={state.handleKeyDown}>
      <button
        ref={state.triggerRef}
        className="agent-composer__control composer-model-picker__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={state.open}
        disabled={props.disabled}
        onClick={() => state.setOpen((value) => !value)}
      >
        <AppIcon name="agent" /><span>{activeModel}</span><AppIcon name="chevronDown" />
      </button>
      {state.open ? (
        <ComposerModelPopover
          activeIndex={state.activeIndex} choices={state.filtered} customMode={state.customMode} customModel={state.customModel}
          model={props.model} provider={props.provider} query={state.query} searchRef={state.searchRef}
          onActiveIndexChange={state.setActiveIndex} onChoose={(provider, model) => void state.choose(provider, model)}
          onCustomModeChange={(value) => { state.setCustomMode(value); if (value) state.setCustomModel(props.model); }}
          onCustomModelChange={state.setCustomModel} onQueryChange={(query) => { state.setQuery(query); state.setActiveIndex(0); }}
          onManageModels={() => { state.close(false); props.onManageModels(); }}
        />
      ) : null}
    </div>
  );
}
