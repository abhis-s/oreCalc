export const changelogData = [
    {
        version: "v2.2.0",
        date: "2026-08-22",
        changes: [
            { type: "feature", text: "<strong>4-Tier Unidirectional Architecture & Pure Domain Engine</strong>: Restructured the entire client into a strict 4-tier dependency architecture (Data &rarr; Domain &rarr; Core &rarr; UI), refactoring all domain calculators into 100% referentially transparent pure functions with zero side effects." },
            { type: "feature", text: "<strong>Display vs Input Controller Modularization</strong>: Decoupled UI components across all domains into pure DOM renderers (<code>*Display.js</code>) and interactive transactional controllers (<code>*Inputs.js</code>) to prevent layout thrashing and memory leaks." },
            { type: "feature", text: "<strong>Atomic Transactional State Mutations</strong>: Enforced atomic state updates via centralized <code>handleStateUpdate</code> callbacks with subscriber notifications, backward-compatible schema migrations, and defensive null guards." },
            { type: "feature", text: "<strong>Profile Onboarding & Setup Wizard</strong>: Introduced an interactive multi-step onboarding wizard for new and returning users, featuring synthetic Guest Mode player profile initialization and tour integration." },
            { type: "feature", text: "<strong>High-Signal Error Alerting & Throttling</strong>: Implemented an intelligent error telemetry engine with 10-minute cooldown deduplication for network drops, chunk reloads, 413s, and client exceptions, while suppressing noise and anonymous bot traffic." },
            { type: "feature", text: "<strong>Supercell Outage Lifecycle & Auto-Recovery</strong>: Integrated circuit breaker state tracking to dispatch automated 503 Outage alert emails and automatic RESOLVED recovery notifications when Supercell Clash API proxying resumes." },
            { type: "feature", text: "<strong>Compliance Tombstones & Inactivity Audit Logs</strong>: Added immutable Firestore server timestamps to account deletion records (<code>deletedUuids</code>) and automated execution audit logs (<code>pruneAuditLogs</code>) for database inactivity pruning." },
            { type: "feature", text: "<strong>Multi-Currency Pricing Engine</strong>: Added real-time multi-currency pricing calculation with custom tier support and live currency conversion across in-game resource packages." },
            { type: "feature", text: "<strong>Standalone Legal Pages & Dedicated Stylesheet</strong>: Generated standalone pre-rendered legal routes (<code>/privacy</code>, <code>/terms</code>, <code>/licenses</code>) compiled via a dedicated Sass pipeline with verified routing and German translations." },
            { type: "feature", text: "<strong>New Epic Equipment & August Content</strong>: Added full data models and icon assets for Dragon Duke's new epic equipment, <em>Revenge Deck</em>, launched in August 2026." },
            { type: "feature", text: "<strong>Browser Compatibility & Storage Notice</strong>: Built a non-intrusive warning banner alerting users if their browser engine is outdated or local storage permissions are restricted." },
            { type: "fix", text: "<strong>Overall Equipment Progress Percentage</strong>: Fixed the overall equipment progress bar calculation to compute the balanced arithmetic mean across Shiny, Glowy, and Starry ore tiers instead of being weighted by raw Shiny ore counts." },
            { type: "fix", text: "<strong>Planner Timeline Exhaustion & Priority List Memoization</strong>: Resolved prediction calculator simulation crashes by decoupling step inversions from timeline exhaustion, and added key-based hydration memoization to priority list scheduling." },
            { type: "fix", text: "<strong>Card Reordering Layout Repack</strong>: Resolved an undefined reference error during compact card drag-and-drop reordering, ensuring smooth layout packing." },
            { type: "chore", text: "<strong>Static Inline Script AST Validator</strong>: Integrated ESLint-powered static AST verification into the test and build pipeline to validate all inline <code>&lt;script&gt;</code> blocks across HTML templates." },
            { type: "chore", text: "<strong>100% Type Safety & Repository Invariant Suite</strong>: Achieved 100% repository-wide JSDoc contract coverage verified compile-time with TypeScript (<code>tsc --noEmit</code>), expanded automated test suite to 563+ tests across 135 suites, and synced latest community translations from Crowdin." }
        ]
    },
    {
        version: "v2.1.0",
        date: "2026-08-10",
        changes: [
            { type: "feature", text: "<strong>Hero's Journey Track & Ore Deductions</strong>: Introduced the Hero's Journey milestone progression track, featuring automatic calculation engine deductions from net upgrade costs." },
            { type: "feature", text: "<strong>Interactive Equipment Details Modal</strong>: Built a comprehensive equipment details modal displaying complete stat scaling, rarity indicators, recommendation badges (Must-Have, Recommended, Niche)." },
            { type: "feature", text: "<strong>Per-Profile Split Cloud Sync</strong>: Implemented granular per-profile cloud synchronization, enabling player accounts to be synced, restored, and updated independently in cloud storage." },
            { type: "feature", text: "<strong>Language Routing & Simplified Chinese Localization</strong>: Added localized URL-based routing (e.g., <code>/de/</code>, <code>/zh/</code>, <code>/tr/</code>), static pre-rendering (SSG), and complete Simplified Chinese (<code>zh-CN</code>) language support." },
            { type: "feature", text: "<strong>Stored Ores Badges & Tooltips</strong>: Added green indicator badges to stored ore fields with custom popover breakdowns for pending upcoming ores." },
            { type: "feature", text: "<strong>Gem Trader Input Fields</strong>: Replaced Gem Trader offer checkboxes with validated numeric input fields supporting up to 10 packs per type." },
            { type: "feature", text: "<strong>Security & Privacy Hardening</strong>: Enforced strict origin security headers, Content Security Policy (CSP), anti-clickjacking protection, automated client error telemetry, and updated privacy policy." },
            { type: "feature", text: "<strong>UI Physics & Gesture Animations</strong>: Upgraded tab navigation swipe gestures, layout physics, modal transition animations, and converted design tokens to unified Sass variables." },
            { type: "feature", text: "<strong>Data Model & Key-Based Lookups</strong>: Refactored hero and equipment lookups to a key-based data architecture for seamless internationalization and future content expansion." },
            { type: "feature", text: "<strong>Sync Version Compatibility & Auto-Update</strong>: Enforced version compatibility checks during cloud sync with automated client update flows on version mismatch." },
            { type: "feature", text: "<strong>New Content & Equipment Data</strong>: Added Dragon Duke epic equipment placeholders, updated Gem Trader ore costs, and updated default Supercell Event reward tables." },
            { type: "fix", text: "<strong>Mobile Popovers & Touch Optimization</strong>: Resolved touch event collisions, unified popover state handling, and optimized popover placement with screen boundary clamping." },
            { type: "fix", text: "<strong>Performance & Asset Optimization</strong>: Implemented conditional tab rendering, memoized priority list calculations, normalized asset canvases to 1:1 square aspect ratios, and added WebKit auto-healing for dynamic import failures." }
        ]
    },
    {
        version: "v2.0.0",
        date: "2026-07-02",
        changes: [
            { type: "feature", text: "<strong>Core Architecture Overhaul</strong>: Modularized the 1,200-line <code>index.html</code> into 27 partial templates, introduced an SVG sprite system, and implemented automatic state migration (<code>stateCleanup.js</code>) with decoupled localStorage partitioning." },
            { type: "feature", text: "<strong>Custom Chip System</strong>: Added a highly flexible custom chip creation module supporting 11 distinct chip types with advanced scheduling, assisted conversion, and dynamic placement rules." },
            { type: "feature", text: "<strong>Navigation & Layout Overhaul</strong>: Redesigned the navigation drawer and responsive layout with dynamic bottom nav rendering, customizable card layouts (Cozy, Cozy-Compact, and Compact Quilt), and layout drag-and-drop card reordering across tabs." },
            { type: "feature", text: "<strong>Priority Planner Enhancements</strong>: Integrated upgrade resource and bottleneck ore tooltips, suggested Town Hall-specific max levels, and added a toggle to hide or show suggestion messages." },
            { type: "feature", text: "<strong>Supercell Events & Income</strong>: Added a dynamic scheduler for Supercell Events (formerly Championship) with live-watch tracking, automated CWL background scraping, and dynamic war log recommendations." },
            { type: "feature", text: "<strong>Aesthetic & UI Personalization</strong>: Introduced an accent color picker (5 presets plus random generation), global pricing modals for per-currency customization, and monospace fonts for notice logs." },
            { type: "feature", text: "<strong>Security & GDPR Compliance</strong>: Implemented player tag protection and API token verification, backend hardening (CORS, Helmet, rate-limiting), and a GDPR-compliant global data erasure flow." },
            { type: "feature", text: "<strong>Transparency & Help Centers</strong>: Added a Google Cloud running costs transparency modal, open-source licenses page, onboarding welcome wizard with app tour, and a state-attaching bug report tool." },
            { type: "fix", text: "<strong>Calculations & UI Tuning</strong>: Resolved calculations lag by batching state changes, fixed timezone offset logic on Star Bonus events, corrected Prospector rounding drift, and fixed calendar lock/key bugs." },
            { type: "fix", text: "<strong>Accessibility & SEO</strong>: Cleaned up Lighthouse audit accessibility warnings (contrast, labels, touch targets) and unified meta tags, clean URLs, and canonical links." },
            { type: "chore", text: "<strong>Build & Deployment Pipeline</strong>: Migrated build system to a <code>pnpm</code> workspace with Docker and Google Cloud Build integration, and pruned 19 obsolete dead files." },
            { type: "chore", text: "<strong>PWA Indicator & Auto-Update</strong>: Enabled forced service worker updates with client-facing update-available indicators to prevent local caching issues." }
        ]
    },
    {
        version: "v1.3.0",
        date: "2025-08-08",
        changes: [
            { type: "feature", text: "<strong>Cloud Save and Sync</strong>: Added user-controlled cloud data persistence using Firestore, allowing users to sync state across devices." },
            { type: "feature", text: "<strong>Grand Warden Epic Equipment</strong>: Added support for the new Grand Warden Epic Equipment." },
            { type: "fix", text: "<strong>UI Tweaks</strong>: Conditionally hide the player tag input <code>suggestions-separator</code> when only one player profile is saved." }
        ]
    },
    {
        version: "v1.2.0",
        date: "2025-08-02",
        changes: [
            { type: "fix", text: "<strong>Fetching & Data Safety</strong>: Resolved data corruption issue following tag fetches, and unified player state deep cloning." }
        ]
    },
    {
        version: "v1.1.0",
        date: "2025-08-01",
        changes: [
            { type: "feature", text: "<strong>Free Supercell Medals</strong>: Track free weekly event medals claimed from the Supercell Store." },
            { type: "chore", text: "<strong>PWA Service Worker</strong>: Optimized service worker caching to prevent storage bloat and ensure immediate activation." },
            { type: "chore", text: "<strong>Storage Optimization</strong>: Streamlined JSON structures saved inside client localStorage." }
        ]
    },
    {
        version: "v1.0.0",
        date: "2025-07-30",
        changes: [
            { type: "feature", text: "<strong>PWA Stale-While-Revalidate</strong>: Configured service worker to use standard stale-while-revalidate caching and support force update reload loops." },
            { type: "feature", text: "<strong>Gem Trader Glowy Ores</strong>: Integrated the 10 free weekly Glowy Ores from the Gem Trader in calculations." },
            { type: "fix", text: "<strong>Calculations & Equipment Tuning</strong>: Corrected the base values for <code>equipmentCost</code> in the main database, and removed redundant shop offer calls." },
            { type: "fix", text: "<strong>Data Isolation</strong>: Resolved tag data leakage when switching between multiple active accounts." },
            { type: "chore", text: "<strong>Cloud Build Injection</strong>: Injected client environment API endpoints dynamically during compile-time." }
        ]
    },
    {
        version: "v0.2.0",
        date: "2025-07-26",
        changes: [
            { type: "chore", text: "<strong>Core Project Setup</strong>: Configured workspace files and CI/CD pipelines." }
        ]
    },
    {
        version: "v0.1.0",
        date: "2025-07-25",
        changes: [
            { type: "chore", text: "<strong>Initial Commit</strong>: Structured initial repository setup." }
        ]
    }
];
