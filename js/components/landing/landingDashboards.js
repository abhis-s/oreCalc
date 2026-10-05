import { getOverallGradient } from '../../domain/equipment/equipmentProgressDomain.js';
import { heroData } from '../../data/heroData.js';
import { heroJourneyNodes } from '../../data/heroJourneyData.js';
import { translate } from '../../i18n/translator.js';
import { animateValue } from '../../utils/numberFormatter.js';

/** @type {ResizeObserver | null} */
let toolCardsResizeObserver = null;

/**
 * Initializes a space-based ResizeObserver on progression tool cards.
 * Disconnects previous observers on re-render to avoid memory leaks.
 */
export function initToolCardsLayoutObserver() {
    const cards = document.querySelectorAll('.landing-tool-card');
    if (cards.length === 0 || typeof ResizeObserver === 'undefined') return;

    if (toolCardsResizeObserver) {
        toolCardsResizeObserver.disconnect();
    }

    toolCardsResizeObserver = new ResizeObserver(() => {
        updateToolCardsLayout();
    });

    cards.forEach(card => toolCardsResizeObserver?.observe(card));
    updateToolCardsLayout();
}

/**
 * Evaluates available horizontal space on tool cards and toggles compact header and pills modes.
 */
function updateToolCardsLayout() {
    const cards = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.landing-tool-card'));
    if (cards.length === 0) return;

    // Batch Read Phase: Calculate layout requirements without mutating the DOM
    const layoutDecisions = [];
    for (const card of cards) {
        // Evaluate stat pills row space constraint (each pill needs >= 100px for unclipped localized text)
        const pillsRow = card.querySelector('.live-stat-pills-row');
        let shouldBeCompactPills = false;
        let hasPillsRow = false;
        if (pillsRow) {
            hasPillsRow = true;
            const requiredPillsWidth = 330;
            const isCurrentlyCompactPills = card.classList.contains('is-compact-pills');
            const pillsThreshold = isCurrentlyCompactPills ? requiredPillsWidth + 16 : requiredPillsWidth;
            shouldBeCompactPills = card.clientWidth < pillsThreshold;
        }

        layoutDecisions.push({
            card,
            hasPillsRow,
            shouldBeCompactPills
        });
    }

    // Batch Write Phase: Apply layout class updates without interleaving DOM measurements
    for (const { card, hasPillsRow, shouldBeCompactPills } of layoutDecisions) {
        if (hasPillsRow) {
            card.classList.toggle('is-compact-pills', shouldBeCompactPills);
        }
    }
}

/** @type {{ overall: number, shiny: number, glowy: number, starry: number } | null} */
let lastLiveOreProgress = null;

/** @type {{ cumulativeLevel: number, thCap: number, overallMax: number, progressPercent: number, isThMaxed: boolean, isTrackMaxed: boolean, thLevel: number } | null} */
let lastLiveHjProgress = null;

/** @type {number | null} */
let lastLiveThLevel = null;

/**
 * Renders live telemetry progress inside the tool cards for an active village.
 * Uses double-requestAnimationFrame and animateValue to provide smooth 2000ms animations
 * matching the signature visual fidelity of OreCalc and Hero's Journey.
 * @param {any} oreProgress
 * @param {{ cumulativeLevel: number, thCap: number, overallMax: number, progressPercent: number, isThMaxed: boolean, isTrackMaxed: boolean }} hjProgress
 * @param {number} [thLevel=18]
 */
