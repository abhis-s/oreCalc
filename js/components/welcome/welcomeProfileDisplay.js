import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';

import { formatNumber } from '../../utils/numberFormatter.js';

import {
    calculateEquipmentProgress,
    formatClanRole
} from './welcomeEquipmentProgress.js';
import {
    renderHeroEquipmentList
} from './welcomeHeroEquipmentRenderer.js';
import { welcomeState } from './welcomeModalState.js';

const safeRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);

/**
 * Updates the arrow pointer position pointing to the active profile card in the carousel.
 */
export function updatePreviewArrowPosition() {
    const previewContainer = document.getElementById('welcome-profile-preview-container');
    if (!previewContainer || previewContainer.style.display === 'none') return;

    let activeCard = null;
    if (welcomeState.currentPage === 2) {
        activeCard = document.querySelector('#welcome-profiles-list .welcome-profile-card-compact.active');
    } else if (welcomeState.currentPage === 3) {
        activeCard = document.querySelector('#welcome-qs-profiles-list .welcome-profile-card-compact.active');
    }

    if (!activeCard) return;

    const listContainer = activeCard.parentElement;
    if (!listContainer) return;

    const cardRect = activeCard.getBoundingClientRect();
    const previewRect = previewContainer.getBoundingClientRect();

    if (previewRect.width <= 0) return;

    const cardCenterX = cardRect.left + (cardRect.width / 2);
    const arrowX = cardCenterX - previewRect.left;
    const clampedArrowX = Math.max(24, Math.min(previewRect.width - 24, arrowX));

    previewContainer.style.setProperty('--arrow-left', `${clampedArrowX}px`);
}

/**
 * Renders the master profile preview card (info and equipment tabs) on the welcome wizard.
 * @param {Object} playerData
 */
