# Changelog

All notable changes to this project are documented below.

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
