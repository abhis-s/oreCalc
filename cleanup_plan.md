# OreCalc — Comprehensive Stepwise Cleanup Plan

## 1. Executive Summary & Strategy

This document establishes the official execution sequence for code and repository cleanup across the OreCalc codebase.

Because changes in one subsystem ripple into others (for example, removing an HTML element can orphan a CSS rule, a JS event listener, and a translation key), cleanups must execute in a strict, dependency-ordered sequence. Executing cleanups out of order causes false positives, broken references, and unnecessary rework.

### Core Cleanup Invariant Protocols
1. **Disabled & Commented-Out Code Safeguard**: Commented-out JavaScript, CSS, or HTML blocks must **never** be deleted automatically. An audit report of all commented-out code must be presented to the user for explicit authorization prior to deletion. Automated cleanup tooling must explicitly exclude commented-out code blocks.
2. **JSDoc Preservation**: Functional JSDoc type contracts (`@param`, `@returns`, `@type`, `@typedef`) are mandatory for static type safety and must never be deleted or degraded during comment cleanups.
3. **HTML Dynamic Placeholder Registry**: Dynamic insertion comments in templates must strictly match the Reference Table in `.agents/html-documentation-and-commenting.md`. Any discrepancy or missing entry must be escalated to the user before modification.
4. **Empirical Translation Key Audit**: Translation keys must never be purged based on shallow substring matching. Every key marked for deletion must be empirically verified against exact token matches, dynamic template literals (`${...}`), partials, server files, and tests.
5. **Read-Only Git Operations**: No mutating git commands (`git checkout`, `git restore`, `git reset`, `git clean`, `git stash`, etc.) may ever be run.
6. **No Non-JSON Modification Scripts**: Code modifications must be made via transparent editor tool calls (`replace_file_content`, `write_to_file`), not opaque bulk scripts.
7. **POSIX EOF Trailing Newline**: Every touched or generated file must terminate with exactly one newline character (`\n`) and contain zero trailing blank lines.

---

## 2. Stepwise Cleanup Execution Order

The cleanups are partitioned into 7 sequential phases ordered by architectural dependency.

```text
Phase 1: Stray & Ephemeral Artifacts Hygiene
   ↓
Phase 2: HTML Templates & Dynamic Placeholder Hygiene
   ↓
Phase 3: SCSS Stylesheets & Design Token Hygiene
   ↓
Phase 4: JavaScript Architecture, Dead Code & Comment Hygiene
   ↓
Phase 5: Localization & Translation Dictionary Hygiene
   ↓
Phase 6: Static Assets & Scratch Workspace Audits
   ↓
Phase 7: Permanent Test Suites & Verification Gate
```

---

### Phase 1: Stray & Ephemeral Artifacts Hygiene [COMPLETED]
* **Objective**: Remove transient developer residue, temporary dumps, build scratchpads, ad-hoc implementation tests, and synthetic mini-DOM mock engines.
* **Completed Actions**:
  - Root Artifacts: Deleted stray root sourcemap `test.css.map`.
  - Ad-Hoc & Synthetic Tests Removed:
    - `tests/core/consoleTourDebug.test.js` (untracked ad-hoc debug test file deleted).
    - `tests/core/headerSpaceConstrainedLayout.test.js` (synthetic DOM layout test deleted).
    - `tests/core/heroJourneyFilterRecovery.test.js` (synthetic DOM layout test deleted).
    - `tests/core/deviceSyncAccordion.test.js` (synthetic DOM accordion test deleted).
    - `tests/core/navigationDrawerLifecycle.test.js` (synthetic DOM lifecycle test deleted).
    - `tests/core/navigationDrawerContent.test.js` (synthetic DOM content test deleted).
    - `tests/helpers/mockDrawerDom.js` (334-line synthetic mini-DOM engine deleted).
  - Permanent Suite Pruning:
    - `tests/core/damageCalcDeckMeterAndTradeoffs.test.js`: Pruned touch swipe simulation and `_dock.scss` file read.
    - `tests/core/layoutViewportContracts.test.js`: Pruned test-local popover math algorithm and tests.
    - `tests/core/heroJourneyStandalone.test.js`: Pruned synthetic `clientWidth` header layout test block.
    - `tests/core/appHeader.test.js`: Pruned synthetic `clientWidth` responsive geometry test block.
    - `tests/core/elementHighlighter.test.js`: Pruned brittle regex source inspections on HTML and JS files.
    - `tests/core/cssArchitectureQuality.test.js`: Pruned checks for obsolete deleted modal files and selectors.
    - `tests/core/jsArchitectureQuality.test.js`: Pruned obsolete cpx regex and 150 lines of unused mock DOM scaffolding.
  - Dead / Unused Exports Cleaned:
    - Cleaned unexported symbols in `settingsDeviceSyncInputs.js`, `navigationDrawerRenderer.js`, `navigation.js`, `header.js`, `heroJourneyHeaderDisplay.js`, and `appHeader.js`.
  - Rule Documentation: Updated `.agents/AGENTS.md` Rule 7 with invariant guidance on keeping ad-hoc tests in `tests/temp/`.
  - Verification: 100% of test suites pass (`pnpm test`: 1321 tests pass, 0 fail), zero unused exports (`scripts/check-unused-exports.js`), static scopes pass (`scripts/check-undefined-vars.js`), and production build completes cleanly (`pnpm run build`).