export function renderProfilePreviewCard(playerData) {
    const container = document.getElementById('welcome-profile-preview-container');
    if (!container) return;

    const deleteBtn = document.getElementById('welcome-profile-delete-btn');
    if (deleteBtn) {
        if (!playerData.tag || playerData.tag === 'DEFAULT0') {
            deleteBtn.style.display = 'none';
        } else {
            deleteBtn.style.display = 'flex';
        }
    }

    const nameEl = document.getElementById('welcome-profile-name');
    const tagEl = document.getElementById('welcome-profile-tag');
    const thLevelEl = document.getElementById('welcome-profile-th-level');

    if (nameEl) nameEl.textContent = playerData.name || 'Player';
    if (tagEl) tagEl.textContent = playerData.tag || '';
    if (thLevelEl) thLevelEl.textContent = playerData.townHallLevel || '1';

    const thImage = document.getElementById('welcome-profile-th-image');
    if (thImage) {
        const thLevel = playerData.townHallLevel || 1;
        thImage.src = `assets/th/th${thLevel}.png`;
    }

    const clanSection = document.getElementById('welcome-profile-clan-section');
    const clanBadge = document.getElementById('welcome-profile-clan-badge');
    const clanName = document.getElementById('welcome-profile-clan-name');
    const clanRole = document.getElementById('welcome-profile-clan-role');

    if (playerData.clan && playerData.clan.name) {
        if (clanName) {
            clanName.textContent = playerData.clan.name;
            clanName.removeAttribute('data-i18n');
        }
        if (clanBadge) {
            if (playerData.clan.badgeUrls && playerData.clan.badgeUrls.small) {
                clanBadge.src = playerData.clan.badgeUrls.small;
                clanBadge.style.display = 'block';
            } else {
                clanBadge.style.display = 'none';
            }
        }
        if (clanRole && playerData.role) {
            clanRole.textContent = `(${formatClanRole(playerData.role)})`;
            clanRole.style.display = 'inline-block';
        } else if (clanRole) {
            clanRole.style.display = 'none';
        }
        if (clanSection) clanSection.style.display = 'flex';
    } else {
        if (clanName) {
            clanName.textContent = translate('views.welcome.noClan');
            clanName.setAttribute('data-i18n', 'views.welcome.noClan');
        }
        if (clanBadge) clanBadge.style.display = 'none';
        if (clanRole) clanRole.style.display = 'none';
    }

    const leagueIcon = document.getElementById('welcome-profile-league-icon');
    const leagueDefaultIcon = document.getElementById('welcome-profile-league-default-icon');
    const leagueNameEl = document.getElementById('welcome-profile-league-name');

    const leagueId = parseInt(playerData.leagueTier?.id || 105000000, 10);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);

    if (leagueData) {
        if (leagueNameEl) {
            const leagueKey = 'entities.leagues.' + leagueData.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');

            leagueNameEl.textContent = translate(leagueKey);
            leagueNameEl.dataset.i18n = leagueKey;
            leagueNameEl.title = translate(leagueKey);
        }

        const leagueImgUrl = leagueData.iconUrls?.small || '';
        if (leagueImgUrl) {
            if (leagueIcon) {
                leagueIcon.src = leagueImgUrl;
                leagueIcon.style.display = 'block';
            }
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'none';
        } else {
            if (leagueIcon) leagueIcon.style.display = 'none';
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'block';
        }
    } else {
        if (leagueNameEl) {
            leagueNameEl.textContent = translate('entities.leagues.unranked');
            leagueNameEl.dataset.i18n = 'entities.leagues.unranked';
        }
        if (leagueIcon) leagueIcon.style.display = 'none';
        if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'block';
    }

    const trophiesEl = document.getElementById('welcome-profile-trophies');
    const warStarsEl = document.getElementById('welcome-profile-war-stars');
    const warPrefEl = document.getElementById('welcome-profile-war-pref');
    const donationsEl = document.getElementById('welcome-profile-donations');

    if (trophiesEl) trophiesEl.textContent = formatNumber(playerData.trophies || 0);
    if (warStarsEl) warStarsEl.textContent = formatNumber(playerData.warStars || 0);

    if (warPrefEl) {
        if (playerData.warPreference === 'in') {
            warPrefEl.textContent = 'In War';
        } else if (playerData.warPreference === 'out') {
            warPrefEl.textContent = 'Out of War';
        } else {
            warPrefEl.textContent = '-';
        }
        warPrefEl.removeAttribute('data-i18n');
    }

    if (donationsEl) {
        const sent = playerData.donations || 0;
        const received = playerData.donationsReceived || 0;
        donationsEl.textContent = `${formatNumber(sent)} / ${formatNumber(received)}`;
    }

    const maxedEquipEl = document.getElementById('welcome-profile-maxed-equip');
    if (maxedEquipEl) {
        let totalCount = 0;
        let maxedCount = 0;
        const ownedEquip = playerData.ownedEquipment || {};
        for (const heroKey in heroData) {
            for (const equip of heroData[heroKey].equipment) {
                totalCount++;
                const maxLevel = getEquipmentMaxLevel(equip.type);
                const currentLevel = ownedEquip[equip.name];
                if (currentLevel !== undefined && currentLevel >= maxLevel) {
                    maxedCount++;
                }
            }
        }
        maxedEquipEl.textContent = `${maxedCount}/${totalCount}`;
    }

    const progress = calculateEquipmentProgress(playerData);

    const commonAvgEl = document.getElementById('welcome-profile-common-avg');
    const commonShinyPctEl = document.getElementById('welcome-profile-common-shiny-pct');
    const commonShinyFillEl = document.getElementById('welcome-profile-common-shiny-fill');
    const commonGlowyPctEl = document.getElementById('welcome-profile-common-glowy-pct');
    const commonGlowyFillEl = document.getElementById('welcome-profile-common-glowy-fill');

    if (commonAvgEl) commonAvgEl.textContent = `${progress.common.avg}%`;
    if (commonShinyPctEl) commonShinyPctEl.textContent = `${progress.common.shiny}%`;
    if (commonShinyFillEl) commonShinyFillEl.style.width = `${progress.common.shiny}%`;
    if (commonGlowyPctEl) commonGlowyPctEl.textContent = `${progress.common.glowy}%`;
    if (commonGlowyFillEl) commonGlowyFillEl.style.width = `${progress.common.glowy}%`;

    const epicAvgEl = document.getElementById('welcome-profile-epic-avg');
    const epicShinyPctEl = document.getElementById('welcome-profile-epic-shiny-pct');
    const epicShinyFillEl = document.getElementById('welcome-profile-epic-shiny-fill');
    const epicGlowyPctEl = document.getElementById('welcome-profile-epic-glowy-pct');
    const epicGlowyFillEl = document.getElementById('welcome-profile-epic-glowy-fill');
    const epicStarryPctEl = document.getElementById('welcome-profile-epic-starry-pct');
    const epicStarryFillEl = document.getElementById('welcome-profile-epic-starry-fill');

    if (epicAvgEl) epicAvgEl.textContent = `${progress.epic.avg}%`;
    if (epicShinyPctEl) epicShinyPctEl.textContent = `${progress.epic.shiny}%`;
    if (epicShinyFillEl) epicShinyFillEl.style.width = `${progress.epic.shiny}%`;
    if (epicGlowyPctEl) epicGlowyPctEl.textContent = `${progress.epic.glowy}%`;
    if (epicGlowyFillEl) epicGlowyFillEl.style.width = `${progress.epic.glowy}%`;
    if (epicStarryPctEl) epicStarryPctEl.textContent = `${progress.epic.starry}%`;
    if (epicStarryFillEl) epicStarryFillEl.style.width = `${progress.epic.starry}%`;

    const equipmentListContainer = document.getElementById('welcome-profile-heroes-equipment-list');
    if (equipmentListContainer) {
        renderHeroEquipmentList(playerData, equipmentListContainer);
    }

    container.style.display = 'block';

    const infoTabBtn = document.getElementById('welcome-tab-btn-info');
    if (infoTabBtn) infoTabBtn.click();

    safeRaf(() => {
        updatePreviewArrowPosition();
    });
}
