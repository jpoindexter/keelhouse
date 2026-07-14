# Code Structure

Keelhouse uses a 300/200/50 source limit:

- Source files stay at or below 300 lines.
- React component files stay at or below 200 lines.
- Functions, components, and hooks stay at or below 50 lines.

Run `cd app && npm run qa:module-size` before committing. The check rejects new violations and any growth in the explicit legacy baseline at `docs/qa/module-size-baseline.json`.

The baseline is migration debt, not an exception for new work. Extract one behavior at a time from the largest owners, keep state orchestration in focused hooks, keep rendering in focused components, and delete a baseline entry as soon as its file meets the limits.
