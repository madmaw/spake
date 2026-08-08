# spake

A no-typing speaking aid: a 3D radial word cloud (React Three Fiber) of likely
next words. Tapping a word speaks it via the browser `speechSynthesis` API and
advances the prediction context. The tooling mirrors the compass web repo
(`~/Projects/compass/service/microservice/web`) but flattened to a single
package: pnpm, Vite 8 (rolldown), Vitest 4, Storybook 10, Biome + type-checked
ESLint, TypeScript strict.

## Conventions (inherited from compass web)

- Biome is the formatter and first-line linter (4-space indent, sorted object
  keys, sorted JSX attributes). ESLint adds type-aware rules on top.
- Tests and stories live in `specs/` folders next to the code they cover:
  `src/foo/specs/Bar.tests.ts`, `src/foo/specs/Bar.stories.tsx`.
- Unit tests run in happy-dom; stories are tested in real headless Chromium via
  `@storybook/addon-vitest` (`pnpm test:storybook`).
- Imports from `src/...` (path alias), no relative paths outside the same
  folder. No default exports in source files (specs and configs excepted).
- Prefer `== null` over `=== null`/`=== undefined`. CSS module imports are
  named `styles`.
- React Compiler is enabled — don't hand-memoize.

## Gotchas

- `speechSynthesis` does not exist in happy-dom; `src/speech/speech.ts` no-ops
  when unsupported. Keep it that way or unit tests will break.
- The dev/preview servers run https (`@vitejs/plugin-basic-ssl`) because
  `speechSynthesis` needs a secure context when the app is opened from another
  device on the network. The plugin is disabled when `VITEST` is set —
  playwright rejects the self-signed certificate, so browser tests stay on
  http. Don't remove that gate.
- `vite.config.ts` is merged into `vitest.config.ts`, which is also what
  storybook builds with (`viteConfigPath` in `.storybook/main.ts`) — one config
  chain for dev, tests, and storybook.
- Run `pnpm lint:fix` before checking lint errors manually; biome auto-sorts
  keys/attributes and fixes most style complaints.
