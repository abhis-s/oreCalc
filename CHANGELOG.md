# Changelog

All notable changes to this project are documented below.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-10-07

### Added

- **ClashCalc Rebranding & Domain Transition**: Established `clashcalc.com` as the canonical domain with dual-brand backward compatibility and automated state migration from `orecalc.tech`.
- **Multi-Tool Landing Portal**: Added central landing portal (`/`) featuring active village overview, multi-account village switcher, and live progress indicators across all tools.
- **ZapQuake & Hero Equipment Damage Calculator**: Added tactical damage calculator (`/damage-calculator/`) with combinatorial and tactical building destruction solver, Pareto-optimal superset pruning, building HP and supercharge modeling, and the multi-defense Cluster Planner.
- **Hero's Journey Progression Tracker**: Added standalone Hero's Journey tracker (`/hero-journey/`) with interactive milestone track, quest chest ore yield models, and deterministic equipment unlock level resolution.
- **Passkeys & WebAuthn**: Integrated passwordless authentication using FIDO2/WebAuthn passkeys alongside existing Firestore cloud synchronization.
- **Multi-Tenant Partitioned Persistence**: Re-architected client storage into tag-partitioned storage keys for instantaneous zero-clone village switching.
- **Expanded Localization**: Added Turkish (`tr`) and Simplified Chinese (`zh`) localization alongside English and German.

---

## [2.0.0] - 2026-08-15

### Added

- **Four-Tier Unidirectional Architecture**: Restructured codebase into strict unidirectional architecture (`Data` -> `Domain` -> `Core` -> `UI`).
- **Component Display/Input Decoupling**: Decoupled all UI components into pure DOM display renderers (`*Display.js`) and isolated input controllers (`*Inputs.js`).
- **Transactional State Engine**: Implemented atomic transactional state mutations via `handleStateUpdate()` with subscriber notifications.
- **Multi-Currency Pricing Engine**: Added multi-currency cost calculations across 11 currencies with regional pricing overrides.
- **Continuous Deployment Pipeline**: Configured Google Cloud Run automated commit-based continuous deployment using Cloud Build triggers.
- **Automated Verification Infrastructure**: Deployed static AST scope checkers, unused export analyzers, TypeScript compile-time verification, and expanded test suite to 1,300+ permanent tests.

---

## [1.3.0] - 2025-08-08

### Added

- **Cloud Save and Sync**: Added user-controlled cloud data persistence using Firestore, allowing users to sync state across devices.
- **Grand Warden Epic Equipment**: Added support for the new Grand Warden Epic Equipment.

### Fixed

- **UI Tweaks**: Conditionally hide the player tag input `suggestions-separator` when only one player profile is saved.

---

## [1.2.0] - 2025-08-02

### Fixed

- **Fetching & Data Safety**: Resolved data corruption issue following tag fetches, and unified player state deep cloning.

---

## [1.1.0] - 2025-08-01

### Added

- **Free Supercell Medals**: Track free weekly event medals claimed from the Supercell Store.

### Changed

- **PWA Service Worker**: Optimized service worker caching to prevent storage bloat and ensure immediate activation.
- **Storage Optimization**: Streamlined JSON structures saved inside client localStorage.

---

## [1.0.0] - 2025-07-30

### Added

- **PWA Stale-While-Revalidate**: Configured service worker to use standard stale-while-revalidate caching and support force update reload loops.
- **Gem Trader Glowy Ores**: Integrated the 10 free weekly Glowy Ores from the Gem Trader in calculations.

### Fixed

- **Calculations & Equipment Tuning**: Corrected the base values for `equipmentCost` in the main database, and removed redundant shop offer calls.
- **Data Isolation**: Resolved tag data leakage when switching between multiple active accounts.
- **Cloud Build Injection**: Injected client environment API endpoints dynamically during compile-time.

---

## [0.2.0] - 2025-07-26

### Added

- **Core Project Setup**: Configured workspace files and CI/CD pipelines.

---

## [0.1.0] - 2025-07-25

### Added

- **Initial Commit**: Structured initial repository setup.
