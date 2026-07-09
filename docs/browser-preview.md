# Browser Preview

BROWSER-PREVIEW adds the lightweight web surface needed for local app work without leaving Keelhouse.

## Implemented

- A docked browser preview pane sits between the editor and terminal.
- The toolbar includes Back, Forward, Reload, address/local URL input, Open, and Open externally.
- Address input accepts `http`, `https`, `file`, and shorthand local URLs such as `localhost:5173`.
- Preview rendering uses an iframe so local apps, generated pages, docs, and auth screens can be inspected inside the workbench when they allow embedding.
- Preview URL state is remembered in `workspace.json` through `browserPreviewByProject` and `browserPreviewBySession`.
- Switching projects or project sessions restores the remembered preview URL for that context.
- Context menus on the preview surface expose Back, Forward, Reload, Open externally, and Copy URL.
- Screenshot QA covers the browser toolbar and rendered preview in desktop and narrow workbench captures.

## Deferred

- Automatic localhost process discovery belongs to DEV-SERVER-DETECT.
- Browser-controlled app actions and visual context attachment belong to AGENT-HOOKS and COMPOSER-HARNESS.
- Full browser features, tabs, downloads, devtools, and general daily browsing stay out of scope.

## QA

Run `cd app && npm run qa:editor`. The selected, context-menu, and narrow captures include the preview pane.
