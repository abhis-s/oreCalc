# Changelog

All notable changes to this project are documented below.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.0] - 2026-11-05

### Added

- **Dedicated Account Management Center**: Introduced a standalone Account Center (`/account/`) featuring hero avatar customization, dual-mode credential management (passwords and biometric WebAuthn passkeys), active session tracking with remote device revocation, full profile data export, and self-service account deletion.
- **App Management & Device Diagnostics**: Added a dedicated diagnostics portal (`/app-management/`) providing live network telemetry, PWA installation status and platform guidance, service worker cache control, storage partition inspection, and client-side update controls.
- **Persistent App Shell & Brand Switcher**: Built a persistent client-side application shell across all tools (Hub, Ore Calculator, Hero's Journey, Damage Calculator, Account, App Management) with seamless view transitions, stationary header and drawer chrome, an accessible brand tool switcher dropdown, and responsive brand pill compaction.
- **Cloudflare Pages Staging Deployment**: Configured direct automated staging deployments to `beta.clashcalc.com` via Cloudflare Wrangler with zero-downtime edge caching.

### Changed

- **Default Branch Migration**: Transitioned repository default branch to `main`, establishing `orecalc-legacy` for legacy OreCalc maintenance.
- **Google Cloud CI/CD Optimization**: Configured path-isolated Cloud Build triggers (`server/**` for API vs frontend ignore rules), upgraded build compute to `E2_STANDARD_2` (2 vCPUs, 8 GB RAM) within Google Cloud's free tier, and modernized pipeline definitions to Google Artifact Registry.
- **UI State Standardization**: Standardized `.is-active` state classes across component switches and navigation elements, retired legacy settings tab in favor of reactive troubleshooting, and unified Town Hall badges.
- **Package Manager Pinning**: Pinned `pnpm@11.3.0` across workspace packages and container Dockerfiles to ensure deterministic reproducibility.
- **Crowdin Localization**: Upgraded `@crowdin/cli` to `v5.6.0` and aligned multi-branch translation synchronization across English, German, Turkish, and Chinese.

### Fixed

- **Mobile Brand Compaction**: Eliminated viewport boundary oscillation with a hysteresis buffer and preserved header element dimensions on small screens down to 350px.
- **Service Worker Lifecycle**: Enforced root-absolute favicon and asset paths to prevent subroute 404 errors during progressive web app updates.
- **Test Suite Contracts**: Pruned brittle regex tests, replaced synthetic DOM mocks with strict business logic and accessibility contract assertions, expanding test suite to 1,640 passing unit tests.

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
