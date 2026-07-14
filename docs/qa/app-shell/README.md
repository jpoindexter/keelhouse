# App Shell Browser QA

`cd app && npm run qa:shell` renders the production React shell through an explicit `?qa=1` Tauri mock boundary and captures populated states at 1440x900, 1024x640, and 900x640.

## 2026-07-14 Result

- `first-open-1440.png`: 332px Threads drawer, readable center conversation, and 430px right tool tray. Tool tabs collapse to icons before labels collide.
- `first-open-1024.png`: the secondary tool tray is hidden; the conversation and composer retain readable widths.
- `first-open-900.png`: minimum supported window remains legible with no clipped toolbar text or overlapping controls.
- Fresh installs now restore the declared 332px drawer default. Missing local storage no longer parses as a 220px saved width.

These captures execute browser-shell layout and pixel rendering. They do not establish packaged WebKit behavior, native menus, or macOS window resizing; those remain part of packaged chrome sign-off.
