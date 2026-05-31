export const changelogData = [

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