* **Exit Criteria**: Working tree is free of ephemeral scratch files; test runner only discovers permanent suites. [SATISFIED]

---

### Phase 2: HTML Templates & Dynamic Placeholder Hygiene [COMPLETED]
* **Objective**: Establish the clean DOM foundation that dictates CSS selector usage, JS query bindings, and UI translation keys.
* **Target Locations**:
  - Root and entry templates: `index.html`, `hero-journey/index.html`, `ore-calculator/index.html`.
  - Template partials: `partials/header.html`, `partials/header-account.html`, `partials/tabs/*.html`, `partials/modals/*.html`, `partials/svg-sprites.html`, `partials/watchdog.html`, etc.
* **Completed Actions**:
  - **Comment Hygiene**: Purged all prohibited developer comments across `partials/modals/auth-modal.html`, `partials/modals/guided-setup-modal.html`, and `partials/tabs/settings.html`.
  - **Dynamic Placeholder Registry Sync**: Verified and aligned canonical placeholders in `.agents/html-documentation-and-commenting.md`.
  - **Commented-Out HTML Audit**: Verified 0 instances across all templates.
  - **Display/Hidden Architecture Migration (HTML)**:
    - Eradicated 100% of inline `style="display: none;"` (and any other inline `style="..."` attributes) across all HTML templates and partials (79/79 occurrences migrated).
    - Converted static sprite/file inputs to declarative CSS classes (`.svg-sprite-sheet`, `.file-input-hidden`).
    - Converted all dynamic sections, modals, steps, buttons, badges, and progress indicators to native boolean `hidden` attributes.
* **Exit Criteria**: HTML templates are 100% semantic, contain only valid build directives and registered dynamic insertion placeholders, and have 0 inline `style="..."` attributes. [SATISFIED]

---

### Phase 3: SCSS Stylesheets & Design Token Hygiene [COMPLETED]
* **Objective**: Enforce declarative CSS visibility rules, maintain 3-tier variable discipline, eliminate magic values, and standardize comment landmarks.
* **Completed Actions**:
  - **Declarative Visibility Architecture**:
    - Centralized `[hidden], .hidden, .is-hidden { display: none !important; }` in `css/base/_elements-reset.scss`.
    - Added design tokens and rules for `.svg-sprite-sheet` and `.file-input-hidden`.
  - **Guardrail Invariant Test**:
    - Updated `tests/core/cssArchitectureQuality.test.js` to strictly assert 0 inline style attributes across all templates/partials (`index.html`, `hero-journey/index.html`, `ore-calculator/index.html`, `partials/`).
* **Exit Criteria**: Stylesheets compile cleanly with 0 warnings, enforce declarative visibility, and inline HTML styles are permanently guarded against regression. [SATISFIED]

---

