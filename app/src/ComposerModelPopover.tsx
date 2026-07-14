import type { RefObject } from "react";

import type { ChatProvider } from "./chatConversation";
import { AppIcon } from "./icons";
import { ComposerModelMenu, CustomModelForm } from "./ComposerModelMenu";
import type { ComposerModelChoice } from "./composerModels";

type ModelPopoverProps = {
  activeIndex: number; choices: ComposerModelChoice[]; customMode: boolean; customModel: string;
  model: string; provider: ChatProvider; query: string; searchRef: RefObject<HTMLInputElement | null>;
  onActiveIndexChange: (index: number) => void; onChoose: (provider: ChatProvider, model: string) => void;
  onCustomModeChange: (value: boolean) => void; onCustomModelChange: (value: string) => void;
  onManageModels: () => void; onQueryChange: (query: string) => void;
};

export function ComposerModelPopover(props: ModelPopoverProps) {
  return (
    <div className="composer-model-picker__popover" role="dialog" aria-label="Choose model">
      <label className="composer-model-picker__search">
        <AppIcon name="search" />
        <input
          ref={props.searchRef}
          aria-label="Search models"
          placeholder="Search models and providers"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.currentTarget.value)}
        />
        {props.query ? <button type="button" aria-label="Clear model search" onClick={() => props.onQueryChange("")}><AppIcon name="close" /></button> : null}
      </label>
      {props.customMode ? (
        <CustomModelForm
          provider={props.provider}
          value={props.customModel}
          onBack={() => props.onCustomModeChange(false)}
          onChange={props.onCustomModelChange}
          onSubmit={() => { if (props.customModel.trim()) props.onChoose(props.provider, props.customModel.trim()); }}
        />
      ) : (
        <ComposerModelMenu
          activeIndex={props.activeIndex}
          choices={props.choices}
          model={props.model}
          provider={props.provider}
          onActiveIndexChange={props.onActiveIndexChange}
          onChoose={props.onChoose}
        />
      )}
      {!props.customMode ? (
        <div className="composer-model-picker__footer">
          <button type="button" onClick={() => props.onCustomModeChange(true)}><AppIcon name="plus" />Custom model ID</button>
          <button type="button" onClick={props.onManageModels}><AppIcon name="settings" />Provider settings</button>
        </div>
      ) : null}
    </div>
  );
}
