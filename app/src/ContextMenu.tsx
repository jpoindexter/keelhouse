import { useEffect, useRef, type KeyboardEvent } from "react";
import { AppIcon, type AppIconName } from "./icons";

export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: AppIconName;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => unknown | Promise<unknown>;
};

export type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
};

type ContextMenuProps = {
  state: ContextMenuState;
  onDismiss: () => void;
  onActionError: (item: ContextMenuItem, error: unknown) => void;
};

export const contextMenuPosition = (
  state: Pick<ContextMenuState, "x" | "y" | "items">,
  viewport: { width: number; height: number },
) => {
  const width = 252;
  const height = state.items.length * 28 + 12;
  const gutter = 8;
  return {
    left: Math.max(gutter, Math.min(state.x, viewport.width - width - gutter)),
    top: Math.max(gutter, Math.min(state.y, viewport.height - height - gutter)),
  };
};

export function ContextMenu({ state, onDismiss, onActionError }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const position = contextMenuPosition(state, {
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  });

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const dismiss = () => onDismiss();
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [onDismiss, state]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>, direction: 1 | -1) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const fallbackIndex = direction === 1 ? 0 : buttons.length - 1;
    const nextIndex = currentIndex === -1 ? fallbackIndex : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    } else if (event.key === "ArrowDown") {
      moveFocus(event, 1);
    } else if (event.key === "ArrowUp") {
      moveFocus(event, -1);
    } else if (event.key === "Home" || event.key === "End") {
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
    }
  };

  const run = async (item: ContextMenuItem) => {
    if (item.disabled) return;
    onDismiss();
    try {
      await item.onSelect();
    } catch (error) {
      onActionError(item, error);
    }
  };

  return (
    <div
      ref={ref}
      className="context-menu"
      style={position}
      aria-label="Context menu"
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {state.items.map((item) => (
        <button
          className={item.danger ? "context-menu__item context-menu__item--danger" : "context-menu__item"}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          data-menu-action-id={item.id}
          key={item.id}
          onClick={() => void run(item)}
        >
          <span className="context-menu__label">
            {item.icon ? <AppIcon name={item.icon} /> : null}
            <span>{item.label}</span>
          </span>
          {item.shortcut ? <span className="context-menu__shortcut">{item.shortcut}</span> : null}
        </button>
      ))}
    </div>
  );
}
