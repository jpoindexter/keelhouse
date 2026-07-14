# Iconography

Keelhouse uses `lucide-react` as its interface icon source. Generic actions use familiar Lucide metaphors such as folder, search, terminal, Git branch, and close. Agent controls use a neutral CPU mark rather than another product's assistant glyph.

- Use the shared `AppIcon` registry in `app/src/icons.tsx`.
- Do not trace or extract icons from Codex, Claude, VS Code, or other apps.
- Keep interface icons on the Lucide grid with the shared stroke weight.
- Add custom artwork only for the Keelhouse product mark or a licensed provider logo.
- Give icon-only buttons an accessible label and tooltip.
