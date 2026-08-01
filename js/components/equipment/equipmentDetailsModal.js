import { state } from '../../core/state.js';
import { heroData } from '../../data/heroData.js';
import { getEquipmentUpgradeCost, getRequiredTownHall, getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';
import { toCamelCase } from '../../utils/stringUtils.js';

const equipmentDataCache = new Map();
const dismissedNotes = new Set();
let recommendationsCache = null;

async function getRecommendationsData() {
    if (recommendationsCache) return recommendationsCache;
    try {
        const response = await fetch('js/data/equipmentRecommendations.json');
        if (response.ok) {
            recommendationsCache = await response.json();
        }
    } catch (e) {
        console.warn('Could not load equipment recommendations dataset:', e);
        recommendationsCache = {};
    }
    return recommendationsCache || {};
}

function safeTranslate(key, fallback) {
    const res = translate(key);
    return (res && res !== key) ? res : fallback;
}

export function getRecommendedLevelForTownHall(recommendation, userTH) {
    if (!recommendation || !recommendation.recommendedLevels) return null;
    const { default: defaultLevel, byTownHall } = recommendation.recommendedLevels;
    if (!byTownHall) return defaultLevel || null;

    if (userTH) {
        const availableTHs = Object.keys(byTownHall)
            .map(Number)
            .filter(th => !isNaN(th) && th <= userTH)
            .sort((a, b) => b - a);

        if (availableTHs.length > 0) {
            return byTownHall[availableTHs[0]];
        }
    }

    return defaultLevel || null;
}

function computeStatDelta(currentVal, prevVal, deltaType, valueUnit = 'number', category = 'ability') {
    if (prevVal === undefined || prevVal === null || prevVal === 0 || currentVal === undefined || currentVal === null) {
        return '';
    }
    const rawDiff = currentVal - prevVal;
    if (rawDiff <= 0) return '';

    // Clean floating point precision issues (e.g. 0.20000000000000018 -> 0.2)
    const diff = Math.round(rawDiff * 1000) / 1000;

    // Resolve effective deltaType: heroBoost category ALWAYS uses percentage increase unless deltaType is explicitly set to 'flat'
    let effectiveDeltaType = deltaType;
    if (!effectiveDeltaType) {
        effectiveDeltaType = category === 'heroBoost' ? 'percent' : 'flat';
    }

    if (effectiveDeltaType === 'flat') {
        return `+${diff}`;
    } else {
        const pct = Math.round((rawDiff / prevVal) * 100);
        if (pct > 99) {
            return `+${diff}`;
        }
        return `+${pct}%`;
    }
}

export async function openEquipmentDetailsModal(equipmentName, currentLevel = 1) {
    const modal = document.getElementById('equipment-details-modal');
    if (!modal) return;

    const modalBody = modal.querySelector('.modal-body');
    const slug = equipmentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    let data = equipmentDataCache.get(slug);

    if (!data) {
        try {
            const response = await fetch(`js/data/equipment/${slug}.json`);
            if (response.ok) {
                data = await response.json();
                equipmentDataCache.set(slug, data);
            }
        } catch (e) {
            console.warn(`Could not load details for ${equipmentName}:`, e);
        }
    }

    if (data && !data.recommendation) {
        const allRecs = await getRecommendationsData();
        data.recommendation = allRecs[slug] || { status: 'unknown' };
    }

    const heroImg = document.getElementById('eq-details-hero-img');
    const itemImg = document.getElementById('eq-details-item-img');
    const titleEl = document.getElementById('eq-details-title');
    const descEl = document.getElementById('eq-details-desc');
    const typeBadge = document.getElementById('eq-details-type-badge');
    const rarityBadge = document.getElementById('eq-details-rarity-badge');

    // Dynamic lookup from heroData
    let heroKey = null;
    let heroInfo = null;
    let equipInfo = null;

    for (const hKey in heroData) {
        const equip = heroData[hKey].equipment.find(e => e.name.toLowerCase() === equipmentName.toLowerCase());
        if (equip) {
            heroKey = hKey;
            heroInfo = heroData[hKey];
            equipInfo = equip;
            break;
        }
    }

    const heroImageSrc = data?.heroImage || (heroInfo ? heroInfo.image : '');
    const equipImageSrc = data?.equipmentImage || (equipInfo ? equipInfo.image : '');
    const equipmentType = data?.type || (equipInfo ? equipInfo.type : 'Common');
    const equipmentRarity = data?.rarity || (equipInfo ? equipInfo.type : 'Common');

    const heroEquipFallbackText = safeTranslate('equipment.heroEquipment', 'Hero Equipment');

    if (!data) {
        // Render Empty / Unavailable State
        const fallbackTitle = safeTranslate(`equipment.${toCamelCase(equipmentName)}`, equipmentName);
        const dataNotAvailableTitle = safeTranslate('equipment.dataNotAvailable', 'Data Not Available');
        const dataNotAvailableDesc = safeTranslate(
            'equipment.detailsNotAvailableDesc',
            `Detailed level stats and upgrade breakdown for ${fallbackTitle} are not available yet.`
        ).replace('{name}', fallbackTitle);

        if (heroImg) heroImg.src = heroImageSrc;
        if (itemImg) itemImg.src = equipImageSrc;
        if (titleEl) titleEl.textContent = fallbackTitle;
        if (descEl) descEl.textContent = heroEquipFallbackText;

        if (typeBadge) {
            typeBadge.textContent = safeTranslate(`planner.${equipmentType.toLowerCase()}`, equipmentType);
            typeBadge.className = `eq-badge badge-${equipmentType.toLowerCase()}`;
        }
        if (rarityBadge) {
            const rText = safeTranslate(`planner.${equipmentRarity.toLowerCase()}`, equipmentRarity);
            rarityBadge.textContent = rText;
            rarityBadge.className = `eq-badge badge-${equipmentRarity.toLowerCase()}`;
        }

        if (modalBody) {
            modalBody.innerHTML = `
                <div class="eq-details-empty-state">
                    <div class="empty-state-icon">
                        <orecalc-assets-svg name="close"></orecalc-assets-svg>
                    </div>
                    <h3>${dataNotAvailableTitle}</h3>
                    <p>${dataNotAvailableDesc}</p>
                </div>
            `;
        }

        modal.classList.add('show');
        return;
    }

    // Normalize levels format (supports both Object Map {"1": {...}} and Array [{...}])
    const levelsArray = Array.isArray(data.levels)
        ? data.levels
        : Object.keys(data.levels).sort((a, b) => Number(a) - Number(b)).map(k => data.levels[k]);

    // Restore full modal structure if previously rendered empty state
    if (modalBody && !document.getElementById('eq-details-props-grid')) {
        const levelLabelText = safeTranslate('validation.level', 'Level');
        modalBody.innerHTML = `
            <div id="eq-details-props-grid" class="eq-details-props-grid"></div>
            <div class="eq-details-current-level-box">
                <div class="eq-details-level-header">
                    <span>${levelLabelText} <strong id="eq-details-current-lvl-text">1</strong></span>
                    <span id="eq-details-max-lvl-text" class="text-secondary"></span>
                </div>
                <div id="eq-details-stats-progress-list" class="eq-details-stats-progress-list"></div>
            </div>
            <div class="eq-details-table-container">
                <table class="eq-details-table">
                    <thead id="eq-details-table-head"></thead>
                    <tbody id="eq-details-table-body"></tbody>
                </table>
            </div>
        `;
    }

    // Populate Header with Automatic i18n Translation & Dynamic Hero Data
    const translatedTitle = safeTranslate(`equipment.${toCamelCase(data.id || equipmentName)}`, equipmentName);
    const translatedRarity = safeTranslate(`equipment.${data.rarity}`, safeTranslate(`planner.${data.rarity}`, data.rarity));
    const translatedType = safeTranslate(`equipment.${data.type}`, safeTranslate(`planner.${data.type}`, data.type));

    if (heroImg) heroImg.src = heroImageSrc;
    if (itemImg) itemImg.src = equipImageSrc;
    if (titleEl) titleEl.textContent = translatedTitle;
    if (descEl) descEl.textContent = heroEquipFallbackText;

    if (typeBadge) {
        typeBadge.textContent = translatedType;
        typeBadge.className = `eq-badge badge-${data.type.toLowerCase()}`;
    }
    if (rarityBadge) {
        rarityBadge.textContent = translatedRarity;
        rarityBadge.className = `eq-badge badge-${data.rarity.toLowerCase()}`;
    }

    // Get User TownHall from state for recommendation target resolution
    const recBadge = document.getElementById('eq-details-rec-badge');
    const recBannerContainer = document.getElementById('eq-details-rec-banner-container');
    const rec = data.recommendation;
    const activePlayer = state.players?.find(p => p.tag === state.activePlayerTag) || state.players?.[0];
    const userTH = activePlayer?.townHall || 16;
    const targetRecLevel = getRecommendedLevelForTownHall(rec, userTH);
    const calculatedMaxLevel = getEquipmentMaxLevel(data.rarity || equipmentRarity);
    const isEquipmentMaxed = currentLevel >= calculatedMaxLevel;

    if (recBadge) {
        if (!isEquipmentMaxed && rec && rec.status === 'not_recommended') {
            recBadge.style.display = 'inline-flex';
            recBadge.textContent = safeTranslate('equipment.notRecommended', 'Not Recommended');
            recBadge.className = 'eq-badge badge-not-recommended';
        } else if (!isEquipmentMaxed && rec && rec.status === 'recommended') {
            recBadge.style.display = 'inline-flex';
            const recText = targetRecLevel ? `${safeTranslate('equipment.recommended', 'Recommended')}: ${targetRecLevel}` : safeTranslate('equipment.recommended', 'Recommended');
            recBadge.innerHTML = `<orecalc-assets-svg name="target" class="badge-icon"></orecalc-assets-svg> <span>${recText}</span>`;
            recBadge.className = 'eq-badge badge-recommended';
        } else {
            recBadge.style.display = 'none';
        }
    }

    const unhideNoteBtn = document.getElementById('unhide-eq-note-btn');
    const equipId = data.id || equipmentId;

    let noteText = null;
    let isNotRec = false;
    if (!isEquipmentMaxed && rec) {
        if (rec.status === 'not_recommended') {
            isNotRec = true;
            noteText = rec.reasonKey 
                ? safeTranslate(rec.reasonKey) 
                : safeTranslate('equipment.defaultNotRecommendedDesc', 'This equipment is currently not recommended for upgrading, as other hero equipment are significantly better.');
        } else if (rec.reasonKey) {
            noteText = safeTranslate(rec.reasonKey);
        }
    }

    const renderBannerState = () => {
        if (!noteText) {
            if (recBannerContainer) recBannerContainer.innerHTML = '';
            if (unhideNoteBtn) unhideNoteBtn.style.display = 'none';
            return;
        }

        if (dismissedNotes.has(equipId)) {
            if (recBannerContainer) recBannerContainer.innerHTML = '';
            if (unhideNoteBtn) {
                unhideNoteBtn.style.display = 'inline-flex';
                unhideNoteBtn.onclick = () => {
                    dismissedNotes.delete(equipId);
                    renderBannerState();
                };
            }
        } else {
            if (unhideNoteBtn) unhideNoteBtn.style.display = 'none';
            if (recBannerContainer) {
                const bannerClass = isNotRec ? 'eq-details-not-rec-banner banner-not-recommended' : 'eq-details-rec-banner banner-recommended';
                const hideLabel = safeTranslate('actions.hide', 'Hide');
                recBannerContainer.innerHTML = `
                    <div class="${bannerClass}">
                        <orecalc-assets-svg name="suggestion" class="banner-icon"></orecalc-assets-svg>
                        <span class="banner-text">${noteText}</span>
                        <button type="button" class="hide-suggestion-btn dismiss-banner-btn">${hideLabel}</button>
                    </div>
                `;
                const dismissBtn = recBannerContainer.querySelector('.dismiss-banner-btn');
                if (dismissBtn) {
                    dismissBtn.onclick = () => {
                        dismissedNotes.add(equipId);
                        renderBannerState();
                    };
                }
            }
        }
    };

    renderBannerState();

    // Populate Properties Grid (hide if empty)
    const propsGrid = document.getElementById('eq-details-props-grid');
    if (propsGrid) {
        if (data.properties && data.properties.length > 0) {
            propsGrid.style.display = 'grid';
            propsGrid.innerHTML = data.properties.map(p => `
                <div class="prop-item">
                    <span class="prop-label">${p.labelKey ? safeTranslate(p.labelKey, p.label) : p.label}</span>
                    <span class="prop-value">${p.valueKey ? safeTranslate(p.valueKey, p.value) : p.value}</span>
                </div>
            `).join('');
        } else {
            propsGrid.style.display = 'none';
        }
    }

    // Populate Current Level Text & Dynamic Max Level
    const currentLvlText = document.getElementById('eq-details-current-lvl-text');
    const maxLvlText = document.getElementById('eq-details-max-lvl-text');
    const levelLabel = safeTranslate('validation.level', 'Level');
    const maxLevelLabel = safeTranslate('equipment.maxLevel', 'Max Level');

    if (currentLvlText) currentLvlText.textContent = currentLevel;
    if (maxLvlText) maxLvlText.textContent = `${maxLevelLabel} ${calculatedMaxLevel}`;

    // Render Static Stats Content if present
    const staticStatsContent = document.getElementById('eq-details-static-stats-content');
    if (staticStatsContent) {
        if (data.staticStats && data.staticStats.length > 0) {
            const staticTitleText = safeTranslate('equipment.generalStats', 'General Stats');
            const formatVal = (v, vUnit) => {
                if (v === undefined || v === null) return '-';
                if (vUnit === 'percentage' || vUnit === 'percent') return `${v}%`;
                if (vUnit === 'seconds') {
                    const sSuffix = safeTranslate('time.secondsSuffix', 's');
                    return `${v}${sSuffix}`;
                }
                if (vUnit === 'tiles') {
                    const tilesSuffix = safeTranslate('equipment.tilesSuffix', 'tiles');
                    return `${v} ${tilesSuffix}`;
                }
                if (typeof v === 'number') return v.toLocaleString();
                return String(v);
            };

            const rowsHTML = data.staticStats.map(stat => {
                const label = safeTranslate(`equipment.stats.${stat.key}`, safeTranslate(`equipment.${stat.key}`, stat.key));
                const formattedVal = formatVal(stat.value, stat.valueUnit);
                return `
                    <div class="stat-progress-row">
                        <div class="stat-label-line">
                            <span class="stat-name">${label}</span>
                            <span class="stat-val">${formattedVal}</span>
                        </div>
                    </div>
                `;
            }).join('');

            staticStatsContent.innerHTML = `
                <div class="eq-details-stats-progress-list" style="margin-top: 12px;">
                    ${rowsHTML}
                </div>
            `;
            staticStatsContent.style.display = 'block';
        } else {
            staticStatsContent.innerHTML = '';
            staticStatsContent.style.display = 'none';
        }
    }

    // Render Stats Progress List
    const statsProgressList = document.getElementById('eq-details-stats-progress-list');
    if (statsProgressList && data.statsMeta && levelsArray.length > 0) {
        const activeLevelObj = levelsArray[currentLevel - 1] || levelsArray[0];
        const maxLevelObj = levelsArray[calculatedMaxLevel - 1] || levelsArray[levelsArray.length - 1];

        statsProgressList.innerHTML = data.statsMeta.map((meta, idx) => {
            const getStatValue = (obj) => {
                if (!obj) return 0;
                if (Array.isArray(obj)) return obj[idx];
                const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                return typeof raw === 'object' ? raw.value : raw;
            };

            const numVal = getStatValue(activeLevelObj);
            const maxVal = getStatValue(maxLevelObj) || numVal || 1;

            const pct = Math.min(100, Math.round((numVal / maxVal) * 100));
            const statLabel = safeTranslate(`equipment.stats.${meta.key}`, safeTranslate(`equipment.${meta.key}`, meta.key));
            const formatVal = (v, vUnit) => {
                if (v === undefined || v === null) return '-';
                if (vUnit === 'percentage' || vUnit === 'percent') return `${v}%`;
                if (vUnit === 'seconds') return `${v}s`;
                if (vUnit === 'tiles') return `${v} tiles`;
                return Number(v).toLocaleString();
            };
            const formattedVal = formatVal(numVal, meta.valueUnit);
            return `
                <div class="stat-progress-row">
                    <div class="stat-label-line">
                        <span class="stat-name">${statLabel}</span>
                        <span class="stat-val">${formattedVal}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Populate Level Table
    const tableHead = document.getElementById('eq-details-table-head');
    const tableBody = document.getElementById('eq-details-table-body');
    const isEpic = data.rarity.toLowerCase() === 'epic';

    if (tableHead && tableBody) {
        const shinyText = safeTranslate('ores.shiny', 'Shiny Ore');
        const glowyText = safeTranslate('ores.glowy', 'Glowy Ore');
        const starryText = safeTranslate('ores.starry', 'Starry Ore');
        const reqTHText = safeTranslate('equipment.requiredTownHall', 'Required Town Hall');

        // Calculate category spans for statsMeta
        const categoryGroups = [];
        (data.statsMeta || []).forEach(meta => {
            const catKey = meta.category || 'ability';
            const lastGroup = categoryGroups[categoryGroups.length - 1];
            if (lastGroup && lastGroup.category === catKey) {
                lastGroup.count += 1;
            } else {
                categoryGroups.push({ category: catKey, count: 1 });
            }
        });

        const categorySuperHeadersHTML = categoryGroups.map(group => {
            const title = safeTranslate(`equipment.${group.category}`, group.category);
            return `<th colspan="${group.count}" class="category-header category-${group.category}">${title}</th>`;
        }).join('');

        const oreCostCount = isEpic ? 3 : 2;
        const costTitle = safeTranslate('equipment.cost', 'Cost');
        const costSuperHeaderHTML = `<th colspan="${oreCostCount}" class="category-header category-cost">${costTitle}</th>`;

        const subHeadersStatHTML = data.statsMeta.map(meta => `<th><span class="stat-name">${safeTranslate(`equipment.stats.${meta.key}`, safeTranslate(`equipment.${meta.key}`, meta.key))}</span></th>`).join('');
        const subHeadersOreHTML = `
            <th>${shinyText}</th>
            <th>${glowyText}</th>
            ${isEpic ? `<th>${starryText}</th>` : ''}
        `;

        tableHead.innerHTML = `
            <tr class="super-header-row">
                <th rowspan="2">${levelLabel}</th>
                ${categorySuperHeadersHTML}
                ${costSuperHeaderHTML}
                <th rowspan="2">${reqTHText}</th>
            </tr>
            <tr class="sub-header-row">
                ${subHeadersStatHTML}
                ${subHeadersOreHTML}
            </tr>
        `;

        tableBody.innerHTML = levelsArray.map((lvlObj, index) => {
            const levelNumber = index + 1;
            const isPast = levelNumber < currentLevel;
            const isActive = levelNumber === currentLevel;
            const cost = getEquipmentUpgradeCost(levelNumber);
            const reqTH = getRequiredTownHall(levelNumber, data.rarity, heroKey);
            const prevLvlObj = index > 0 ? levelsArray[index - 1] : null;

            const isMaxLevel = levelNumber === calculatedMaxLevel;
            const isFuture = levelNumber > currentLevel;
            const isStepLevel = levelNumber % 3 === 0;

            const isStarryStep = isEpic && cost.starry > 0;
            const isGlowyStep = cost.glowy > 0 && !isStarryStep;

            let rowClass = '';
            if (isActive && isMaxLevel) {
                // Whole row gold highlight ONLY if equipment is currently maxed!
                rowClass = 'active-max-level-row';
            } else if (isActive) {
                // Active level row highlight
                rowClass = 'active-level-row';
            } else if (isPast) {
                // Past levels (dimmed/muted)
                rowClass = 'past-level-row';
            } else if (isMaxLevel) {
                // Max level when equipment is not maxed: highlight level number in gold
                rowClass = 'max-level-step-row';
            } else if (isFuture && isStepLevel) {
                // Step level (every 3 levels) past current level: highlight level number in accent color
                rowClass = 'step-level-row';
            }

            const rowClassAttr = rowClass ? `class="${rowClass}"` : '';

            const statCellsHTML = data.statsMeta.map((meta, metaIdx) => {
                const getStatVal = (obj) => {
                    if (!obj) return undefined;
                    if (Array.isArray(obj)) return obj[metaIdx];
                    const raw = obj.stats ? obj.stats[meta.key] : obj[meta.key];
                    return typeof raw === 'object' ? raw.value : raw;
                };

                const val = getStatVal(lvlObj);
                const prevVal = getStatVal(prevLvlObj);

                const deltaText = computeStatDelta(val, prevVal, meta.deltaType, meta.valueUnit || 'number', meta.category || 'ability');
                const isMainStat = meta.category === 'ability';
                const deltaClass = isMainStat ? 'delta-tag delta-tag-main' : 'delta-tag';
                const deltaHTML = deltaText ? `<span class="${deltaClass}">(${deltaText})</span>` : '';
                function formatStatValue(val, vUnit) {
                    if (val === undefined || val === null) return '-';
                    if (vUnit === 'percentage' || vUnit === 'percent') return `${val}%`;
                    if (vUnit === 'seconds') return `${val}s`;
                    if (vUnit === 'tiles') return `${val} tiles`;
                    return Number(val).toLocaleString();
                }

                const displayVal = formatStatValue(val, meta.valueUnit);

                return `<td>${displayVal} ${deltaHTML}</td>`;
            }).join('');

            const shinyDisplay = cost.shiny > 0
                ? `<span class="shiny-cost-highlight">${cost.shiny.toLocaleString()}</span>`
                : '-';

            const glowyDisplay = cost.glowy > 0 
                ? `<span class="glowy-cost-highlight">${cost.glowy.toLocaleString()}</span>` 
                : '-';

            const starryDisplay = cost.starry > 0
                ? `<span class="starry-cost-highlight">${cost.starry.toLocaleString()}</span>` 
                : '-';

            const starryCellHTML = isEpic ? `<td><div class="ore-cost-cell">${starryDisplay}</div></td>` : '';

            const isRecTarget = !isEquipmentMaxed && targetRecLevel && levelNumber === targetRecLevel;
            const recTargetIcon = isRecTarget ? `<orecalc-assets-svg name="target" class="rec-target-icon" title="TH ${userTH} Target"></orecalc-assets-svg>` : '';

            return `
                <tr ${rowClassAttr}>
                    <td><div class="level-cell-content">${recTargetIcon}<span>${levelNumber}</span></div></td>
                    ${statCellsHTML}
                    <td><div class="ore-cost-cell">${shinyDisplay}</div></td>
                    <td><div class="ore-cost-cell">${glowyDisplay}</div></td>
                    ${starryCellHTML}
                    <td>
                        <div class="th-req-cell">
                            <orecalc-assets-image src="assets/th/th${reqTH}.png" alt="TH ${reqTH}" class="th-cell-img"></orecalc-assets-image>
                            <span>TH ${reqTH}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    modal.classList.add('show');

    // Always scroll the current level row to the top of the table
    setTimeout(() => {
        const activeRow = modal.querySelector('.active-level-row');
        const tableContainer = modal.querySelector('.eq-details-table-container');
        if (activeRow && tableContainer) {
            tableContainer.scrollTop = activeRow.offsetTop;
        }
    }, 50);
}

export function initializeEquipmentDetailsModal() {
    const modal = document.getElementById('equipment-details-modal');
    const closeBtn = document.getElementById('close-eq-details-modal-btn');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
}
