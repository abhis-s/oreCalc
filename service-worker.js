// A new version number for the cache is essential to trigger an update.
const CACHE_NAME = 'ore-calculator-cache-v3';

const urlsToCache = [
    // Core files
    '/',
    '/index.html',
    '/css/main.css',
    '/assets/favicon.png',

    // JavaScript files: To be replaced with minified version
    '/js/core/renderer.js',
    '/js/core/oreCalculator.js',
    '/js/core/timeCalculator.js',
    '/js/core/localStorageManager.js',
    '/js/core/state.js',
    '/js/core/calculator.js',
    '/js/console.js',
    '/js/utils/incomeUtils.js',
    '/js/utils/responsiveTextHandler.js',
    '/js/utils/inputValidator.js',
    '/js/utils/versioning.js',
    '/js/components/layout/tabs.js',
    '/js/components/layout/header.js',
    '/js/components/layout/modeToggle.js',
    '/js/components/fab/fab.js',
    '/js/components/income/cwlDisplay.js',
    '/js/components/income/clanWarDisplay.js',
    '/js/components/income/incomeCardHandler.js',
    '/js/components/income/cwlInputs.js',
    '/js/components/income/eventTrader.js',
    '/js/components/income/raidMedalTrader.js',
    '/js/components/income/eventPassDisplay.js',
    '/js/components/income/shopOffers.js',
    '/js/components/income/eventPassInputs.js',
    '/js/components/income/eventTraderDisplay.js',
    '/js/components/income/clanWarInputs.js',
    '/js/components/income/gemDisplay.js',
    '/js/components/income/starBonusSelector.js',
    '/js/components/income/gemTrader.js',
    '/js/components/income/incomeCardObserver.js',
    '/js/components/income/starBonusDisplay.js',
    '/js/components/income/shopOfferDisplay.js',
    '/js/components/common/offerGrid.js',
    '/js/components/appSettings/appSettings.js',
    '/js/components/equipment/requiredOresDisplay.js',
    '/js/components/equipment/heroCardDisplay.js',
    '/js/components/equipment/heroCard.js',
    '/js/components/equipment/storageInputs.js',
    '/js/components/equipment/remainingTimeDisplay.js',
    '/js/components/player/playerInput.js',
    '/js/incomeCalculations/raidMedalTraderIncome.js',
    '/js/incomeCalculations/starBonusIncome.js',
    '/js/incomeCalculations/shopOfferIncome.js',
    '/js/incomeCalculations/cwlIncome.js',
    '/js/incomeCalculations/gemTraderIncome.js',
    '/js/incomeCalculations/eventPassIncome.js',
    '/js/incomeCalculations/eventTraderIncome.js',
    '/js/incomeCalculations/clanWarIncome.js',
    '/js/dom/playerDom.js',
    '/js/dom/domElements.js',
    '/js/dom/incomeDom.js',
    '/js/dom/equipmentDom.js',
    '/js/dom/appSettingsDom.js',
    '/js/data/timeConstants.js',
    '/js/data/heroData.js',
    '/js/data/allIncomeData.js',
    '/js/data/appData.js',
    '/js/data/currencyData.js',
    '/js/app.js',
    '/js/services/apiService.js',
    '/js/services/serverResponseHandler.js',

    // Asset Files
    // App Assets
    '/assets/app_icon_small.png',
    '/assets/app_icon_large.png',
    '/assets/screenshot_mobile.png',
    '/assets/screenshot_desktop.png',

    // Ores
    '/assets/shiny_ore.png',
    '/assets/glowy_ore.png',
    '/assets/starry_ore.png',
    '/assets/ore_icon.png',

    // Resources
    '/assets/resources/event_medal.png',
    '/assets/resources/cwl.png',
    '/assets/resources/gem.png',
    '/assets/resources/raid_medal.png',
    '/assets/resources/clan_war.png',

    // Player Leagues
    '/assets/player_leagues/unranked_league.png',
    '/assets/player_leagues/bronze_league.png',
    '/assets/player_leagues/silver_league.png',
    '/assets/player_leagues/gold_league.png',
    '/assets/player_leagues/crystal_league.png',
    '/assets/player_leagues/master_league.png',
    '/assets/player_leagues/champion_league.png',
    '/assets/player_leagues/titan_league.png',
    '/assets/player_leagues/legend_league.png',

    // Heroes
    '/assets/heroes/barbarian_king.png',
    '/assets/heroes/archer_queen.png',
    '/assets/heroes/minion_prince.png',
    '/assets/heroes/grand_warden.png',
    '/assets/heroes/royal_champion.png',

    // Equipment Assets
    '/assets/equipment/equip_placeholder.png',

    // Barbarian King Equipment
    '/assets/equipment/barbarian_king/BK_barbarian_puppet.png',
    '/assets/equipment/barbarian_king/BK_rage_vial.png',
    '/assets/equipment/barbarian_king/BK_earthquake_boots.png',
    '/assets/equipment/barbarian_king/BK_vampstache.png',
    '/assets/equipment/barbarian_king/BK_giant_gauntlet.png',
    '/assets/equipment/barbarian_king/BK_spiky_ball.png',
    '/assets/equipment/barbarian_king/BK_snake_bracelet.png',

    // Archer Queen Equipment
    '/assets/equipment/archer_queen/AQ_archer_puppet.png',
    '/assets/equipment/archer_queen/AQ_invisibility_vial.png',
    '/assets/equipment/archer_queen/AQ_giant_arrow.png',
    '/assets/equipment/archer_queen/AQ_healer_puppet.png',
    '/assets/equipment/archer_queen/AQ_frozen_arrow.png',
    '/assets/equipment/archer_queen/AQ_magic_mirror.png',
    '/assets/equipment/archer_queen/AQ_action_figure.png',

    // Minion Prince Equipment
    '/assets/equipment/minion_prince/MP_henchmen_puppet.png',
    '/assets/equipment/minion_prince/MP_dark_orb.png',
    '/assets/equipment/minion_prince/MP_metal_pants.png',
    '/assets/equipment/minion_prince/MP_noble_iron.png',
    '/assets/equipment/minion_prince/MP_dark_crown.png',

    // Grand Warden Equipment
    '/assets/equipment/grand_warden/GW_eternal_tome.png',
    '/assets/equipment/grand_warden/GW_life_gem.png',
    '/assets/equipment/grand_warden/GW_rage_gem.png',
    '/assets/equipment/grand_warden/GW_healing_tome.png',
    '/assets/equipment/grand_warden/GW_fireball.png',
    '/assets/equipment/grand_warden/GW_lavaloon_puppet.png',

    // Royal Champion Equipment
    '/assets/equipment/royal_champion/RC_royal_gem.png',
    '/assets/equipment/royal_champion/RC_seeking_shield.png',
    '/assets/equipment/royal_champion/RC_hog_rider_puppet.png',
    '/assets/equipment/royal_champion/RC_haste_vial.png',
    '/assets/equipment/royal_champion/RC_rocket_spear.png',
    '/assets/equipment/royal_champion/RC_electro_boots.png',
];

// The install event listener - caches our files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// The fetch event listener - serves files from cache first
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // If we have a match in the cache, return it.
                // Otherwise, fetch from the network.
                return response || fetch(event.request);
            })
    );
});

// Add a new event listener to manage old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // If a cache is not in our whitelist, delete it
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});