### Phase 4: JavaScript Architecture, Dead Code & Comment Hygiene [COMPLETED]
* **Objective**: Prune dead code, standardize comments, preserve JSDoc contracts, enforce unidirectional tier architecture, verify pure display modules, and standardize modern JavaScript idioms.
* **Completed Actions**:
  - **Comment Syntax Standardization**:
    - Purged inline multi-line block comment (`/* Node.TEXT_NODE */`) in `js/components/appSettings/settingsAccountDisplay.js`.
    - Removed decorative ASCII banner dividers (`// --- ... ---`) in `js/utils/predictionCalculator.js` and `js/components/income/prospectorInputs.js`.
    - Converted numbered workflow step comments (`// 1.`, `// 2.`, etc.) into concise engineering rationales across `js/components/damage/damageCalcPopoversInputs.js`, `js/components/damage/damageCalcClusterTargetCardsDisplay.js`, `js/domain/income/heroJourneyResolution.js`, `js/services/authClientService.js`, `js/domain/damage/zapQuakeSolver.js`, `server/services/alertThrottle.js`, `server/routes/supportRoutes.js`, `scripts/dev/run-dev.js`, `scripts/check-unused-exports.js`, and `scripts/check-undefined-vars.js`.
    - Purged self-evident operation echoes (`// Update row DOM`, `// Initialize if missing`, `// Update tooltip HTML content`, etc.) across `js/components/` while strictly preserving non-obvious engineering notes.
  - **JSDoc Type Contract Invariant**: Verified 100% preservation of all `@param`, `@returns`, `@type`, and `@typedef` contracts compile-time via `tsc --noEmit` (`checkJs: true`).
  - **Commented-Out Code Audit**: Audited repository and verified **0 commented-out code blocks** exist in first-party JavaScript modules.
  - **Modern JavaScript Idioms**: Standardized all 11 remaining occurrences of legacy `array[array.length - 1]` to native `array.at(-1)` across `guidedSetupModalInputs.js`, `levelSelectModal.js`, `autoPlaceWarPlacer.js`, `chipFactory.js`, `autoPlaceHistoryPlacer.js`, `chipDragDropTargetValidator.js`, `chipManager.js`, and `apply-taxonomy-migration.js`.
  - **Dead Code & Reachability**: Verified 100% active consumption of all 1,065 exports across 322 JS modules (`scripts/check-unused-exports.js`) and 0 undefined variables (`scripts/check-undefined-vars.js`).
* **Exit Criteria**: `tsc --noEmit`, `check-unused-exports.js`, and `moduleDependencyGraph.test.js` pass with 0 errors. [SATISFIED]

---

### Phase 5: Localization & Translation Dictionary Hygiene
* **Objective**: Remove confirmed orphaned translation keys, eliminate duplicate string values in English, ensure strict A–Z ordering, and maintain locale parity without corrupting foreign translations.
* **Target Locations**:
  - Canonical source: `js/i18n/en.json`
  - Mirror locale: `js/i18n/de.json`
  - Community locales (structural parity only): `js/i18n/tr.json`, `js/i18n/zh.json`
* **Execution Steps**:
  1. **Empirical Dead Key Audit**: Verified 27 dead translation keys across the codebase with exact token matching and zero active consumers.
  2. **English Value Deduplication**: Verified 0 unauthorized duplicate strings in `en.json`; all 17 duplicate values strictly justified and allowlisted in `ALLOWED_DUPLICATE_KEYS`.
  3. **Anti-False-Friend Audit**: Audited German, Turkish, and Chinese translations; zero linguistic false-friends consolidated.
  4. **Locale Parity & A–Z Sorting**: Pruned 27 dead keys across `en.json` (1,305 keys) and `de.json` (1,305 keys), and pruned 18 obsolete keys across `tr.json` (963 keys) and `zh.json` (963 keys) for structural schema alignment. Strictly 0 AI translations generated for community locales.
  5. **Empty Parent Cleanup**: Cleaned up empty parent containers (`views.settings.theme`, `player.warPreference`, `views.settings.dataErasure.explanations`) while strictly preserving containers with active siblings.
* **Exit Criteria**: `scripts/validate-i18n.js` and `tests/core/i18nDuplicateValues.test.js` pass with 0 errors. [SATISFIED]

---

### Phase 6: Static Assets & Scratch Workspace Audits
* **Objective**: Verify image asset integrity, eliminate orphaned assets, and ensure clean workspace hygiene.
* **Target Locations**:
  - `assets/` (and subdirectories: `buildings/`, `equipment/`, `guardians/`, `heroes/`, `magicItems/`, `resources/`, `skins/`, `spells/`, `supercharge/`, `th/`, `avatars/`)
  - `scratch/`
  - `partials/svg-sprites.html`
