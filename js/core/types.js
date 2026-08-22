/**
 * @file Type definitions and JSDoc contracts for OreCalc domain models.
 */

/**
 * @typedef {Object} OreQuantity
 * @property {number} shiny - Shiny ore amount
 * @property {number} glowy - Glowy ore amount
 * @property {number} starry - Starry ore amount
 */

/**
 * @typedef {Object} UpgradePlanStep
 * @property {number} targetLevel - Target equipment level for this upgrade step
 * @property {boolean} enabled - Whether this step is active
 * @property {number} priorityIndex - Global priority sorting index
 */

/**
 * @typedef {Object} EquipmentItem
 * @property {number} level - Current equipment level
 * @property {boolean} [checked] - Whether equipment upgrade calculation is included
 * @property {boolean} [isServerOwned] - Whether verified owned by Supercell API
 * @property {Record<string, UpgradePlanStep>} [upgradePlan] - Priority upgrade plan steps
 */

/**
 * @typedef {Object} HeroItem
 * @property {number} level - Hero level
 * @property {boolean} enabled - Whether hero upgrades are enabled
 * @property {Record<string, EquipmentItem>} equipment - Equipment items keyed by canonical equipment name
 */

/**
 * @typedef {Object} LeagueTierInfo
 * @property {number} [id] - Numeric league ID
 * @property {string} [name] - League localized name
 * @property {{ small?: string, medium?: string, large?: string }} [iconUrls] - Badge icon URLs
 */

/**
 * @typedef {Object} PlayerProfile
 * @property {string} tag - Player tag (e.g. #2PP)
 * @property {string} name - Player in-game name
 * @property {number} townHallLevel - Town Hall level
 * @property {LeagueTierInfo} [leagueTier] - League tier info
 * @property {LeagueTierInfo} [league] - League object
 * @property {number} [townHallWeaponLevel] - Town hall weapon level
 * @property {number} [expLevel] - Experience level
 * @property {number} [bestTrophies] - Highest trophy record
 * @property {number} [warStars] - Total war stars won
 * @property {number} [attackWins] - Attack wins in current season
 * @property {number} [defenseWins] - Defense wins in current season
 * @property {number} [builderHallLevel] - Builder hall level
 * @property {number} [versusTrophies] - Versus trophies
 * @property {number} [bestVersusTrophies] - Highest versus trophy record
 * @property {number} [versusBattleWins] - Versus battle wins
 * @property {string} [warPreference] - War participation preference
 * @property {number} [donations] - Troop donations count
 * @property {number} [donationsReceived] - Troop donations received count
 * @property {number} [clanCapitalContributions] - Clan capital contributions
 * @property {Array<any>} [heroes] - List of hero data objects from API
 * @property {Array<any>} [heroEquipment] - List of equipment data objects from API
 * @property {Record<string, number>} [ownedEquipment] - Equipment levels map
 * @property {Record<string, { level?: number, maxLevel?: number, equipment?: Array<{ name: string, key?: string, level: number }> }>} [ownedHeroes] - Hero details map
 * @property {number} [trophies] - Player trophy count
 * @property {string} [role] - Clan role
 * @property {string} [clanBadgeUrl] - Clan badge image URL
 * @property {{ name?: string, tag?: string, clanLevel?: number, badgeUrls?: { small?: string, medium?: string, large?: string } }} [clan] - Clan details
 */

/**
 * @typedef {Object} IncomeTimeframeRates
 * @property {number} shiny - Shiny ore rate
 * @property {number} glowy - Glowy ore rate
 * @property {number} starry - Starry ore rate
 * @property {number} [currencyRate] - Dynamic localized currency rate
 * @property {number} [EUR] - Dynamic EUR currency cost
 * @property {number} [USD] - Dynamic USD currency cost
 * @property {number} [GBP] - Dynamic GBP currency cost
 */

/**
 * @typedef {Object} SingleTimeEstimate
 * @property {number | null} years - Estimated full years to completion
 * @property {number | null} months - Estimated remaining months
 * @property {number | null} days - Estimated remaining days
 * @property {Date | string | null} date - Projected completion date object or 'N/A'
 * @property {string} [status] - Optional status indicator (e.g. 'DONE')
 */

/**
 * @typedef {Object} RemainingTimeEstimate
 * @property {SingleTimeEstimate} shiny - Shiny ore completion ETA
 * @property {SingleTimeEstimate} glowy - Glowy ore completion ETA
 * @property {SingleTimeEstimate} starry - Starry ore completion ETA
 */

