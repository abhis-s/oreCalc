export const changelogData = [

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