* **Completed Actions**:
  1. **Asset Reference Audit**: Audited all 427 PNG image assets in `assets/` across 11 subdirectories against code, data, markup, and build configurations. Verified **100% active consumption (0 orphaned assets)**.
  2. **Asset Provenance & Rule 17 Invariant Compliance**: Verified 0 image files exist outside `assets/` and 0 AI generative watermarks (SynthID, C2PA, prompt metadata) exist in project assets.
  3. **SVG Sprite Sheet Pruning**: Pruned 8 confirmed unreferenced SVG symbols from `partials/svg-sprites.html` (`paste`, `cloud-upload`, `gavel`, `attribution`, `policy`, `sparkles`, `star`, `user-check`) following explicit user approval. Verified all 104 remaining symbols with `tests/core/svgSpriteIntegrity.test.js`.
  4. **Scratch Workspace Hygiene**: Removed intermediate `scratch/temp/md/portal-pendant.md` and pruned empty directory `scratch/temp/md/`. Verified `scratch/stat_key_alias_map.json` is 100% intact and untouched (99 entries).
  5. **Legacy Directory Cleanup**: Removed empty untracked legacy `public/` directory.
* **Exit Criteria**: Zero orphaned assets in `assets/`, zero AI metadata, pristine scratch isolation, and 104 verified SVG symbols. [SATISFIED]

---

### Phase 7: Permanent Test Suites & Verification Gate
* **Objective**: Verify test architecture compliance, check POSIX clean EOF formatting repo-wide, and pass the complete automated build and test pipeline.
* **Target Locations**:
  - `tests/core/`
  - `tests/domain/`
  - Root configuration and source files across the entire repository
* **Completed Actions**:
  1. **Consolidation of Redundant Modal Test Modules**:
     - Deleted redundant 416-line module `tests/core/dialogModalLayering.test.js` containing prohibited brittle regexes and ad-hoc checks.
     - Migrated the single genuine unit test (`getAddPlayerHelpContent` dynamic guided setup paragraph) into `tests/core/playerDropdownDisplay.test.js`.
  2. **Ad-Hoc Directory Scanner Pruning**:
     - Pruned ad-hoc `fs.readdirSync` test scanning `js/components/equipment` and `js/components/damage` for `.toLocaleString(` in `tests/core/regionalNumberFormatting.test.js`.
  3. **Deleted-Item Assertions Pruning (Rule 7 Ban)**:
     - Pruned deleted tab assertions (`defense_board`, `equipment`, `simulator`) from `tests/core/damageCalcHeaderAndBase.test.js`.
     - Pruned deleted guest mode assertions (`guided-setup-identity-mode-selector`, etc.) from `tests/core/guidedSetupModal.test.js`.
     - Pruned deleted accordion button assertions from `tests/core/headerAccountPopoverParity.test.js`.
     - Pruned obsolete notice style assertions from `tests/core/appFooter.test.js`.
  4. **Brittle Source-Code Regex Inspection Pruning**:
     - Pruned 5 tests reading first-party JS modules with `fs.readFileSync` in `tests/core/htmlArchitectureQuality.test.js` (`levelSelectModalDisplay.js`, `inputPopoverProvider.js`, `cardHelpPopover.js`, `chipFactory.js`, `calendarMilestonesRenderer.js`).
  5. **POSIX Trailing Newlines & Invariants**:
     - Verified all 11 universal repository invariants pass with `node --test tests/core/repositoryInvariants.test.js`.
  6. **Full Pipeline Execution**:
     - Ran and passed complete Final Consolidation Gate (`check-undefined-vars.js`, `check-unused-exports.js`, `tsc --noEmit`, `moduleDependencyGraph.test.js`, `validate-i18n.js`, `i18nDuplicateValues.test.js`, `svgSpriteIntegrity.test.js`, `cssArchitectureQuality.test.js`, `pnpm test`: 1305/1305 passed across 187 suites, `pnpm run build`: Exit 0, 504 assets precached, 7.33 MB).
* **Exit Criteria**: 100% of test suites pass, build completes with 0 errors, and the repository is completely clean and invariant-compliant. [SATISFIED]