/**
 * @typedef {Object} EquipmentModifierResult
 * @property {number} effectiveLevel - Effective level after modifier clamping/downgrades
 * @property {number} effectiveMaxLevel - Effective max level cap under active modifier
 * @property {number} trueMaxLevel - Baseline unadjusted maximum level
 * @property {boolean} isDowngraded - Whether the modifier applied a level downgrade
 * @property {number} downgrade - Number of levels downgraded
 */

/**
 * @typedef {Object} ModifierRecommendationResult
 * @property {string | null} recStatus - Recommendation status tag ('recommended' | 'not_recommended' | 'unreleased' | null)
 * @property {number | null} targetRecLevel - Recommended target level for Town Hall
 * @property {boolean} isAutoMax - Whether auto-max recommendation is active
 */

/**
 * @typedef {Object} CurrencySettings
 * @property {string} code - ISO currency code (e.g. 'USD', 'EUR')
 * @property {Record<string, number>} [globalPricing] - Optional custom pricing overrides per tier
 */

/**
 * @typedef {Object} UISettingsTimestamps
 * @property {number | null} privacy - Timestamp when privacy policy was accepted
 * @property {number | null} tos - Timestamp when terms of service were accepted
 * @property {number | null} welcome - Timestamp when welcome modal was dismissed
 * @property {number | null} tour - Timestamp when onboarding tour was completed
 */

/**
 * @typedef {Object} UISettingsState
 * @property {CurrencySettings} currency - Currency preferences
 * @property {string} [theme] - Color theme ('dark' | 'light')
 * @property {string} [accentColor] - Accent color preference
 * @property {string} [language] - UI language code ('auto' | 'en' | 'de' | 'tr' | 'zh')
 * @property {boolean} [enableLevelInput] - Whether manual numeric level inputs are enabled
 * @property {boolean} [hideMaxedEquipment] - Whether maxed equipment cards are collapsed
 * @property {boolean} [hideLockedEquipment] - Whether unreleased equipment cards are hidden
 * @property {boolean} [cloudSync] - Whether cloud synchronization is active
 * @property {UISettingsTimestamps} [uiTimestamps] - Legal consent timestamps
 * @property {'daily' | 'weekly' | 'monthly' | 'bimonthly' | string} [summaryTimeframe] - Summary display timeframe
 * @property {string} [cardLayout] - Equipment card density layout ('cozy' | 'compact')
 * @property {boolean} [saveError] - Indicator if local storage saving is suspended due to quota error
 */

/**
 * @typedef {Object} ClanWarIncomeState
 * @property {boolean} [enabled] - Whether regular clan wars income is enabled
 * @property {number} [winRate] - Win percentage (0-100)
 * @property {number} [drawRate] - Draw percentage (0-100)
 * @property {Partial<OreQuantity>} [oresPerAttack] - Ores gained per single war attack
 * @property {number} [warsPerMonth] - Estimated regular clan wars fought per month
 * @property {{ thLevel?: number }} [warPerformance] - Town hall tier performance preset
 */

/**
 * @typedef {Object} CwlIncomeState
 * @property {boolean} [enabled] - Whether CWL income is enabled
 * @property {number} [winRate] - Win percentage (0-100)
 * @property {number} [drawRate] - Draw percentage (0-100)
 * @property {Partial<OreQuantity>} [oresPerAttack] - Ores gained per single CWL attack
 * @property {number} [hitsPerSeason] - Number of attacks taken in CWL season
 * @property {number} [attacksPerEvent] - Alias for hitsPerSeason
 */

/**
 * @typedef {Object} EventPassIncomeState
 * @property {boolean} [enabled] - Whether event pass is active
 * @property {boolean} [eventPass] - Whether event pass track is purchased
 * @property {boolean} [includeEquipment] - Whether event medal cost for epic equipment is deducted
 * @property {number} [bonusTrackMedals] - Additional bonus track event medals earned
 * @property {number} [purchasedMedals] - Directly purchased event medals
 * @property {{ enabled?: boolean, packs?: Partial<OreQuantity> }} [trader] - Embedded event trader settings
 */

/**
 * @typedef {Object} EventTraderIncomeState
 * @property {boolean} [enabled] - Whether event trader income is enabled
 * @property {Partial<OreQuantity> | Record<string, number>} [packs] - Quantity of event ore packs purchased keyed by ore type
 */

