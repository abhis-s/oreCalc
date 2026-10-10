# Contributing to ClashCalc

We welcome contributions to ClashCalc (formerly OreCalc)! To maintain code quality, architectural integrity, and reliability across our multi-tool suite, please follow these guidelines.

---

## Development Setup

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (v22+) and [pnpm](https://pnpm.io/) (v11+) installed.
   > [!IMPORTANT]
   > **pnpm is Required**: ClashCalc uses a monorepo workspace configuration (`pnpm-workspace.yaml`). Running `npm` or `yarn` is blocked by repository guardrails to preserve workspace bindings and lockfile integrity.

2. **Installation**: Clone the repository and install workspace dependencies:

   ```bash
   pnpm install
   ```

3. **Running the Development Server**: Start the local development server (live-reload at `http://localhost:8080` with SCSS compilation and JS watchers):

   ```bash
   pnpm dev
   ```

   To run the backend API server concurrently (at `http://localhost:3000`):

   ```bash
   pnpm --filter orecalc-server start
   ```

4. **Running Verification Suites**:

   ```bash
   pnpm test
   ```

5. **Building for Production**:

   ```bash
   pnpm run build
   ```

---

## Git & Branching Workflow

1. Create a descriptive branch from `clashcalc` / `main`:
   - `feat/your-feature-name` for new features or capabilities.
   - `fix/bug-description` for bug fixes.
   - `chore/task-name` for build, dependencies, or maintenance.
2. Use **Conventional Commits** for commit messages (e.g. `feat(damage): add supercharge tier calculation` or `fix(storage): resolve partition normalization`).

---

## Architectural & Coding Standards

### 1. Four-Tier Unidirectional Dependency Architecture

Code in ClashCalc flows unidirectionally across four distinct tiers:

$$\text{Data} \longrightarrow \text{Domain} \longrightarrow \text{Core} \longrightarrow \text{UI / Components}$$

- **Data (`js/data/`)**: Static game metadata, equipment progression curves, levels, and constants. Pure data exports with zero runtime dependencies.
- **Domain (`js/domain/`)**: Pure, referentially transparent mathematical algorithms and solvers (e.g., `zapQuakeSolver.js`, `oreCalculator.js`, `heroJourneyResolution.js`). Domain functions must never touch the DOM, `localStorage`, or external services.
- **Core (`js/core/`)**: Transactional state management (`state.js`), multi-tenant storage partitioning (`playerStorageManager.js`), schema migrations (`stateCleanup.js`), and cross-tab reactive synchronization.
- **UI / Components (`js/components/`)**: Modular user interface renderers and input controllers.

### 2. Component Split & Suffix Conventions

- **Strict UI and Logic Separation**: Components must be split into:
  - `*Display.js`: Pure DOM construction and visual output. Never attach event listeners in display modules.
  - `*Inputs.js`: User input listeners, click handlers, validation, and state dispatchers.
- **Strict Suffixing**: Component filenames must end with either `Display.js` or `Inputs.js`.
- **HTML Templates**: Entry templates (`index.html`, `ore-calculator/index.html`, `hero-journey/index.html`, `damage-calculator/index.html`) are minimal shells using compile-time includes under `partials/` (injected via `<!-- include: partials/... -->`).

### 3. State & Data Management

- **Single Source of Truth**: All runtime state lives in the reactive `state` object exported from `js/core/state.js`. Update state and dispatch subscriber re-renders using `handleStateUpdate()`.
- **Partitioned Storage**: Never access `localStorage` directly. All player data is partitioned by player tag through `js/core/playerStorageManager.js`.
- **Schema Migrations**: Schema modifications must include an idempotent migration block inside `js/core/stateCleanup.js`.

### 4. UI Constraints & Safety

- **No Native Dialogs**: Do not call `alert()`, `confirm()`, or `prompt()`. Import modal controllers from `js/ui/noticeModal.js`.
- **Zero Inline Styles in HTML**: All presentation rules belong in SCSS stylesheets. Elements should be hidden using the boolean `hidden` attribute or declarative CSS classes (`.is-hidden`).
- **Number & Currency Formatting**: Use `formatCurrency()` or `formatNumber()` from `js/utils/numberFormatter.js` rather than raw `toLocaleString()`.
- **Offline Self-Containment**: External CDN script or style tags are strictly prohibited. All assets and dependencies are bundled locally.

---

## CSS & Sass Variable System

ClashCalc enforces a three-tier variable hierarchy to maintain visual consistency across themes:

1. **Primitive Palette (`$palette-*` / `--palette-*`)**: Core color scales defined in `css/abstracts/_palette.scss`. Never reference these directly in component styles.
2. **Semantic Tokens (`$text-primary`, `$bg-surface-primary`, `$border-primary`, `$accent-primary`)**: Functional design tokens defined in `css/abstracts/_variables.scss`. Component stylesheets must exclusively reference these tokens.
3. **Component Overrides**: Local CSS variables used only for scoped, instance-specific overrides.

Never reuse semantic tokens for unrelated properties (e.g. do not use `$text-primary` for borders; use `$border-primary`).

---

## Localization & Internationalization

- **Zero Hardcoded Visible Strings**: Every user-facing string must route through the translation engine (`js/i18n/translator.js`).
- **Reference Locales**: Add canonical keys in alphabetical order to `js/i18n/en.json` (English) and `js/i18n/de.json` (German).
- **Community Locales**: Community translations for Turkish (`tr.json`) and Chinese (`zh.json`) are managed via Crowdin. Do not create machine-translated strings for community locales directly.

---

## Pull Request Checklist

Before submitting a pull request, verify:

- [ ] `pnpm test` passes cleanly (asserts variable scopes, unused exports, TypeScript checks, feature suites, and i18n dictionary parity).
- [ ] `pnpm run build` compiles with exit code 0 and generates the production Service Worker precache.
- [ ] All new files terminate with a single trailing newline (`\n`) and contain zero trailing whitespace.
- [ ] All user-facing strings are defined in `en.json` and `de.json`.
- [ ] No prohibited emojis, dingbats, or hardcoded inline styles have been added.
