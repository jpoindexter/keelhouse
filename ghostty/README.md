# Ghostty theme — mono-ghost

Terminal color theme for cmux (inherited directly — "Terminal rendering uses your Ghostty config"). OKLCH-derived, contrast-verified, not eyeballed. Full reasoning in `../DECISIONS.md` (2026-07-07 — "Pivot to cmux; theme built for it").

## Install

```bash
mkdir -p ~/.config/ghostty
cp config ~/.config/ghostty/config
```

## What's in it

- Chrome tones (bg/fg/bright) match the already-approved mono-ghost demo palette from earlier in the project.
- ANSI accent colors (red/green/yellow/blue/magenta/cyan, normal + bright) are newly built: desaturated per dark-mode convention, every text pair verified >=4.5:1 contrast against the background — not guessed.
- Font: JetBrains Mono (already installed).

## Also set

cmux's own appearance mode, separately (native app chrome, not terminal rendering):

```bash
defaults write com.cmuxterm.app appearanceMode -string "dark"
```
