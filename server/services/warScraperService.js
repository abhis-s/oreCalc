const { admin, db } = require('./firebase.js');
const { httpsAgent } = require('./clashApiService.js');

/**
 * Parses Clash of Clans ISO-like date format (YYYYMMDDTHHMMSS.000Z) into standard Date.
 *
 * @param {string|null|undefined} cocDateStr - Clash date string.
 * @returns {Date|null}
 */
function parseCocDate(cocDateStr) {
    if (!cocDateStr || cocDateStr.length < 15) return null;
    const year = cocDateStr.substring(0, 4);
    const month = cocDateStr.substring(4, 6);
    const day = cocDateStr.substring(6, 8);
    const hours = cocDateStr.substring(9, 11);
    const minutes = cocDateStr.substring(11, 13);
    const seconds = cocDateStr.substring(13, 15);

    let msPart = ".000Z";
    if (cocDateStr.includes('.')) {
        msPart = cocDateStr.substring(cocDateStr.indexOf('.'));
    }

    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}${msPart}`);
}

/**
 * Fetches CWL war details from Supercell API.
 *
 * @param {string} warTag - War hashtag.
 * @returns {Promise<any>}
 */
async function fetchWarFromApi(warTag) {
    const fetch = (await import('node-fetch')).default;
    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
    const url = `${baseUrl}/clanwarleagues/wars/${encodedTag}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
        },
        agent: httpsAgent
    });
    if (!response.ok) {
        throw new Error(`CoC API status ${response.status}`);
    }
    return await response.json();
}

/**
 * Fetches Classic war details from Supercell API.
 *
 * @param {string} clanTag - Clan hashtag.
 * @returns {Promise<any>}
 */
async function fetchClassicWarFromApi(clanTag) {
    const fetch = (await import('node-fetch')).default;
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
    const url = `${baseUrl}/clans/${encodedTag}/currentwar`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
        },
        agent: httpsAgent
    });
    if (!response.ok) {
        throw new Error(`CoC API status ${response.status}`);
    }
    return await response.json();
}

/**
 * Records final war outcomes in Firestore `clanWarLogs` for both participating clans.
 *
 * @param {any} warData - War payload from Supercell.
 */
async function recordWarResult(warData) {
    if (!warData || !warData.clan || !warData.opponent) return;
    const clanTag = warData.clan.tag.toUpperCase();
    const opponentTag = warData.opponent.tag.toUpperCase();
    const endTime = warData.endTime;
    const teamSize = warData.teamSize || 15;

    const clanStars = warData.clan.stars || 0;
    const clanDestruction = warData.clan.destructionPercentage || 0;
    const oppStars = warData.opponent.stars || 0;
    const oppDestruction = warData.opponent.destructionPercentage || 0;

    let clanResult = 'tie';
    let oppResult = 'tie';

    if (clanStars > oppStars) {
        clanResult = 'win';
        oppResult = 'lose';
    } else if (clanStars < oppStars) {
        clanResult = 'lose';
        oppResult = 'win';
    } else {
        if (clanDestruction > oppDestruction) {
            clanResult = 'win';
            oppResult = 'lose';
        } else if (clanDestruction < oppDestruction) {
            clanResult = 'lose';
            oppResult = 'win';
        }
    }

    const logId = `${clanTag.substring(1)}_${opponentTag.substring(1)}_${endTime}`;

    await db.collection('clanWarLogs').doc(`${clanTag.substring(1)}_${logId}`).set({
        clanTag,
        opponentTag,
        result: clanResult,
        endTime,
        teamSize,
        stars: clanStars,
        destructionPercentage: clanDestruction,
        opponent: {
            tag: opponentTag,
            name: warData.opponent.name || '',
            stars: oppStars,
            destructionPercentage: oppDestruction
        },
        recordedAt: new Date().toISOString()
    }).catch(err => console.error("[Scraper] Error saving war log entry for clan: ", err));

    await db.collection('clanWarLogs').doc(`${opponentTag.substring(1)}_${logId}`).set({
        clanTag: opponentTag,
        opponentTag: clanTag,
        result: oppResult,
        endTime,
        teamSize,
        stars: oppStars,
        destructionPercentage: oppDestruction,
        opponent: {
            tag: clanTag,
            name: warData.clan.name || '',
            stars: clanStars,
            destructionPercentage: clanDestruction
        },
        recordedAt: new Date().toISOString()
    }).catch(err => console.error("[Scraper] Error saving war log entry for opponent: ", err));
}

/**
 * Registers all round wars for a CWL league group in Firestore `cwlWars`.
 *
 * @param {any} groupData - CWL league group payload.
 */
async function registerGroupWarsBackground(groupData) {
    if (!groupData || !groupData.rounds || !groupData.season) return;

    const warTags = [];
    for (const round of groupData.rounds) {
        if (round.warTags) {
            for (const tag of round.warTags) {
                if (tag && tag !== '#NoWar') {
                    warTags.push(tag);
                }
            }
        }
    }

    if (warTags.length === 0) return;

    const season = groupData.season;

    for (const tag of warTags) {
        try {
            const docRef = db.collection('cwlWars').doc(tag);
            const doc = await docRef.get();

            if (!doc.exists) {
                console.log(`[Scraper] Initial register for war tag ${tag}`);
                const war = /** @type {any} */ (await fetchWarFromApi(tag));

                if (war) {
                    const clanTag = war.clan?.tag || '';
                    const opponentTag = war.opponent?.tag || '';
                    const parsedEndTime = parseCocDate(war.endTime);

                    await docRef.set({
                        warTag: tag,
                        season: season,
                        clanTag: clanTag,
                        opponentTag: opponentTag,
                        state: war.state || 'preparation',
                        startTime: war.startTime || '',
                        endTime: war.endTime || '',
                        endTimestamp: parsedEndTime ? admin.firestore.Timestamp.fromDate(parsedEndTime) : null,
                        lastFetchTime: new Date().toISOString(),
                        warData: war
                    });

                    if ((war.state || 'warEnded') === 'warEnded') {
                        await recordWarResult(war);
                    }
                }
            }
        } catch (err) {
            console.error(`[Scraper] Failed to register/update war ${tag}:`, err.message);
        }
    }
}

