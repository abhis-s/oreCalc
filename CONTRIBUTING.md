# Contributing to OreCalc

We welcome contributions to OreCalc! To maintain codebase quality, consistency, and alignment with our architecture, please follow these guidelines.

---

## 🚀 Development Setup

1. **Prerequisites**: Ensure you have Node.js and [pnpm](https://pnpm.io/) installed.
   > [!IMPORTANT]
   > **pnpm is Required**: OreCalc uses a monorepo workspace configuration (`pnpm-workspace.yaml`) for parallelized build flows and optimal shared dependency allocation. Running `npm install` will generate a generic `package-lock.json`, which breaks workspace bindings and is strictly forbidden.
2. **Installation**: Clone the repository and install the workspace dependencies:

   ```bash
   pnpm install
   ```

3. **Running Dev Server**: Start the local development server (running on `http://localhost:8080`):

   ```bash
   pnpm dev
   ```

4. **Building for Production**:

   ```bash
   pnpm run build
   ```

---

## 📂 Git & Branching Workflow

1. Create a descriptive branch from `main`:
   * `feat/your-feature-name` for new features.
   * `fix/bug-description` for bug fixes.
   * `chore/task-name` for build, dependencies, or routine maintenance.
2. Use **Conventional Commits** for commit messages (e.g. `feat(planner): add hide/unhide toggle` or `fix(storage): resolve state migration leakage`).

---

## 💻 Coding Standards

### 1. Component Architecture & Suffixes

* **Split UI and Logic**: Do not write monolithic components. Code must be split into:
  * `*Display.js` — Core rendering, DOM updates, visual output.
  * `*Inputs.js` — Event handlers, validation bindings, user input logic.
* **Consistently Suffix**: Component files must end with either `Display.js` or `Inputs.js`. Do not use terms like `Selector`, `Handler`, or `Observer` in component filenames.
* **HTML Templates**: Main `index.html` is a minimal shell. Use compile-time includes under `partials/` (injected via `<!-- include: path/to/partial.html -->`).

### 2. State & Data Management

* **Single Source of Truth**: All app state lives in the `state` object exported from `js/core/state.js`. Update state and trigger re-renders using `handleStateUpdate()`.
* **State Migrations**: If your feature changes the schema of saved data, you must add an idempotent migration block inside [stateCleanup.js](js/core/stateCleanup.js).
* **Local Storage**: Never access `localStorage` directly. Always use the interface provided by [localStorageManager.js](js/core/localStorageManager.js).

### 3. Naming Conventions

* **JavaScript**: Use `camelCase` for variables, files, and functions. Use `PascalCase` for classes and Custom Elements.
* **SCSS & CSS**: Use `kebab-case` for stylesheets (e.g., `_income-chips.scss`).
* **DOM IDs**: Always prefix elements with their section namespace (e.g. `settings-theme-toggle` instead of `theme-toggle`).
* **Translation Keys**: Use lowercase dot-separated paths (e.g. `income.starBonus.title`). Never use flat snake_case.

### 4. UI Safety Constraints

* **No Native Dialogs**: Do not call `alert()`, `confirm()`, or `prompt()`. Import and use `showAlert` or `showConfirm` from `js/ui/noticeModal.js`.
* **Try-Finally Loading States**: Wrap network calls or asynchronous actions in `try...finally` to ensure spinners and disabled buttons are restored on error.
* **Number Formatting**: Do not use `toLocaleString()` directly. Use `formatCurrency()` or `formatNumber()` from [numberFormatter.js](js/utils/numberFormatter.js).
* **PWA & Offline Integration**: All dependencies must be local. CDNs or external script loads in HTML templates are strictly prohibited.

---

## 🎨 CSS & Sass Variable System

OreCalc relies on a strict, three-tier variable hierarchy to enforce visual harmony and runtime themes:

1. **Primitive Palette (`$palette-*` / `--palette-*`)**: Core color scales defined in `css/abstracts/_palette.scss`. **Never reference these directly in component styles.**
2. **Semantic / Functional Mappings (`$text-primary`, `$bg-surface-primary`, `$accent-primary`)**: Semantic tokens defined in `css/abstracts/_variables.scss`. **Component SCSS files must exclusively reference these.**
3. **Component Overrides**: Local CSS variables used only for unique overrides.

### Styling Rules

* Use Sass variable mappings (e.g. `$text-primary`) rather than raw CSS custom properties (e.g. `var(--text-primary)`) to ensure compile-time check validation.
* Never recycle semantic variables for unrelated purposes just because the color matches (e.g. do not use `$text-primary` for borders; use `$border-primary`).

---

## 🌐 Localization & Copy

* **Zero Hardcoded User-Visible Strings**: Every user-facing label or status must be translated.
* Add your keys to both [js/i18n/en.json](js/i18n/en.json) (English) and [js/i18n/de.json](js/i18n/de.json) (German). Use English as a fallback for German if the translation is pending.

---

## 🏁 Pull Request Checklist

Before submitting your PR:

* [ ] Run `pnpm run build` to verify there are no compilation or service worker configuration errors.
* [ ] Ensure formatting aligns with the project's spacing (set up automatically if your editor respects the `.editorconfig`).
* [ ] Verify that all user-visible copy is routed through the translation system.
