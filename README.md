# spake

**Live at <https://madmaw.github.io/spake/>** — installable as a PWA from
there (pushes to `main` deploy automatically via GitHub Actions).

A speaking aid for when you've lost your voice. The app opens straight into a
3D radial word cloud of the most likely next words. Tapping a word speaks it
immediately and re-centres the predictions on it, so you can chain together
sentences at near conversational speed without typing. Whole sentences can be
replayed, and saved to a favourites tab for one-tap phrases.

The app is an installable PWA and works fully offline once loaded (note that
service workers require a trusted origin, so installing from the dev server's
self-signed certificate only works where the browser exempts localhost).
Speech uses the browser's built-in `speechSynthesis` API — no network, no
accounts. Predictions come from three layers: bigrams learned from your own
sentences (stored in `localStorage`), a curated conversational set tailored to
resting a lost voice, and general-English bigrams generated from [Peter
Norvig's Google Web Trillion Word Corpus counts](https://norvig.com/ngrams/)
(`pnpm data:bigrams` regenerates `src/prediction/bigrams.generated.ts`).

## Stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) (with React Compiler)
- [React Three Fiber](https://r3f.docs.pmnd.rs) + [drei](https://drei.docs.pmnd.rs) for the 3D word cloud
- [Vitest](https://vitest.dev) — unit tests (happy-dom) and storybook tests (headless Chromium)
- [Storybook](https://storybook.js.org)
- [Biome](https://biomejs.dev) (format + lint) and type-checked [ESLint](https://eslint.org)

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | start the dev server on <http://localhost:3000> |
| `pnpm test` | run unit tests |
| `pnpm test:storybook` | run storybook tests in headless Chromium |
| `pnpm storybook` | start storybook |
| `pnpm check-types` | typecheck everything |
| `pnpm lint` / `pnpm lint:fix` | biome + eslint |
| `pnpm build` | typecheck and build to `dist/` |
| `pnpm all` | install, typecheck, lint, test, build |

## Layout

- `src/prediction` — next-word prediction (curated bigrams + learned bigrams)
- `src/speech` — `speechSynthesis` wrapper and voice settings
- `src/favourites` — saved phrases, persisted to `localStorage`
- `src/components` — the word wheel, sentence bar, tabs, and favourites panel
- `src/**/specs` — tests (`*.tests.ts`) and stories (`*.stories.tsx`)