export function renderLiveDashboards(oreProgress, hjProgress, thLevel = 18) {
    const landingOreProgress = document.getElementById('landing-ore-progress');
    const landingHjProgress = document.getElementById('landing-hj-progress');
    const landingDamageProgress = document.getElementById('landing-damage-progress');
    const oreBadge = document.getElementById('landing-ore-badge');
    const hjBadge = document.getElementById('landing-hj-badge');
    const oreDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--ore .landing-tool-card__desc'));
    const hjDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--hj .landing-tool-card__desc'));
    const damageDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--damage .landing-tool-card__desc'));

    if (oreDesc) oreDesc.style.display = 'none';
    if (hjDesc) hjDesc.style.display = 'none';
    if (damageDesc) damageDesc.style.display = 'none';

    const overallGradient = getOverallGradient(oreProgress) || 'linear-gradient(90deg, #38bdf8 0%, #a855f7 50%, #eab308 100%)';
    const isMaxed = hjProgress.isTrackMaxed || hjProgress.isThMaxed;
    let milestoneText;
    let compactMilestoneText;
    if (hjProgress.isTrackMaxed) {
        milestoneText = translate('views.planner.completed');
        compactMilestoneText = milestoneText;
    } else if (hjProgress.isThMaxed) {
        milestoneText = translate('views.landing.thMaxed', { th: thLevel });
        compactMilestoneText = milestoneText;
    } else {
        const remaining = Math.max(0, hjProgress.thCap - hjProgress.cumulativeLevel);
        milestoneText = translate('views.landing.levelsToMax', { count: remaining });
        compactMilestoneText = translate('views.landing.levelsToMaxCompact', { count: remaining });
    }

    const oreAlreadyMounted = Boolean(landingOreProgress?.querySelector('.live-progress-overall'));
    const hjAlreadyMounted = Boolean(landingHjProgress?.querySelector('.live-progress-overall'));
    const damageAlreadyMounted = Boolean(landingDamageProgress?.querySelector('.live-progress-overall'));

    if (oreAlreadyMounted && hjAlreadyMounted && damageAlreadyMounted && lastLiveOreProgress && lastLiveHjProgress && lastLiveThLevel !== null) {
        const prevOre = lastLiveOreProgress;
        const prevHj = lastLiveHjProgress;

        if (landingOreProgress) {
            landingOreProgress.hidden = false;
            const oreBar = /** @type {HTMLElement | null} */ (landingOreProgress.querySelector('[data-live-bar="ore"]'));
            if (oreBar) {
                oreBar.style.background = overallGradient;
                oreBar.style.width = `${oreProgress.overall}%`;
                oreBar.parentElement?.setAttribute('aria-valuenow', String(oreProgress.overall));
            }

            const orePctEl = landingOreProgress.querySelector('[data-live-ore-val="overall"]');
            if (orePctEl) animateValue(orePctEl, prevOre.overall, oreProgress.overall, 2000, val => `${Math.round(val)}%`);
            if (oreBadge) animateValue(oreBadge, prevOre.overall, oreProgress.overall, 2000, val => translate('views.landing.pctMaxed', { pct: Math.round(val) }));

            for (const key of ['shiny', 'glowy', 'starry']) {
                const el = landingOreProgress.querySelector(`[data-live-ore-val="${key}"]`);
                if (el) animateValue(el, prevOre[key] ?? 0, oreProgress[key], 1800, val => `${Math.round(val)}%`);
            }
        }

        if (landingHjProgress) {
            landingHjProgress.hidden = false;
            const hjBar = /** @type {HTMLElement | null} */ (landingHjProgress.querySelector('[data-live-bar="hj"]'));
            if (hjBar) {
                hjBar.style.width = `${hjProgress.progressPercent}%`;
                hjBar.parentElement?.setAttribute('aria-valuenow', String(hjProgress.cumulativeLevel));
                hjBar.parentElement?.setAttribute('aria-valuemax', String(hjProgress.thCap));
            }

            const hjPctEl = landingHjProgress.querySelector('[data-live-hj-val="track"]');
            if (hjPctEl) animateValue(hjPctEl, prevHj.progressPercent, hjProgress.progressPercent, 2000, val => `${Math.round(val)}%`);

            if (hjBadge) {
                hjBadge.hidden = false;
                if (hjProgress.isTrackMaxed) {
                    hjBadge.textContent = translate('views.planner.completed');
                } else if (hjProgress.isThMaxed) {
                    hjBadge.textContent = translate('views.landing.thMaxed', { th: thLevel });
                } else {
                    animateValue(hjBadge, prevHj.progressPercent, hjProgress.progressPercent, 2000, val => translate('views.landing.pctMaxed', { pct: Math.round(val) }));
                }
            }

            const heroLevelsEl = landingHjProgress.querySelector('[data-live-hj-val="heroLevels"]');
            if (heroLevelsEl) animateValue(heroLevelsEl, prevHj.cumulativeLevel, hjProgress.cumulativeLevel, 1800, val => `${Math.round(val)} / ${hjProgress.thCap}`);

            const trackProgEl = landingHjProgress.querySelector('[data-live-hj-val="trackProgress"]');
            if (trackProgEl) animateValue(trackProgEl, prevHj.progressPercent, hjProgress.progressPercent, 1800, val => `${Math.round(val)}%`);

            const thImg = /** @type {HTMLElement | null} */ (landingHjProgress.querySelector('[data-live-hj="milestone"] .stat-pill-icon'));
            if (thImg) {
                thImg.setAttribute('src', `assets/th/th${thLevel}.png`);
                thImg.setAttribute('alt', translate('views.equipment.thShort', { level: thLevel }));
                thImg.setAttribute('data-i18n-alt', 'views.equipment.thShort');
                thImg.setAttribute('data-i18n-alt-args', JSON.stringify({ level: thLevel }));
            }

            const milestoneEl = landingHjProgress.querySelector('[data-live-hj-val="milestone"]');
            if (milestoneEl) {
                milestoneEl.setAttribute('title', milestoneText);
                if (isMaxed) {
                    milestoneEl.textContent = compactMilestoneText;
                } else {
                    const prevRemaining = Math.max(0, (prevHj.thCap || hjProgress.thCap) - (prevHj.cumulativeLevel || 0));
                    const newRemaining = Math.max(0, hjProgress.thCap - hjProgress.cumulativeLevel);
                    animateValue(milestoneEl, prevRemaining, newRemaining, 1800, val => translate('views.landing.levelsToMaxCompact', { count: Math.round(val) }));
                }
            }
        }

        if (landingDamageProgress) {
            landingDamageProgress.hidden = false;
            const titleEl = landingDamageProgress.querySelector('[data-live-damage-val="title"]');
            if (titleEl) {
                titleEl.textContent = translate('views.landing.combatProfilesTitle', { th: thLevel });
                titleEl.setAttribute('data-i18n', 'views.landing.combatProfilesTitle');
                titleEl.setAttribute('data-i18n-args', JSON.stringify({ th: thLevel }));
            }
        }
    } else {
        if (oreBadge) {
            oreBadge.hidden = false;
            oreBadge.removeAttribute('data-i18n');
            oreBadge.textContent = translate('views.landing.pctMaxed', { pct: 0 });
            oreBadge.style.display = 'inline-flex';
        }

        if (hjBadge) {
            hjBadge.hidden = false;
            hjBadge.removeAttribute('data-i18n');
            if (hjProgress.isTrackMaxed) {
                hjBadge.textContent = translate('views.planner.completed');
            } else if (hjProgress.isThMaxed) {
                hjBadge.textContent = translate('views.landing.thMaxed', { th: thLevel });
            } else {
                hjBadge.textContent = translate('views.landing.pctMaxed', { pct: 0 });
            }
            hjBadge.style.display = 'inline-flex';
        }

        if (landingOreProgress) {
            landingOreProgress.innerHTML = `
                <div class="live-progress-overall">
                    <div class="live-progress-header">
                        <span class="live-progress-title" data-i18n="views.home.profile.overallProgress">${translate('views.home.profile.overallProgress')}</span>
                        <span class="live-progress-pct" data-live-ore-val="overall">0%</span>
                    </div>
                    <div class="live-progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="${translate('views.home.profile.overallProgress')}" data-i18n-aria-label="views.home.profile.overallProgress">
                        <div class="live-progress-fill" data-live-bar="ore" style="width: 0; background: ${overallGradient};"></div>
                    </div>
                    <div class="live-stat-pills-row">
                        <div class="live-stat-pill" data-live-ore="shiny">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/shiny_ore.png" alt="${translate('entities.ores.shinyShort')}" data-i18n-alt="entities.ores.shinyShort" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="entities.ores.shinyShort">${translate('entities.ores.shinyShort')}</span>
                                <span class="stat-pill-val" data-live-ore-val="shiny">0%</span>
                            </div>
                        </div>
                        <div class="live-stat-pill" data-live-ore="glowy">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/glowy_ore.png" alt="${translate('entities.ores.glowyShort')}" data-i18n-alt="entities.ores.glowyShort" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="entities.ores.glowyShort">${translate('entities.ores.glowyShort')}</span>
                                <span class="stat-pill-val" data-live-ore-val="glowy">0%</span>
                            </div>
                        </div>
                        <div class="live-stat-pill" data-live-ore="starry">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/starry_ore.png" alt="${translate('entities.ores.starryShort')}" data-i18n-alt="entities.ores.starryShort" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="entities.ores.starryShort">${translate('entities.ores.starryShort')}</span>
                                <span class="stat-pill-val" data-live-ore-val="starry">0%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            landingOreProgress.hidden = false;
            landingOreProgress.style.display = 'flex';
        }

        if (landingHjProgress) {
            landingHjProgress.innerHTML = `
                <div class="live-progress-overall">
                    <div class="live-progress-header">
                        <span class="live-progress-title" data-i18n="views.landing.trackProgressShort">${translate('views.landing.trackProgressShort')}</span>
                        <span class="live-progress-pct" data-live-hj-val="track">0%</span>
                    </div>
                    <div class="live-progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${hjProgress.thCap}" aria-label="${translate('views.landing.trackProgressShort')}" data-i18n-aria-label="views.landing.trackProgressShort">
                        <div class="live-progress-fill" data-live-bar="hj"></div>
                    </div>
                    <div class="live-stat-pills-row">
                        <div class="live-stat-pill" data-live-hj="heroLevels">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/heroes/emblemBarbarianKing.png" alt="${translate('views.landing.heroLevelsShort')}" data-i18n-alt="views.landing.heroLevelsShort" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="views.landing.heroLevelsShort">${translate('views.landing.heroLevelsShort')}</span>
                                <span class="stat-pill-val" data-live-hj-val="heroLevels">0 / ${hjProgress.thCap}</span>
                            </div>
                        </div>
                        <div class="live-stat-pill" data-live-hj="trackProgress">
                            <orecalc-assets-svg name="timeline" width="16" height="16" class="stat-pill-icon" aria-hidden="true"></orecalc-assets-svg>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="views.landing.trackProgressShort">${translate('views.landing.trackProgressShort')}</span>
                                <span class="stat-pill-val" data-live-hj-val="trackProgress">0%</span>
                            </div>
                        </div>
                        <div class="live-stat-pill" data-live-hj="milestone">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/th/th${thLevel}.png" alt="${translate('views.equipment.thShort', { level: thLevel })}" data-i18n-alt="views.equipment.thShort" data-i18n-alt-args='{"level":${thLevel}}' size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="views.landing.milestoneStatus">${translate('views.landing.milestoneStatus')}</span>
                                <span class="stat-pill-val" data-live-hj-val="milestone" title="${milestoneText}">${compactMilestoneText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            landingHjProgress.hidden = false;
            landingHjProgress.style.display = 'flex';
        }

        if (landingDamageProgress) {
            landingDamageProgress.innerHTML = `
                <div class="live-progress-overall">
                    <div class="live-progress-header">
                        <span class="live-progress-title" data-live-damage-val="title" data-i18n="views.landing.combatProfilesTitle" data-i18n-args='{"th":${thLevel}}'>${translate('views.landing.combatProfilesTitle', { th: thLevel })}</span>
                        <span class="live-progress-pct is-muted" aria-hidden="true">&mdash;</span>
                    </div>
                    <div class="live-progress-bar is-disabled" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-disabled="true" aria-label="${translate('views.landing.combatProfilesTitle', { th: thLevel })}" data-i18n-aria-label="views.landing.combatProfilesTitle" data-i18n-aria-label-args='{"th":${thLevel}}'>
                        <div class="live-progress-fill" data-live-bar="damage" style="width: 0;"></div>
                    </div>
                    <div class="live-stat-pills-row">
                        <div class="live-stat-pill" data-live-damage="zapquake">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/spells/lightning.png" alt="${translate('views.landing.jumpZapQuake')}" data-i18n-alt="views.landing.jumpZapQuake" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="views.landing.jumpZapQuake">${translate('views.landing.jumpZapQuake')}</span>
                                <span class="stat-pill-val" data-i18n="views.landing.statOptimalSpells">${translate('views.landing.statOptimalSpells')}</span>
                            </div>
                        </div>
                        <div class="live-stat-pill" data-live-damage="equipment">
                            <orecalc-assets-image class="stat-pill-icon" src="assets/equipment/archer_queen/AQ_giant_arrow.png" alt="${translate('views.damageCalc.offense.equipmentDamageBadge')}" data-i18n-alt="views.damageCalc.offense.equipmentDamageBadge" size="standard"></orecalc-assets-image>
                            <div class="stat-pill-text">
                                <span class="stat-pill-name" data-i18n="views.damageCalc.offense.equipmentDamageBadge">${translate('views.damageCalc.offense.equipmentDamageBadge')}</span>
                                <span class="stat-pill-val" data-i18n="views.landing.statLiveThresholds">${translate('views.landing.statLiveThresholds')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            landingDamageProgress.hidden = false;
            landingDamageProgress.style.display = 'flex';
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const oreBar = /** @type {HTMLElement | null} */ (landingOreProgress?.querySelector('[data-live-bar="ore"]'));
                if (oreBar) {
                    oreBar.style.width = `${oreProgress.overall}%`;
                    oreBar.parentElement?.setAttribute('aria-valuenow', String(oreProgress.overall));
                }

                const hjBar = /** @type {HTMLElement | null} */ (landingHjProgress?.querySelector('[data-live-bar="hj"]'));
                if (hjBar) {
                    hjBar.style.width = `${hjProgress.progressPercent}%`;
                    hjBar.parentElement?.setAttribute('aria-valuenow', String(hjProgress.cumulativeLevel));
                }

                const orePctEl = landingOreProgress?.querySelector('[data-live-ore-val="overall"]');
                if (orePctEl) animateValue(orePctEl, 0, oreProgress.overall, 2000, val => `${Math.round(val)}%`);
                if (oreBadge) animateValue(oreBadge, 0, oreProgress.overall, 2000, val => translate('views.landing.pctMaxed', { pct: Math.round(val) }));

                for (const key of ['shiny', 'glowy', 'starry']) {
                    const el = landingOreProgress?.querySelector(`[data-live-ore-val="${key}"]`);
                    if (el) animateValue(el, 0, oreProgress[key], 1800, val => `${Math.round(val)}%`);
                }

                const hjPctEl = landingHjProgress?.querySelector('[data-live-hj-val="track"]');
                if (hjPctEl) animateValue(hjPctEl, 0, hjProgress.progressPercent, 2000, val => `${Math.round(val)}%`);

                if (hjBadge && !isMaxed) {
                    animateValue(hjBadge, 0, hjProgress.progressPercent, 2000, val => translate('views.landing.pctMaxed', { pct: Math.round(val) }));
                }

                const heroLevelsEl = landingHjProgress?.querySelector('[data-live-hj-val="heroLevels"]');
                if (heroLevelsEl) animateValue(heroLevelsEl, 0, hjProgress.cumulativeLevel, 1800, val => `${Math.round(val)} / ${hjProgress.thCap}`);

                const trackProgEl = landingHjProgress?.querySelector('[data-live-hj-val="trackProgress"]');
                if (trackProgEl) animateValue(trackProgEl, 0, hjProgress.progressPercent, 1800, val => `${Math.round(val)}%`);

                const milestoneEl = landingHjProgress?.querySelector('[data-live-hj-val="milestone"]');
                if (milestoneEl && !isMaxed) {
                    const remaining = Math.max(0, hjProgress.thCap - hjProgress.cumulativeLevel);
                    animateValue(milestoneEl, hjProgress.thCap, remaining, 1800, val => translate('views.landing.levelsToMaxCompact', { count: Math.round(val) }));
                }
            });
        });
    }

    lastLiveOreProgress = { ...oreProgress };
    lastLiveHjProgress = { ...hjProgress, thLevel };
    lastLiveThLevel = thLevel;
    updateToolCardsLayout();
}

/**
 * Renders tool-specific capability highlights and teaser prompts inside the tool cards when no village is loaded.
 */
export function renderGuestTeasers() {
    lastLiveOreProgress = null;
    lastLiveHjProgress = null;
    lastLiveThLevel = null;
    const landingOreProgress = document.getElementById('landing-ore-progress');
    const landingHjProgress = document.getElementById('landing-hj-progress');
    const landingDamageProgress = document.getElementById('landing-damage-progress');
    const oreBadge = document.getElementById('landing-ore-badge');
    const hjBadge = document.getElementById('landing-hj-badge');
    const oreDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--ore .landing-tool-card__desc'));
    const hjDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--hj .landing-tool-card__desc'));
    const damageDesc = /** @type {HTMLElement | null} */ (document.querySelector('.landing-tool-card--damage .landing-tool-card__desc'));

    if (oreDesc) oreDesc.style.display = '';
    if (hjDesc) hjDesc.style.display = '';
    if (damageDesc) damageDesc.style.display = '';

    if (oreBadge) {
        oreBadge.hidden = false;
        oreBadge.setAttribute('data-i18n', 'views.landing.badgeCalculator');
        oreBadge.textContent = translate('views.landing.badgeCalculator');
        oreBadge.style.display = 'inline-flex';
    }
    if (hjBadge) {
        hjBadge.hidden = false;
        hjBadge.setAttribute('data-i18n', 'views.landing.badgeTracker');
        hjBadge.textContent = translate('views.landing.badgeTracker');
        hjBadge.style.display = 'inline-flex';
    }

    const totalEquipmentCount = Object.values(heroData).reduce((sum, hero) => sum + (hero.equipment ? hero.equipment.length : 0), 0);
    const totalMilestoneCount = heroJourneyNodes.length;

    if (landingOreProgress) {
        landingOreProgress.innerHTML = `
            <div class="landing-tool-card__guest-teaser">
                <div class="landing-tool-card__guest-teaser-lead">
                    <orecalc-assets-svg name="equipment-filled" width="16" height="16" class="teaser-icon" aria-hidden="true"></orecalc-assets-svg>
                    <span class="teaser-text" data-i18n="views.landing.oreGuestTeaser">${translate('views.landing.oreGuestTeaser')}</span>
                </div>
                <div class="landing-tool-card__guest-capabilities">
                    <span class="guest-capability-chip" data-i18n="views.landing.capEquipments" data-i18n-args='{"count":${totalEquipmentCount}}'>
                        <orecalc-assets-svg name="equipment-filled" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capEquipments', { count: totalEquipmentCount })}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.landing.capIncome">
                        <orecalc-assets-svg name="income-filled" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capIncome')}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.landing.capCalendar">
                        <orecalc-assets-svg name="planner-filled" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capCalendar')}
                    </span>
                </div>
            </div>
        `;
        landingOreProgress.hidden = false;
        landingOreProgress.style.display = 'flex';
    }

    if (landingHjProgress) {
        landingHjProgress.innerHTML = `
            <div class="landing-tool-card__guest-teaser">
                <div class="landing-tool-card__guest-teaser-lead">
                    <orecalc-assets-svg name="timeline" width="16" height="16" class="teaser-icon" aria-hidden="true"></orecalc-assets-svg>
                    <span class="teaser-text" data-i18n="views.landing.hjGuestTeaser">${translate('views.landing.hjGuestTeaser')}</span>
                </div>
                <div class="landing-tool-card__guest-capabilities">
                    <span class="guest-capability-chip" data-i18n="views.landing.capMilestones" data-i18n-args='{"count":${totalMilestoneCount}}'>
                        <orecalc-assets-svg name="timeline" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capMilestones', { count: totalMilestoneCount })}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.landing.capDropOdds">
                        <orecalc-assets-svg name="redeem" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capDropOdds')}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.landing.capRewardFilters">
                        <orecalc-assets-svg name="filter-alt" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capRewardFilters')}
                    </span>
                </div>
            </div>
        `;
        landingHjProgress.hidden = false;
        landingHjProgress.style.display = 'flex';
    }

    if (landingDamageProgress) {
        landingDamageProgress.innerHTML = `
            <div class="landing-tool-card__guest-teaser">
                <div class="landing-tool-card__guest-teaser-lead">
                    <orecalc-assets-svg name="bolt-planner" width="16" height="16" class="teaser-icon" aria-hidden="true"></orecalc-assets-svg>
                    <span class="teaser-text" data-i18n="views.landing.damageGuestTeaser">${translate('views.landing.damageGuestTeaser')}</span>
                </div>
                <div class="landing-tool-card__guest-capabilities">
                    <span class="guest-capability-chip" data-i18n="views.landing.capZapQuake">
                        <orecalc-assets-svg name="bolt-planner" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.capZapQuake')}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.landing.jumpEquipmentSnipes">
                        <orecalc-assets-svg name="equipment-filled" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.landing.jumpEquipmentSnipes')}
                    </span>
                    <span class="guest-capability-chip" data-i18n="views.damageCalc.tabs.clusterPlanner">
                        <orecalc-assets-svg name="timeline" width="13" height="13" class="capability-icon" aria-hidden="true"></orecalc-assets-svg>
                        ${translate('views.damageCalc.tabs.clusterPlanner')}
                    </span>
                </div>
            </div>
        `;
        landingDamageProgress.hidden = false;
        landingDamageProgress.style.display = 'flex';
    }

    updateToolCardsLayout();
}