/**
 * Starts background scraper interval running hourly to update active wars and prune 90-day-old records.
 */
function startCwlBackgroundScraper() {
    console.log("[Scraper] Starting background scraper (1-hour interval)");

    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`[Scraper] Running periodic war fetch checks at ${now.toISOString()}`);

            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            const oldWarsSnapshot = await db.collection('cwlWars')
                .where('endTimestamp', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
                .get();

            for (const oldDoc of oldWarsSnapshot.docs) {
                await oldDoc.ref.delete();
                console.log(`[Scraper] Pruned old war document: ${oldDoc.id}`);
            }

            const snapshot = await db.collection('cwlWars')
                .where('state', '!=', 'warEnded')
                .get();

            for (const doc of snapshot.docs) {
                const war = /** @type {any} */ (doc.data());
                const endTime = parseCocDate(war.endTime);
                if (!endTime) continue;

                if (now.getTime() >= endTime.getTime() + 5 * 60 * 1000) {
                    console.log(`[Scraper] CWL War ${war.warTag} endTime passed. Fetching final stats...`);
                    try {
                        const freshWarData = /** @type {any} */ (await fetchWarFromApi(war.warTag));
                        if (freshWarData) {
                            const parsedEndTime = parseCocDate(freshWarData.endTime);
                            await doc.ref.update({
                                state: freshWarData.state || 'warEnded',
                                endTimestamp: parsedEndTime ? admin.firestore.Timestamp.fromDate(parsedEndTime) : null,
                                warData: freshWarData,
                                lastFetchTime: new Date().toISOString()
                            });
                            console.log(`[Scraper] Updated CWL war ${war.warTag} state to: ${freshWarData.state}`);
                            if ((freshWarData.state || 'warEnded') === 'warEnded') {
                                await recordWarResult(freshWarData);
                            }
                        }
                    } catch (err) {
                        console.error(`[Scraper] Failed to update CWL war ${war.warTag}:`, err.message);
                    }
                }
            }

            const classicSnapshot = await db.collection('classicWars')
                .where('state', '!=', 'warEnded')
                .get();

            for (const doc of classicSnapshot.docs) {
                const war = /** @type {any} */ (doc.data());
                const clanTag = war.clanTag;
                const cleanedClanTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;

                const metaDoc = await db.collection('clanMetadata').doc(cleanedClanTag.toUpperCase()).get();
                const isPrivate = metaDoc.exists && metaDoc.data().isPrivateWarLog === true;

                const nowTime = now.getTime();
                const endTime = parseCocDate(war.endTime);
                if (!endTime) continue;

                // Respect the 4-hour check interval for private war log clans, 1-hour for public
                const lastFetch = war.lastFetchTime ? new Date(war.lastFetchTime) : new Date(0);

                if (nowTime >= endTime.getTime() + 5 * 60 * 1000) {
                    const cooldown = isPrivate ? 4 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
                    if (nowTime - lastFetch.getTime() >= cooldown) {
                        console.log(`[Scraper] Updating classic war ${doc.id} for clan ${clanTag} (Private: ${isPrivate})`);
                        try {
                            const freshWarData = /** @type {any} */ (await fetchClassicWarFromApi(clanTag));

                            if (freshWarData) {
                                if (freshWarData.state === 'warEnded' || freshWarData.state === 'notInWar') {
                                    await recordWarResult(freshWarData);
                                    await doc.ref.update({
                                        state: 'warEnded',
                                        lastFetchTime: new Date().toISOString()
                                    });
                                    console.log(`[Scraper] Classic war ${doc.id} ended. Outcome recorded.`);
                                } else {
                                    await doc.ref.update({
                                        state: freshWarData.state,
                                        lastFetchTime: new Date().toISOString()
                                    });
                                }
                            }
                        } catch (err) {
                            if (err.message.includes('403') || err.message.includes('Forbidden')) {
                                await db.collection('clanMetadata').doc(cleanedClanTag.toUpperCase()).set({
                                    tag: cleanedClanTag.toUpperCase(),
                                    isPrivateWarLog: true,
                                    updatedAt: new Date().toISOString()
                                }, { merge: true });

                                await doc.ref.update({
                                    lastFetchTime: new Date().toISOString()
                                });
                                console.warn(`[Scraper] Classic war ${doc.id} returned 403. Set metadata to Private.`);
                            } else {
                                console.error(`[Scraper] Failed to update classic war ${doc.id}:`, err.message);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[Scraper] Error in background scraper interval:", err);
        }
    }, 60 * 60 * 1000);
}

module.exports = {
    parseCocDate,
    fetchWarFromApi,
    fetchClassicWarFromApi,
    recordWarResult,
    registerGroupWarsBackground,
    startCwlBackgroundScraper
};
