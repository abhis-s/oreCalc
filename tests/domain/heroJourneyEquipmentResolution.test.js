import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { heroJourneyNodes } from '../../js/data/heroJourneyData.js';
import { calculateHeroJourneyUpcomingOres } from '../../js/domain/income/heroJourneyIncome.js';
import {
    getResolvedEquipmentReward,
    resolveHeroJourneyTrack,
    getDefaultEquipmentUnlockLevel,
    isHeroJourneyFutureOrUnclaimedEquipment,
    shouldApplyHeroJourneyAutoLevel
} from '../../js/domain/income/heroJourneyResolution.js';

describe('Hero Journey Equipment Resolution Engine', () => {
    test('guest profiles resolve canonical milestone baseline with full pool options and zero starry fallback', () => {
        const guestState = {};
        const trackResolution = resolveHeroJourneyTrack(guestState);

        const node20 = heroJourneyNodes.find(n => n.level === 20);
        const res20 = getResolvedEquipmentReward(node20, guestState, trackResolution);
        assert.equal(res20.resolvedKey, 'giantGauntlet');
        assert.equal(res20.isFallbackStarry, false);
        assert.ok(Array.isArray(res20.poolOptions));
        assert.equal(res20.poolOptions.length, 5); // 4 equipment + 1 starry fallback

        const awardedOpt = res20.poolOptions.find(opt => opt.key === 'giantGauntlet');
        assert.equal(awardedOpt?.status, 'awardedHere');

        const queuedOpt = res20.poolOptions.find(opt => opt.key === 'spikyBall');
        assert.equal(queuedOpt?.status, 'queued');

        const starryOpt = res20.poolOptions.find(opt => opt.key === 'starryOre' || opt.status === 'starryFallback');
        assert.equal(starryOpt?.status, 'starryFallback');

        const node354 = heroJourneyNodes.find(n => n.level === 354);
        const res354 = getResolvedEquipmentReward(node354, guestState, trackResolution);
        assert.equal(res354.resolvedKey, 'lavaloonPuppet');
        assert.equal(res354.isFallbackStarry, false);
    });

    test('synced player with 0 owned equipment resolves Milestone 1 and Milestone 2 items sequentially', () => {
        const syncedState = {
            playerProfile: {
                tag: '#SYNC0',
                townHallLevel: 16,
                ownedEquipment: {}
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        const res150 = trackResolution[150];
        assert.equal(res150.resolvedKey, 'fireball');
        assert.equal(res150.isFallbackStarry, false);

        const res354 = trackResolution[354];
        assert.equal(res354.resolvedKey, 'lavaloonPuppet');
        assert.equal(res354.isFallbackStarry, false);
    });

    test('synced player who purchased first item advances subsequent milestones in priority order', () => {
        const syncedState = {
            playerProfile: {
                tag: '#SYNC_BOUGHT_FIRST',
                townHallLevel: 16,
                ownedEquipment: {
                    'Giant Gauntlet': 15
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // BK Milestone 1 (Node 20): skips owned Giant Gauntlet -> awards Spiky Ball
        const res20 = trackResolution[20];
        assert.equal(res20.resolvedKey, 'spikyBall');
        assert.equal(res20.isFallbackStarry, false);

        // BK Milestone 2 (Node 180): skips Spiky Ball (awarded at 20) -> awards Snake Bracelet
        const res180 = trackResolution[180];
        assert.equal(res180.resolvedKey, 'snakeBracelet');
        assert.equal(res180.isFallbackStarry, false);

        // BK Milestone 3 (Node 452): skips Snake Bracelet (awarded at 180) -> awards Stick Horse
        const res452 = trackResolution[452];
        assert.equal(res452.resolvedKey, 'stickHorse');
        assert.equal(res452.isFallbackStarry, false);
    });

    test('synced player at level 55 owning Frozen Arrow resolves Node 50 (past) as Frozen Arrow and Node 203 (future) as Magic Mirror', () => {
        const syncedState = {
            playerProfile: {
                tag: '#AQ_LVL55',
                townHallLevel: 14,
                ownedHeroes: {
                    'Archer Queen': { level: 55 }
                },
                ownedEquipment: {
                    'Frozen Arrow': 18
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Node 50 is in the past (cumulative level 55 >= 50): resolves to claimed Frozen Arrow
        const res50 = trackResolution[50];
        assert.equal(res50.resolvedKey, 'frozenArrow');
        assert.equal(res50.isFallbackStarry, false);
        assert.equal(res50.isOwned, true);
        const faOption50 = res50.poolOptions.find(o => o.key === 'frozenArrow');
        assert.equal(faOption50?.status, 'awardedHere');
        assert.equal(faOption50?.awardedAtLevel, 50);

        // Node 203 is in the future (cumulative level 55 < 203): awards first unowned item Magic Mirror
        const res203 = trackResolution[203];
        assert.equal(res203.resolvedKey, 'magicMirror');
        assert.equal(res203.isFallbackStarry, false);
        assert.equal(res203.isOwned, false);
        const faOption203 = res203.poolOptions.find(o => o.key === 'frozenArrow');
        assert.equal(faOption203?.status, 'awardedEarlier');
        assert.equal(faOption203?.awardedAtLevel, 50);
        const mmOption203 = res203.poolOptions.find(o => o.key === 'magicMirror');
        assert.equal(mmOption203?.status, 'awardedHere');
        assert.equal(mmOption203?.awardedAtLevel, 203);
    });

    test('synced player at level 210 owning Frozen Arrow and Magic Mirror resolves Node 50 as Frozen Arrow and Node 203 as Magic Mirror', () => {
        const syncedState = {
            playerProfile: {
                tag: '#AQ_LVL210',
                townHallLevel: 16,
                ownedHeroes: {
                    'Archer Queen': { level: 95 },
                    'Barbarian King': { level: 95 },
                    'Grand Warden': { level: 20 }
                },
                ownedEquipment: {
                    'Frozen Arrow': 27,
                    'Magic Mirror': 27
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Past nodes (cumulative level = 210 >= 50 and >= 203)
        assert.equal(trackResolution[50].resolvedKey, 'frozenArrow');
        assert.equal(trackResolution[203].resolvedKey, 'magicMirror');
    });

    test('synced player who reaches higher node out-of-order without owning earlier items fills in strict pool order', () => {
        const syncedState = {
            playerProfile: {
                tag: '#OUT_OF_ORDER',
                townHallLevel: 16,
                ownedEquipment: {}
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Grand Warden Node 150 gets Fireball (first in list)
        assert.equal(trackResolution[150].resolvedKey, 'fireball');

        // Grand Warden Node 354 gets Lavaloon Puppet (second in list)
        assert.equal(trackResolution[354].resolvedKey, 'lavaloonPuppet');
    });

    test('synced player owning all pool items receives 50 Starry Ore fallback', () => {
        const syncedState = {
            playerProfile: {
                tag: '#MAX_WARDEN_EQ',
                townHallLevel: 16,
                ownedEquipment: {
                    'Fireball': 27,
                    'Lavaloon Puppet': 27,
                    'Heroic Torch': 27
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Node 150 fallback
        assert.equal(trackResolution[150].isFallbackStarry, true);
        assert.equal(trackResolution[150].fallbackStarry, 50);
        assert.equal(trackResolution[150].equipmentLevel, null);

        // Node 354 fallback
        assert.equal(trackResolution[354].isFallbackStarry, true);
        assert.equal(trackResolution[354].fallbackStarry, 50);
        assert.equal(trackResolution[354].equipmentLevel, null);
    });

    test('planner checkbox toggles do not alter track resolution for guest profiles', () => {
        const guestWithPlannerChecked = {
            heroes: {
                'Grand Warden': {
                    equipment: {
                        'Fireball': { level: 18, checked: true },
                        'Lavaloon Puppet': { level: 18, checked: true }
                    }
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(guestWithPlannerChecked);

        // Must remain canonical baseline (Fireball at 150, Lavaloon Puppet at 354)
        assert.equal(trackResolution[150].resolvedKey, 'fireball');
        assert.equal(trackResolution[150].isFallbackStarry, false);

        assert.equal(trackResolution[354].resolvedKey, 'lavaloonPuppet');
        assert.equal(trackResolution[354].isFallbackStarry, false);
    });

    test('calculateHeroJourneyUpcomingOres accurately includes 50 Starry Ore fallback when equipment pool is exhausted', () => {
        const stateAllOwned = {
            heroes: {
                barbarianKing: { level: 10 },
                archerQueen: { level: 10 }
            },
            playerProfile: {
                tag: '#EQ_FULL',
                townHallLevel: 10,
                ownedEquipment: {
                    'Giant Gauntlet': 1,
                    'Spiky Ball': 1,
                    'Snake Bracelet': 1,
                    'Stick Horse': 1,
                    'Frozen Arrow': 1,
                    'Magic Mirror': 1,
                    'Action Figure': 1,
                    'Monolith Arrow': 1,
                    'Dark Crown': 1,
                    'Meteor Staff': 1,
                    'Fireball': 1,
                    'Lavaloon Puppet': 1,
                    'Heroic Torch': 1,
                    'Rocket Spear': 1,
                    'Electro Boots': 1,
                    'Frost Flake': 1,
                    'Rocket Backpack': 1,
                    'Revenge Deck': 1
                }
            }
        };

        const upcoming = calculateHeroJourneyUpcomingOres(stateAllOwned);
        // At level 20, 12 equipment nodes exist across the track. With all owned, each awards 50 Starry Ore.
        // Node 20 is reached (cumulativeLevel = 20), remaining 11 equipment nodes award 11 * 50 = 550 Starry Ore.
        assert.ok(upcoming.starry >= 550, `Upcoming starry (${upcoming.starry}) should include equipment fallback ores`);
    });

    test('future milestone nodes mark earlier slotted items as awardedEarlier with specific awardedAtLevel', () => {
        const guestState = {};
        const trackResolution = resolveHeroJourneyTrack(guestState);

        // BK Milestone 2 is at Node 180
        const node180 = heroJourneyNodes.find(n => n.level === 180);
        const res180 = getResolvedEquipmentReward(node180, guestState, trackResolution);

        const gauntletOpt = res180.poolOptions.find(opt => opt.key === 'giantGauntlet');
        assert.equal(gauntletOpt?.status, 'awardedEarlier');
        assert.equal(gauntletOpt?.awardedAtLevel, 20);

        const spikyOpt = res180.poolOptions.find(opt => opt.key === 'spikyBall');
        assert.equal(spikyOpt?.status, 'awardedHere');
        assert.equal(spikyOpt?.awardedAtLevel, 180);

        const snakeOpt = res180.poolOptions.find(opt => opt.key === 'snakeBracelet');
        assert.equal(snakeOpt?.status, 'queued');

        // BK Milestone 3 is at Node 452
        const node452 = heroJourneyNodes.find(n => n.level === 452);
        const res452 = getResolvedEquipmentReward(node452, guestState, trackResolution);

        const gauntlet452 = res452.poolOptions.find(opt => opt.key === 'giantGauntlet');
        assert.equal(gauntlet452?.status, 'awardedEarlier');
        assert.equal(gauntlet452?.awardedAtLevel, 20);

        const spiky452 = res452.poolOptions.find(opt => opt.key === 'spikyBall');
        assert.equal(spiky452?.status, 'awardedEarlier');
        assert.equal(spiky452?.awardedAtLevel, 180);

        const snake452 = res452.poolOptions.find(opt => opt.key === 'snakeBracelet');
        assert.equal(snake452?.status, 'awardedHere');
        assert.equal(snake452?.awardedAtLevel, 452);
    });

    test('dynamically adjusts equipment unlock level and future check when equipment shifts nodes', () => {
        // Player already owns Giant Gauntlet, so Spiky Ball shifts from Node 180 (Lvl 12) down to Node 20 (Lvl 1)
        // Snake Bracelet shifts from Node 452 (Lvl 15) down to Node 180 (Lvl 12)
        // Stick Horse shifts to Node 452 (Lvl 15)
        const playerWithGauntlet = {
            playerProfile: {
                tag: '#TEST',
                townHallLevel: 10,
                ownedHeroes: {
                    'Barbarian King': { level: 10 }
                },
                ownedEquipment: {
                    'Giant Gauntlet': 15
                }
            }
        };

        // Spiky Ball is now awarded at Node 20 (TH8 range -> level 1)
        assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'spikyBall', playerWithGauntlet), 1);
        // Snake Bracelet is now awarded at Node 180 (TH12 range -> level 12)
        assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'snakeBracelet', playerWithGauntlet), 12);
        // Stick Horse is now awarded at Node 452 (TH16 range -> level 15)
        assert.equal(getDefaultEquipmentUnlockLevel('barbarianKing', 'stickHorse', playerWithGauntlet), 15);

        // At hero level 25 (past Node 20, but before Node 180):
        // Node 20 awarded Giant Gauntlet. Spiky Ball is now awarded at future Node 180.
        const playerPastNode20 = {
            playerProfile: {
                tag: '#TEST',
                townHallLevel: 10,
                ownedHeroes: {
                    'Barbarian King': { level: 25 }
                },
                ownedEquipment: {
                    'Giant Gauntlet': 15
                }
            }
        };
        // Spiky Ball is awarded at Node 180 which is future (cumulative level 25 < 180)
        assert.equal(isHeroJourneyFutureOrUnclaimedEquipment('barbarianKing', 'spikyBall', playerPastNode20), true);
        assert.equal(shouldApplyHeroJourneyAutoLevel('Barbarian King', 'Spiky Ball', playerPastNode20), true);

        // Advance past Node 180 (cumulative level 190 >= 180, owning both):
        const playerPastNode180 = {
            playerProfile: {
                tag: '#TEST',
                townHallLevel: 16,
                ownedHeroes: {
                    'Barbarian King': { level: 95 },
                    'Archer Queen': { level: 95 }
                },
                ownedEquipment: {
                    'Giant Gauntlet': 15,
                    'Spiky Ball': 15
                }
            }
        };
        // Node 180 is now in the past (cumulative level 190 >= 180)
        assert.equal(isHeroJourneyFutureOrUnclaimedEquipment('barbarianKing', 'spikyBall', playerPastNode180), false);
        assert.equal(shouldApplyHeroJourneyAutoLevel('Barbarian King', 'Spiky Ball', playerPastNode180), false);
    });

    test('claimed node with unowned equipment retains predetermined item, node-bound level, and isOwned: false', () => {
        const syncedState = {
            playerProfile: {
                tag: '#MISSED_FROZEN_ARROW',
                townHallLevel: 14,
                ownedHeroes: {
                    'Archer Queen': { level: 55 }
                },
                ownedEquipment: {
                    // Frozen Arrow NOT owned
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Node 50 is claimed (level 55 >= 50): predetermined is Frozen Arrow
        const res50 = trackResolution[50];
        assert.equal(res50.resolvedKey, 'frozenArrow');
        assert.equal(res50.isOwned, false, 'Claimed node with missing equipment must have isOwned: false');
        assert.equal(res50.isFallbackStarry, false);
        assert.equal(res50.equipmentLevel, 6, 'Equipment level must be bound to Node 50 (TH9 range)');

        // Node 203 is future: predetermined is Magic Mirror, which is unowned
        const res203 = trackResolution[203];
        assert.equal(res203.resolvedKey, 'magicMirror', 'Node 203 must retain its predetermined Magic Mirror');
        assert.equal(res203.isOwned, false);
    });

    test('future node falls back to missed earlier equipment in priority order when predetermined item is owned', () => {
        const syncedState = {
            playerProfile: {
                tag: '#MISSED_GAUNTLET_OWNED_SPIKY',
                townHallLevel: 14,
                ownedHeroes: {
                    'Barbarian King': { level: 25 }
                },
                ownedEquipment: {
                    // Giant Gauntlet NOT owned
                    'Spiky Ball': 18 // Spiky Ball owned
                }
            }
        };
        const trackResolution = resolveHeroJourneyTrack(syncedState);

        // Node 20 is claimed (level 25 >= 20): predetermined is Giant Gauntlet, but unowned
        const res20 = trackResolution[20];
        assert.equal(res20.resolvedKey, 'giantGauntlet');
        assert.equal(res20.isOwned, false);
        const gauntletOpt20 = res20.poolOptions.find(opt => opt.key === 'giantGauntlet');
        assert.equal(gauntletOpt20?.status, 'nowAwardedAt', 'Node 20 must mark Giant Gauntlet as nowAwardedAt');
        assert.equal(gauntletOpt20?.awardedAtLevel, 180, 'Node 20 must link Giant Gauntlet to awarded level 180');

        // Node 180 is future (level 25 < 180): predetermined is Spiky Ball, which is already owned!
        // Fallback searches pool: Giant Gauntlet is unowned -> Node 180 resolves to Giant Gauntlet!
        const res180 = trackResolution[180];
        assert.equal(res180.resolvedKey, 'giantGauntlet', 'Node 180 must fall back to unowned Giant Gauntlet');
        assert.equal(res180.isOwned, false);
    });

    test('missed equipment node with no remaining future nodes marks status as missed', () => {
        const syncedState = {
            playerProfile: {
                tag: '#MAX_LEVEL_MISSED_EQ',
                townHallLevel: 18,
                ownedHeroes: {
                    'Barbarian King': { level: 95 },
                    'Archer Queen': { level: 95 },
                    'Grand Warden': { level: 70 },
                    'Royal Champion': { level: 45 },
                    'Minion Prince': { level: 90 }
                },
                ownedEquipment: {
                    // Missed Snake Bracelet (last BK node 452)
                    'Giant Gauntlet': 27,
                    'Spiky Ball': 27
                }
            }
        };

        syncedState.playerProfile.ownedHeroes['Barbarian King'].level = 110;
        syncedState.playerProfile.ownedHeroes['Archer Queen'].level = 110;
        syncedState.playerProfile.ownedHeroes['Grand Warden'].level = 85;
        syncedState.playerProfile.ownedHeroes['Royal Champion'].level = 55;
        syncedState.playerProfile.ownedHeroes['Minion Prince'].level = 95; // sum = 455 >= 452

        const trackResMax = resolveHeroJourneyTrack(syncedState);
        const res452 = trackResMax[452];
        assert.equal(res452.resolvedKey, 'snakeBracelet');
        assert.equal(res452.isOwned, false);

        const snakeOpt = res452.poolOptions.find(opt => opt.key === 'snakeBracelet');
        assert.equal(snakeOpt?.status, 'missed', 'Snake bracelet must be marked as missed when no future nodes exist');

        // Verify that earlier nodes (e.g. Node 20, Node 180) also list Snake Bracelet as 'missed'
        const res20 = trackResMax[20];
        const snakeOptAt20 = res20.poolOptions.find(opt => opt.key === 'snakeBracelet');
        assert.equal(snakeOptAt20?.status, 'missed', 'Truly missed equipment must be marked as missed on earlier nodes as well');

        // Stick Horse was never on any node, so it must stay 'queued'
        const stickHorseOptAt20 = res20.poolOptions.find(opt => opt.key === 'stickHorse');
        assert.equal(stickHorseOptAt20?.status, 'queued', 'Equipment not appearing on any node must stay queued');
    });
});
