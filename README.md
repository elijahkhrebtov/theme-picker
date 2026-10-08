# Theme studio

A desktop workspace for building paired light and dark UI themes in OKLCH.

```sh
npm install
npm run dev
```

Open the local Vite URL. The columns run left to right: dark preview, light preview, color editor, and theme variables. The previews scroll together while the editor and variable list stay pinned.

Select a variable in either theme to edit its lightness and chroma. The 24 core/accent tokens share one hue across both themes. Success, warning, and danger each have their own hue, shared by the 10 tokens in that family across both themes. Their defaults are green, amber, and red respectively. Changes update previews immediately and are saved to localStorage under `theme-studio:v1`.

The editor includes interactive gamut graphs, gradient sliders with gamut boundary stops, editable CSS colors, HEX/RGB/HSL output, display support warnings, and a clickable sRGB fallback. Graphs, Display P3, and Rec2020 are always enabled. Press L/C/H to focus a number field, use arrow keys to adjust, or hold Shift for smaller steps. Number fields also accept arithmetic expressions.

Variable sections can be collapsed with a click or the keyboard. The list scrolls internally while its theme tabs and copy button stay visible.

The accent, success, warning, and danger families each include a background, hover/active/disabled backgrounds, three foreground text levels, and a border for that background. Use `text-accented` / `border-accented` or `text-success` / `border-success` (and equivalent warning/danger tokens) for colored details on neutral surfaces. `accent-disabled` names the disabled-control background explicitly. The previews include status alerts, outlined badges, input validation, interactive status actions, and disabled actions.

Existing saved palettes receive defaults for new tokens while retaining all previous edits.

Use **Copy CSS** to export all 108 custom properties in `:root` and `.dark` rules. **View CSS** provides a selectable export when clipboard access is unavailable. **Reset palette** restores the defaults after confirmation.

Use **Import CSS** to paste current or previous exports. Recognized color variables in `:root` and `.dark` are applied to their corresponding themes. Missing variables remain unchanged; extra variables and invalid color declarations are ignored. If no usable colors match, the modal shows an error and leaves both themes untouched. Imported hues are preserved exactly, including after reload; changing a hue in the picker still links that family across both themes.

## Validation

```sh
npm run build
npm run lint
npx playwright install chromium
npm test
```

Browser tests cover graph rendering, column order and scrolling, live edits, shared hue, persistence, expressions and precision stepping, color parsing, gamut fallback, CSS export, preview controls, status colors and interaction states, collapsible sections and internal scrolling, legacy palette migration, CSS import and export round trips, and corrupted storage recovery. The test runner starts a local Vite server automatically if needed.

## Source

- `src/theme.ts`: token definitions, defaults, storage validation, CSS export.
- `src/picker/`: color conversion, copied arithmetic parser, adapted gamut chart/slider rendering, React editor.
- `src/Showcase.tsx`: interactive component examples for each theme.
- `src/App.tsx`: workspace and theme editing state.

Relevant picker code was copied and adapted from the `oklch-picker` submodule; the application does not import from the submodule. Its MIT license is preserved in `src/picker/LICENSE`. The adapted renderer uses the original `@colordx/core` and `@colordx/gpu` libraries and has a 2D canvas fallback for browsers without WebGL2.

The workspace is intentionally designed for large desktop monitors, with a minimum width of 1400px. Display gamut availability depends on the browser and monitor.
