export type ComposerMenuElement = {
  open: boolean;
  removeAttribute(name: string): void;
};

export const closeOtherOpenComposerMenus = (
  current: ComposerMenuElement,
  menus: Iterable<ComposerMenuElement>,
) => {
  if (!current.open) return;
  for (const menu of menus) {
    if (menu !== current && menu.open) menu.removeAttribute("open");
  }
};
