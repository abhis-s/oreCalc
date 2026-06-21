import { heroData, upgradeCosts } from '../../data/heroData.js';
import { leagueTiers } from '../../data/appData.js';
import { translate } from '../../i18n/translator.js';
import { showAddPlayerModal } from '../player/playerModal.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { calculateRemainingTime } from '../../core/timeCalculator.js';

/**
 * Calculates overall ore-cost-based progress percentage for common and epic equipment.
 */
function calculateEquipmentProgress(ownedEquipment, ownedHeroes) {
    let commonSpent = { shiny: 0, glowy: 0 };
    let commonTotal = { shiny: 0, glowy: 0 };
    let epicSpent = { shiny: 0, glowy: 0, starry: 0 };
    let epicTotal = { shiny: 0, glowy: 0, starry: 0 };

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];
        if (ownedHeroes && ownedHeroes[heroInfo.name]) {
            for (const equip of heroInfo.equipment) {
                const isEpic = equip.type === 'epic';
                const currentLevel = ownedEquipment[equip.name] !== undefined ? ownedEquipment[equip.name] : 1;
                const maxLevel = isEpic ? 27 : 18;

                if (ownedEquipment[equip.name] !== undefined) {
                    for (let lvl = 2; lvl <= currentLevel; lvl++) {
                        if (upgradeCosts[lvl]) {
                            if (isEpic) {
                                epicSpent.shiny += upgradeCosts[lvl].shiny || 0;
                                epicSpent.glowy += upgradeCosts[lvl].glowy || 0;
                                epicSpent.starry += upgradeCosts[lvl].starry || 0;
                            } else {
                                commonSpent.shiny += upgradeCosts[lvl].shiny || 0;
                                commonSpent.glowy += upgradeCosts[lvl].glowy || 0;
                            }
                        }
                    }
                }

                for (let lvl = 2; lvl <= maxLevel; lvl++) {
                    if (upgradeCosts[lvl]) {
                        if (isEpic) {
                            epicTotal.shiny += upgradeCosts[lvl].shiny || 0;
                            epicTotal.glowy += upgradeCosts[lvl].glowy || 0;
                            epicTotal.starry += upgradeCosts[lvl].starry || 0;
                        } else {
                            commonTotal.shiny += upgradeCosts[lvl].shiny || 0;
                            commonTotal.glowy += upgradeCosts[lvl].glowy || 0;
                        }
                    }
                }
            }
        }
    }

    const commonTotalSpent = commonSpent.shiny + commonSpent.glowy;
    const commonTotalRequired = commonTotal.shiny + commonTotal.glowy;
    const epicTotalSpent = epicSpent.shiny + epicSpent.glowy + epicSpent.starry;
    const epicTotalRequired = epicTotal.shiny + epicTotal.glowy + epicTotal.starry;

    const totalSpent = commonTotalSpent + epicTotalSpent;
    const totalRequired = commonTotalRequired + epicTotalRequired;
    const overall = totalRequired > 0 ? Math.round((totalSpent / totalRequired) * 100) : 0;

    const shinySpent = commonSpent.shiny + epicSpent.shiny;
    const shinyTotal = commonTotal.shiny + epicTotal.shiny;
    const shiny = shinyTotal > 0 ? Math.round((shinySpent / shinyTotal) * 100) : 0;

    const glowySpent = commonSpent.glowy + epicSpent.glowy;
    const glowyTotal = commonTotal.glowy + epicTotal.glowy;
    const glowy = glowyTotal > 0 ? Math.round((glowySpent / glowyTotal) * 100) : 0;

    const starrySpent = epicSpent.starry;
    const starryTotal = epicTotal.starry;
    const starry = starryTotal > 0 ? Math.round((starrySpent / starryTotal) * 100) : 0;

    return {
        overall, shiny, glowy, starry,
        shinySpent, shinyTotal,
        glowySpent, glowyTotal,
        starrySpent, starryTotal,
    };
}

/**
 * Generates the mathematical gradient background for the overall progress bar.
 */