/**
 * @typedef {Object} GemTraderIncomeState
 * @property {boolean} [enabled] - Whether gem trader income is enabled
 * @property {Partial<OreQuantity> | Record<string, number>} [packs] - Quantity of gem trader ore packs purchased keyed by ore type
 */

/**
 * @typedef {Object} RaidMedalTraderIncomeState
 * @property {boolean} [enabled] - Whether raid medal trader income is enabled
 * @property {number} [earned] - Total raid medals earned per week
 * @property {Partial<OreQuantity> | Record<string, number>} [packs] - Quantity of raid medal packs purchased keyed by ore type
 */

/**
 * @typedef {Object} ShopOffersIncomeState
 * @property {boolean} [enabled] - Whether shop offers income is enabled
 * @property {number | string | null} [selectedSet] - Active shop offer bundle set index
 * @property {Record<string, number>} [purchases] - Map of offer keys to purchase counts
 */

/**
 * @typedef {Object} StarBonus2xConfig
 * @property {number} [frequency] - Interval in months between 2x star bonus events
 * @property {number} [duration] - Duration in days of each 2x star bonus event
 * @property {string} [lastEvent] - ISO date or year-month string of last 2x event
 */

/**
 * @typedef {Object} StarBonusIncomeState
 * @property {number} [league] - League ID
 * @property {StarBonus2xConfig} [config2x] - 2x star bonus event configuration
 * @property {Record<string, any>} [thUpgrades] - Logged Town Hall upgrades for 4x boost
 */

/**
 * @typedef {Object} SupercellEventsIncomeState
 * @property {boolean} [enabled] - Whether supercell events rewards are enabled
 * @property {boolean} [worldChampionship] - Whether World Championship event stream rewards are active
 */

/**
 * @typedef {Object} ProspectorState
 * @property {string} [fromOre] - Source ore type for conversion
 * @property {string} [toOre] - Destination ore type for conversion
 * @property {number} [fromAmount] - Quantity of source ore to convert
 * @property {string} [conversionFrom] - Legacy alias for source ore type
 * @property {string} [conversionTo] - Legacy alias for destination ore type
 * @property {number} [manualAmount] - User-specified manual conversion quantity
 * @property {boolean} [assistedConversion] - Whether automatic optimal assisted conversion is enabled
 * @property {string} [strategy] - Conversion strategy mode
 * @property {boolean} [goldPass] - Whether gold pass prospector boost is active
 */

/**
 * @typedef {Object} IncomeSourcesState
 * @property {ShopOffersIncomeState} [shopOffers] - Shop offers state
 * @property {RaidMedalTraderIncomeState} [raidMedals] - Raid medal trader state
 * @property {GemTraderIncomeState} [gems] - Gem trader state
 * @property {EventPassIncomeState} [eventPass] - Event pass state
 * @property {EventTraderIncomeState} [eventTrader] - Event trader state
 * @property {ClanWarIncomeState} [clanWar] - Clan war state
 * @property {CwlIncomeState} [cwl] - Clan War League state
 * @property {SupercellEventsIncomeState} [supercellEvents] - Supercell events state
 * @property {StarBonusIncomeState} [starBonus] - Star bonus state
 * @property {ProspectorState} [prospector] - Ore prospector state
 */

/**
 * @typedef {Object} IncomeResult
 * @property {IncomeTimeframeRates} daily - Daily income rate breakdown
 * @property {IncomeTimeframeRates} weekly - Weekly income rate breakdown
 * @property {IncomeTimeframeRates} monthly - Monthly income rate breakdown
 * @property {IncomeTimeframeRates} bimonthly - Bimonthly income rate breakdown
 * @property {IncomeTimeframeRates} [perEvent] - Optional per-event rate breakdown
 * @property {number} [cost] - Currency or medal cost incurred
 * @property {number} [remaining] - Remaining currency or medals after purchases
 * @property {number} [availableMedals] - Total medals available before purchases
 * @property {number} [totalMedalsEarned] - Total medals earned
 * @property {string} [type] - Pass type ('event' | 'free')
 * @property {boolean} [eventPass] - Whether event pass is active
 * @property {string} [iconUrl] - Associated league or event icon URL
 * @property {OreQuantity} [baseDaily] - Baseline daily ore amounts before multipliers
 */