function getOverallGradient(progress) {
    if (progress.overall >= 100) {
        return ''; // Handled by .maxed-fill class styles
    }
    const total = progress.shiny + progress.glowy + progress.starry;
    if (total === 0) {
        return 'linear-gradient(90deg, #00b0ff 0%, #aa00ff 50%, #ffd700 100%)';
    }
    const stopVal = Math.round((progress.shiny / total) * 100);
    const stop = Math.min(85, Math.max(15, stopVal));
    return `linear-gradient(90deg, #00b0ff 0%, #aa00ff ${stop}%, #ffd700 100%)`;
}

/**
 * Formats the clan role for localization.
 */
function formatClanRole(role) {
    if (!role) return '';
    const key = `roles.${role.toLowerCase()}`;
    const translated = translate(key);
    return translated !== key ? translated : role;
}

/**
 * Formats remaining time object into shorthand string (e.g. 1y 2m 3d).
 */
function formatRemainingTime(timeObj) {
    if (!timeObj) return '';
    if (timeObj.status === 'DONE' || (timeObj.years === 0 && timeObj.months === 0 && timeObj.days === 0)) {
        return translate('welcome.done') || 'Done';
    }
    if (timeObj.date === 'N/A' || timeObj.years === null) {
        return 'N/A';
    }
    const y = translate('time.yearsSuffix') || 'y';
    const mo = translate('time.monthsSuffix') || 'm';
    const d = translate('time.daysSuffix') || 'd';
    const parts = [];
    if (timeObj.years > 0) parts.push(`${timeObj.years}${y}`);
    if (timeObj.months > 0) parts.push(`${timeObj.months}${mo}`);
    if (timeObj.days > 0 || parts.length === 0) parts.push(`${timeObj.days}${d}`);
    return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Incremental render state
// Persists across calls so we can update bars without rebuilding the DOM.
// ---------------------------------------------------------------------------
const renderState = {
    renderedTag: null,      // player tag of the last full rebuild
    lastProgress: null,     // progress snapshot after the last completed animation
    isAnimating: false,     // true while the fill-in transition is running
    pendingSnapshot: null,  // { progress, subData } queued to apply after animation
};

/**
 * Builds the sub-row data (remaining counts + times) for all three ore types.
 */
function buildSubData(progress, state) {
    const monthlyIncome = state.derived?.totalMonthlyIncome || {};
    const shinyRemaining = progress.shinyTotal - progress.shinySpent;
    const glowyRemaining = progress.glowyTotal - progress.glowySpent;
    const starryRemaining = progress.starryTotal - progress.starrySpent;

    const rawTime = calculateRemainingTime(
        { shiny: shinyRemaining, glowy: glowyRemaining, starry: starryRemaining },
        monthlyIncome
    );

    const col = translate('homeProfile.remainingColon') || 'Remaining:';

    return {
        shiny:  { spent: progress.shinySpent,  total: progress.shinyTotal,  remaining: shinyRemaining,  time: formatRemainingTime(rawTime?.shiny),  col },
        glowy:  { spent: progress.glowySpent,  total: progress.glowyTotal,  remaining: glowyRemaining,  time: formatRemainingTime(rawTime?.glowy),  col },
        starry: { spent: progress.starrySpent, total: progress.starryTotal, remaining: starryRemaining, time: formatRemainingTime(rawTime?.starry), col },
    };
}

/**
 * Renders the bottom sub-row HTML for one ore type (either maxed label or two-line remaining).
 */
function subtextHTML(key, pct, subData) {
    if (pct >= 100) {
        return `<div class="stat-box-maxed">✓ ${translate('homeProfile.maxed') || 'Maxed'}</div>`;
    }
    const { spent, total, remaining, time, col } = subData[key];
    return `<div class="stat-box-sub">
        <div>${formatNumber(spent)} / ${formatNumber(total)}</div>
        <div>${col} ${formatNumber(remaining)} | ${time}</div>
    </div>`;
}

/**
 * Applies a delta update to already-rendered bars without rebuilding innerHTML.
 * Shows a green overlay for gains and a red overlay for losses.
 * Returns false if a full rebuild is needed (e.g. overall maxed state toggled).
 */
function applyProgressDelta(container, prevProg, currProg, subData, state) {
    // If the row visibility needs to change (overall crossed 100%), do a full rebuild.
    if ((prevProg.overall >= 100) !== (currProg.overall >= 100)) return false;

    const oreKeys = ['overall', 'shiny', 'glowy', 'starry'];

    for (const key of oreKeys) {
        const prev = prevProg[key] || 0;
        const curr = currProg[key] || 0;
        const delta = curr - prev;

        const barWrap = container.querySelector(`[data-ore="${key}"]`);
        if (!barWrap) continue;

        const fill = barWrap.querySelector('.progress-bar-fill');
        if (!fill) continue;

        // Remove stale overlays from a previous delta pass.
        barWrap.querySelectorAll('.bar-delta-overlay').forEach(el => el.remove());

        // Update the gold-glow class.
        fill.classList.toggle('maxed-fill', curr >= 100);

        if (key === 'overall') {
            if (curr >= 100) {
                fill.style.background = '';
            } else {
                fill.style.background = getOverallGradient(currProg);
            }
        }

        if (Math.abs(delta) >= 0.5) {
            const overlay = document.createElement('div');
            overlay.className = `bar-delta-overlay ${delta > 0 ? 'delta-positive' : 'delta-negative'}`;

            if (delta > 0) {
                // Green strip animates from prev → curr
                overlay.style.cssText = `left:${Math.min(prev, 100)}%; width:0;`;
                barWrap.appendChild(overlay);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        overlay.style.width = `${Math.min(delta, 100 - prev)}%`;
                        fill.style.width = `${Math.min(curr, 100)}%`;
                    });
                });
            } else {
                // Red strip shows the lost portion then fades.
                overlay.style.cssText = `left:${Math.max(curr, 0)}%; width:${Math.abs(delta)}%;`;
                barWrap.appendChild(overlay);
                fill.style.width = `${Math.max(curr, 0)}%`;
                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.5s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 500);
                }, 2500);
            }
        } else {
            fill.style.width = `${Math.min(curr, 100)}%`;
        }

        // Update the % label.
        const valEl = container.querySelector(`[data-ore-value="${key}"]`);
        if (valEl) valEl.textContent = `${curr}%`;

        // Update the storage progress bar indicator.
        if (key !== 'overall' && state) {
            const storageBar = barWrap.querySelector('.progress-bar-storage');
            if (storageBar) {
                const storedVal = state.storedOres?.[key] || 0;
                const totalVal = currProg[`${key}Total`] || 0;
                const storagePct = totalVal > 0 ? (storedVal / totalVal) * 100 : 0;
                storageBar.style.width = `${storagePct}%`;
            }
        }

        // Update the subtext for individual ore boxes.
        if (key !== 'overall') {
            const statBox = barWrap.closest('.profile-stat-box');
            if (!statBox) continue;

            const existing = statBox.querySelector('.stat-box-sub, .stat-box-maxed');
            if (!existing) continue;

            const wasMaxed = existing.classList.contains('stat-box-maxed');
            const isMaxed  = curr >= 100;

            if (isMaxed && !wasMaxed) {
                // Transition subtext → maxed label
                const el = document.createElement('div');
                el.className = 'stat-box-maxed';
                el.textContent = `✓ ${translate('homeProfile.maxed') || 'Maxed'}`;
                existing.replaceWith(el);
            } else if (!isMaxed && wasMaxed) {
                // Transition maxed label → subtext (edge case: regressed)
                const { spent, total, remaining, time, col } = subData[key];
                const el = document.createElement('div');
                el.className = 'stat-box-sub';
                el.innerHTML = `<div>${formatNumber(spent)} / ${formatNumber(total)}</div>
                    <div>${col} ${formatNumber(remaining)} | ${time}</div>`;
                existing.replaceWith(el);
            } else if (!isMaxed) {
                // Update existing subtext numbers in place.
                const { spent, total, remaining, time, col } = subData[key];
                existing.innerHTML = `<div>${formatNumber(spent)} / ${formatNumber(total)}</div>
                    <div>${col} ${formatNumber(remaining)} | ${time}</div>`;
            }
        }
    }

    // Update overall section corner radius.
    container.querySelector('.home-profile-overall-progress')
        ?.classList.toggle('fully-maxed', currProg.overall >= 100);

    return true;
}

/**
 * Triggers the CSS width transition on all bar fills and calls onComplete when done.
 */
function triggerFillAnimation(container, onComplete) {
    let fired = false;
    const done = () => { if (!fired) { fired = true; onComplete(); } };

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.querySelectorAll('.progress-bar-fill[data-bar-width]').forEach(bar => {
                bar.style.width = bar.dataset.barWidth;
            });

            const firstFill = container.querySelector('.progress-bar-fill[data-bar-width]');
            if (firstFill) {
                firstFill.addEventListener('transitionend', done, { once: true });
                setTimeout(done, 1200); // Safety fallback if transitionend never fires.
            } else {
                done();
            }
        });
    });
}

/**
 * Main function to render the Home tab profile card.
 */
export function renderHomeProfile(state) {
    const cardContainer = document.getElementById('home-player-profile-card');
    if (!cardContainer) return;

    const profile = state.playerProfile;

    // ── No profile connected ────────────────────────────────────────────────
    if (!profile) {
        renderState.renderedTag   = null;
        renderState.lastProgress  = null;
        renderState.isAnimating   = false;
        renderState.pendingSnapshot = null;

        cardContainer.innerHTML = `
            <div class="home-profile-unconnected">
                <div class="unconnected-icon-wrapper">
                    <orecalc-assets-svg name="user" height="32" width="32" class="unconnected-icon"></orecalc-assets-svg>
                </div>
                <h3 data-i18n="homeProfile.noProfileTitle">${translate('homeProfile.noProfileTitle') || 'No Profile Connected'}</h3>
                <p data-i18n="homeProfile.noProfileDesc">${translate('homeProfile.noProfileDesc') || 'Connect your player tag to see your Town Hall, active heroes, and equipment progress directly on the homepage.'}</p>
                <button id="home-profile-connect-btn" class="accept-button">
                    <orecalc-assets-svg name="plus" height="16" width="16"></orecalc-assets-svg>
                    <span data-i18n="homeProfile.connectBtn">${translate('homeProfile.connectBtn') || 'Connect Profile'}</span>
                </button>
            </div>
        `;
        cardContainer.style.display = 'block';

        document.getElementById('home-profile-connect-btn')
            ?.addEventListener('click', () => showAddPlayerModal());
        return;
    }

    // ── Calculate progress ──────────────────────────────────────────────────
    let ownedHeroes    = profile.ownedHeroes    || {};
    let ownedEquipment = profile.ownedEquipment || {};

    const isGuest = profile.tag === 'DEFAULT0';
    if (isGuest && state.heroes) {
        ownedHeroes = {};
        ownedEquipment = {};
        for (const heroName in state.heroes) {
            const heroState = state.heroes[heroName];
            if (heroState.enabled !== false) {
                ownedHeroes[heroName] = {
                    level: 1,
                    maxLevel: 95
                };
                if (heroState.equipment) {
                    for (const equipName in heroState.equipment) {
                        const eqState = heroState.equipment[equipName];
                        if (eqState && eqState.checked !== false) {
                            ownedEquipment[equipName] = eqState.level || 1;
                        }
                    }
                }
            }
        }
    }

    const progress = calculateEquipmentProgress(ownedEquipment, ownedHeroes);

    let maxedCount = 0;
    let totalCount = 0;
    for (const heroKey in heroData) {
        for (const equip of heroData[heroKey].equipment) {
            totalCount++;
            const isEpic = equip.type === 'epic';
            const maxLevel = isEpic ? 27 : 18;
            const currentLevel = ownedEquipment[equip.name];
            if (currentLevel !== undefined && currentLevel >= maxLevel) {
                maxedCount++;
            }
        }
    }
    const subData  = buildSubData(progress, state);

    const stored = state.storedOres || {};
    const shinyStoragePct = progress.shinyTotal > 0 ? ((stored.shiny || 0) / progress.shinyTotal) * 100 : 0;
    const glowyStoragePct = progress.glowyTotal > 0 ? ((stored.glowy || 0) / progress.glowyTotal) * 100 : 0;
    const starryStoragePct = progress.starryTotal > 0 ? ((stored.starry || 0) / progress.starryTotal) * 100 : 0;

    // ── Incremental update path (same player already rendered) ──────────────
    if (profile.tag === renderState.renderedTag &&
        (renderState.lastProgress !== null || renderState.isAnimating)) {
        if (renderState.isAnimating) {
            // Animation still running — queue for after it finishes.
            renderState.pendingSnapshot = { progress, subData };
            return;
        }

        // Apply delta to existing DOM.
        const ok = applyProgressDelta(cardContainer, renderState.lastProgress, progress, subData, state);
        if (ok) {
            renderState.lastProgress = progress;
            return;
        }
        // Fall through to full rebuild if overall maxed state toggled.
    }

    // ── Full rebuild (new player, or maxed-state change) ───────────────────
    renderState.renderedTag    = profile.tag;
    renderState.lastProgress   = null;
    renderState.pendingSnapshot = null;
    renderState.isAnimating    = true;

    // Header: TH badge, name, clan, league
    const thLevel  = profile.townHallLevel || 1;
    const thImgUrl = `assets/th/th${thLevel}.png`;

    let clanHtml = '';
    if (profile.clan?.name) {
        const badgeUrl  = profile.clan.badgeUrls?.small || '';
        const badgeImg  = badgeUrl ? `<img class="clan-badge-img-mini" src="${badgeUrl}" alt="Clan Badge">` : '';
        const roleText  = profile.role ? `<span class="clan-role-mini">${formatClanRole(profile.role)}</span>` : '';
        clanHtml = `<div class="player-clan-mini">${badgeImg}<div class="clan-info-col"><span class="clan-name-mini">${profile.clan.name}</span>${roleText}</div></div>`;
    } else {
        clanHtml = `<div class="player-clan-mini"><span class="clan-name-mini text-muted" data-i18n="welcome.noClan">${translate('welcome.noClan') || 'No Clan'}</span></div>`;
    }

    const leagueId   = parseInt(profile.leagueTier?.id || 105000000, 10);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);
    let leagueIconHtml  = `<orecalc-assets-svg name="star-badge" height="24" width="24" class="league-default-icon"></orecalc-assets-svg>`;
    let leagueNameText  = translate('leagues.unranked') || 'Unranked';

    if (leagueData) {
        const leagueKey = 'leagues.' + leagueData.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        leagueNameText = translate(leagueKey);
        const imgUrl = leagueData.iconUrls?.small || '';
        if (imgUrl) leagueIconHtml = `<img class="league-badge-img-mini" src="${imgUrl}" alt="${leagueNameText}">`;
    }

    const tagHtml = isGuest
        ? `<span class="player-tag-guest-badge">${translate('welcome.guestProfileTag') || 'Guest Profile'}</span>`
        : `<span class="player-tag">${profile.tag}</span>`;

    cardContainer.innerHTML = `
        <div class="home-profile-header${isGuest ? ' is-guest' : ''}">
            <div class="profile-meta-left">
                <div class="th-badge-wrapper">
                    <orecalc-assets-image class="th-badge-img" src="${thImgUrl}" alt="Town Hall" size="standard"></orecalc-assets-image>
                    <span class="th-badge-level-overlay">${thLevel}</span>
                </div>
                <div class="player-identity">
                    <h3 class="player-name">${profile.name}</h3>
                    ${tagHtml}
                    ${clanHtml}
                </div>
            </div>

            <div class="profile-meta-right">
                <div class="league-details-mini" title="${leagueNameText}">
                    ${leagueIconHtml}
                    <div class="league-text-mini">
                        <span class="league-name-mini">${leagueNameText}</span>
                        <div class="player-trophies-mini">
                            <orecalc-assets-svg name="trophy" height="12" width="12" class="trophy-icon-mini"></orecalc-assets-svg>
                            <span>${formatNumber(profile.trophies)}</span>
                        </div>
                    </div>
                </div>
                <div class="player-maxed-equip-mini" title="${translate('homeProfile.maxedEquipment') || 'Maxed Equipment'}">
                    <orecalc-assets-svg name="equipment-filled" height="12" width="12" class="maxed-equip-icon-mini"></orecalc-assets-svg>
                    <span>${maxedCount}/${totalCount} ${translate('homeProfile.maxedEquipment') || 'Maxed Equipment'}</span>
                </div>
            </div>
        </div>

        <div class="home-profile-stats-container">
            <div class="home-profile-overall-progress${progress.overall >= 100 ? ' fully-maxed' : ''}">
                <div class="overall-progress-header">
                    <span class="overall-progress-label-wrapper">
                        <img class="ore-icon-overall" src="assets/ore_icon.png" alt="Ore">
                        <span class="overall-progress-label" data-i18n="homeProfile.overallProgress">${translate('homeProfile.overallProgress') || 'Overall Ore Progress'}</span>
                    </span>
                    <span class="overall-progress-value" data-ore-value="overall">${progress.overall}%</span>
                </div>
                <div class="progress-bar-overall" data-ore="overall">
                    <div class="progress-bar-fill overall-fill ${progress.overall >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.overall}%" style="${progress.overall < 100 ? `background: ${getOverallGradient(progress)}` : ''}"></div>
                </div>
            </div>

            ${progress.overall < 100 ? `<div class="home-profile-stats-row">
                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <img class="ore-icon-mini" src="assets/shiny_ore.png" alt="Shiny">
                            <span class="stat-box-label" data-i18n="ores.shiny">${translate('ores.shiny') || 'Shiny Ore'}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="shiny">${progress.shiny}%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="shiny">
                        <div class="progress-bar-storage" style="width: ${shinyStoragePct}%"></div>
                        <div class="progress-bar-fill shiny-fill ${progress.shiny >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.shiny}%"></div>
                    </div>
                    ${subtextHTML('shiny', progress.shiny, subData)}
                </div>
                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <img class="ore-icon-mini" src="assets/glowy_ore.png" alt="Glowy">
                            <span class="stat-box-label" data-i18n="ores.glowy">${translate('ores.glowy') || 'Glowy Ore'}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="glowy">${progress.glowy}%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="glowy">
                        <div class="progress-bar-storage" style="width: ${glowyStoragePct}%"></div>
                        <div class="progress-bar-fill glowy-fill ${progress.glowy >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.glowy}%"></div>
                    </div>
                    ${subtextHTML('glowy', progress.glowy, subData)}
                </div>
                <div class="profile-stat-box progress-box">
                    <div class="stat-box-header">
                        <span class="stat-box-label-wrapper">
                            <img class="ore-icon-mini" src="assets/starry_ore.png" alt="Starry">
                            <span class="stat-box-label" data-i18n="ores.starry">${translate('ores.starry') || 'Starry Ore'}</span>
                        </span>
                        <span class="stat-box-value" data-ore-value="starry">${progress.starry}%</span>
                    </div>
                    <div class="progress-bar-mini" data-ore="starry">
                        <div class="progress-bar-storage" style="width: ${starryStoragePct}%"></div>
                        <div class="progress-bar-fill starry-fill ${progress.starry >= 100 ? 'maxed-fill' : ''}" data-bar-width="${progress.starry}%"></div>
                    </div>
                    ${subtextHTML('starry', progress.starry, subData)}
                </div>
            </div>` : ''}
            <div class="home-profile-sync-notice${isGuest ? ' guest-notice' : ''}">
                <orecalc-assets-svg name="${isGuest ? 'info' : 'cloud-lock'}" class="sync-notice-icon" height="14" width="14"></orecalc-assets-svg>
                <span data-i18n="${isGuest ? 'homeProfile.guestNotice' : 'homeProfile.syncNotice'}">${isGuest ? (translate('homeProfile.guestNotice') || 'Guest Profile: Connect a player tag to enable automatic progress syncing.') : (translate('homeProfile.syncNotice') || 'Note: Progress metrics are based strictly on synced game data. Manual planner selections, manual level changes, and stored ores are excluded from these totals and will only update upon the next API sync.')}</span>
            </div>
        </div>
    `;

    cardContainer.style.display = 'block';

    triggerFillAnimation(cardContainer, () => {
        renderState.isAnimating  = false;
        renderState.lastProgress = progress;

        // Apply any update that arrived while the animation was running.
        if (renderState.pendingSnapshot) {
            const { progress: pProg, subData: pSub } = renderState.pendingSnapshot;
            renderState.pendingSnapshot = null;

            const ok = applyProgressDelta(cardContainer, progress, pProg, pSub, state);
            if (ok) {
                renderState.lastProgress = pProg;
            } else {
                // Overall maxed state changed — need a proper rebuild.
                // Synthesise a minimal state object for the recursive call.
                renderHomeProfile(state);
            }
        }
    });
}