/**
 * @typedef {Object} HeroJourneyState
 * @property {number[]} [overrideUnclaimed] - Overridden unclaimed node milestone thresholds
 * @property {boolean} [acceleratedRewards] - Whether accelerated quest chest rewards are active
 * @property {boolean} [accelerated] - Alias for acceleratedRewards
 * @property {'normal' | 'accelerated'} [rewardMode] - Reward mode string
 * @property {boolean} [unclaimedOnly] - Whether only unclaimed milestones are visible
 * @property {string | null} [typeFilter] - Active type filter ('ores' | 'equipment' | 'skins' | 'items' | null)
 * @property {boolean} [hidden] - Whether Hero's Journey milestone track is collapsed/hidden
 * @property {boolean} [revealBeyondTH] - Whether milestones beyond player's Town Hall limit are previewed
 */

/**
 * @typedef {Object} PlannerCalendarState
 * @property {Record<string, any>} [settings] - Calendar display settings
 * @property {Record<string, any>} [view] - Active view configuration
 * @property {Record<string, any>} [dates] - Date-indexed planner event data
 * @property {boolean} [isDirty] - Flag indicating unsaved calendar changes
 * @property {boolean} [isHydrated] - Flag indicating whether calendar view has been hydrated
 * @property {any[]} [customChips] - Custom event chips
 * @property {Record<string, any>} [customChipData] - Custom chip data storage
 * @property {Record<string, any>} [customChipSettings] - Custom chip configuration settings
 */

/**
 * @typedef {Object} PlannerState
 * @property {PlannerCalendarState} [calendar] - Calendar state
 * @property {Record<string, number>} [customMaxLevel] - Custom equipment max level overrides
 */

/**
 * @typedef {Object} PlayerData
 * @property {Record<string, HeroItem>} heroes - Player hero and equipment levels
 * @property {OreQuantity} storedOres - Player currently stored inventory ores
 * @property {IncomeSourcesState} income - Income source configurations
 * @property {PlannerState} planner - Calendar and upgrade priority planner
 * @property {PlayerProfile | null} playerProfile - Supercell API player profile
 * @property {number | null} [onboardingTimestamp] - Onboarding setup completion timestamp
 * @property {HeroJourneyState} [heroJourney] - Hero Journey progression state
 * @property {CurrencySettings} [currency] - Player-specific currency settings
 */

/**
 * @typedef {Object} DerivedState
 * @property {OreQuantity} requiredOres - Total ores required for selected equipment
 * @property {OreQuantity} [remainingOres] - Remaining ores needed after deducting stored inventory
 * @property {OreQuantity} [heroJourneyUpcomingOres] - Upcoming ores expected from Hero Journey nodes
 * @property {Record<string, IncomeResult | any>} [incomeSources] - Breakdown of calculated income per source
 * @property {IncomeTimeframeRates} [totalIncome] - Aggregated ore and currency income for active timeframe
 * @property {IncomeTimeframeRates} [totalMonthlyIncome] - Aggregated monthly ore and currency income
 * @property {RemainingTimeEstimate} [remainingTime] - Time to completion estimates per ore type
 * @property {Record<string, number>} [totalMoneyCost] - Aggregated real money costs per currency
 */

/**
 * @typedef {Object} AppState
 * @property {string} appVersion - Schema version
 * @property {string} [timestamp] - Last update timestamp
 * @property {string} [activeTab] - Currently active UI tab ID
 * @property {string[]} savedPlayerTags - List of saved player tags
 * @property {Record<string, PlayerData>} allPlayersData - State slices keyed by player tag
 * @property {Record<string, HeroItem>} heroes - Active player heroes
 * @property {OreQuantity} storedOres - Active player stored ores
 * @property {IncomeSourcesState} income - Active player income settings
 * @property {PlannerState} planner - Active player calendar & priorities
 * @property {PlayerProfile | null} playerProfile - Active player profile
 * @property {number | null} [onboardingTimestamp] - Active player onboarding setup completion timestamp
 * @property {HeroJourneyState} [heroJourney] - Active player hero journey state
 * @property {DerivedState} derived - Calculated output state
 * @property {UISettingsState} uiSettings - User interface preferences
 */

/**
 * @typedef {Object} ServerResponseResult
 * @property {boolean} success - Whether operation completed successfully
 * @property {string} [message] - Localized status or error message
 * @property {boolean} [isNetworkError] - Whether failure was due to network/server outage
 * @property {string} [errorType] - Error classification key
 */

export {};
