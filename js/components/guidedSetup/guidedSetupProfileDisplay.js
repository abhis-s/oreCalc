import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { formatDisplayTag } from '../../core/storageKeys.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { formatClanRole } from '../common/profileHeaderRenderer.js';

import { calculateEquipmentProgress } from './guidedSetupEquipmentProgress.js';
import { renderHeroEquipmentList } from './guidedSetupHeroEquipmentRenderer.js';

/**
 * Renders the master profile preview card (info and equipment tabs) for Guided Setup.
 * @param {Object} playerData - Player profile and equipment data.
 */
export function renderProfilePreviewCard(playerData) {
    const container = document.getElementById('guided-setup-profile-preview-container');
    if (!container || !playerData) return;

    const ownedEquip = playerData.ownedEquipment || Object.fromEntries(
        (playerData.heroEquipment?.filter(e => e && (e.village === 'home' || !e.village)) || []).map(e => [e.name, e.level])
    );
    const ownedHeroes = playerData.ownedHeroes || Object.fromEntries(
        (playerData.heroes?.filter(h => h && (h.village === 'home' || !h.village)) || []).map(h => [h.name, {
            level: h.level,
            maxLevel: h.maxLevel,
            equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
        }])
    );
    const effectiveProfile = {
        ...playerData,
        ownedEquipment: ownedEquip,
        ownedHeroes
    };

    const nameEl = document.getElementById('guided-setup-profile-name');
    const tagEl = document.getElementById('guided-setup-profile-tag');
    const thLevelEl = document.getElementById('guided-setup-profile-th-level');

    if (nameEl) nameEl.textContent = playerData.name || 'Player';
    if (tagEl) tagEl.textContent = formatDisplayTag(playerData.tag) || (playerData.tag ? `#${playerData.tag.replace(/^#+/, '')}` : '');
    if (thLevelEl) thLevelEl.textContent = String(playerData.townHallLevel || '1');

    const thImage = document.getElementById('guided-setup-profile-th-image');
    if (thImage) {
        const thLevel = playerData.townHallLevel || 1;
        thImage.setAttribute('src', `assets/th/th${thLevel}.png`);
        thImage.setAttribute('alt', `Town Hall ${thLevel}`);
    }

    const clanSection = document.getElementById('guided-setup-profile-clan-section');
    const clanBadge = document.getElementById('guided-setup-profile-clan-badge');
    const clanName = document.getElementById('guided-setup-profile-clan-name');
    const clanRole = document.getElementById('guided-setup-profile-clan-role');

    if (playerData.clan && playerData.clan.name) {
        if (clanName) {
            clanName.textContent = playerData.clan.name;
            clanName.removeAttribute('data-i18n');
        }
        if (clanBadge) {
            if (playerData.clan.badgeUrls && playerData.clan.badgeUrls.small) {
                clanBadge.setAttribute('src', playerData.clan.badgeUrls.small);
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
            const noClanText = translate('views.guidedSetup.noClan') || 'No Clan';
            clanName.textContent = noClanText;
            clanName.setAttribute('data-i18n', 'views.guidedSetup.noClan');
        }
        if (clanBadge) clanBadge.style.display = 'none';
        if (clanRole) clanRole.style.display = 'none';
    }

    const leagueIcon = document.getElementById('guided-setup-profile-league-icon');
    const leagueDefaultIcon = document.getElementById('guided-setup-profile-league-default-icon');
    const leagueNameEl = document.getElementById('guided-setup-profile-league-name');

    const leagueId = Number(playerData.leagueTier?.id) || UNRANKED_LEAGUE_ID;
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);
    const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];

    const activeLeague = leagueData || unrankedLeague;
    if (activeLeague) {
        if (leagueNameEl) {
            const leagueKey = 'entities.leagues.' + activeLeague.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (_match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');

            leagueNameEl.textContent = translate(leagueKey);
            leagueNameEl.dataset.i18n = leagueKey;
            leagueNameEl.title = translate(leagueKey);
        }

        const leagueImgUrl = activeLeague.iconUrls?.small || unrankedLeague?.iconUrls?.small || '';
        if (leagueImgUrl) {
            if (leagueIcon) {
                leagueIcon.setAttribute('src', leagueImgUrl);
                leagueIcon.style.display = 'block';
            }
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'none';
        } else {
            if (leagueIcon) leagueIcon.style.display = 'none';
            if (leagueDefaultIcon) leagueDefaultIcon.style.display = 'block';
        }
    }

    const trophiesEl = document.getElementById('guided-setup-profile-trophies');
    if (trophiesEl) trophiesEl.textContent = formatNumber(playerData.trophies || 0);

    const maxedEquipEl = document.getElementById('guided-setup-profile-maxed-equip');
    if (maxedEquipEl) {
        let totalCount = 0;
        let maxedCount = 0;
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

    const progress = calculateEquipmentProgress(effectiveProfile);

    const commonAvgEl = document.getElementById('guided-setup-profile-common-avg');
    const commonShinyPctEl = document.getElementById('guided-setup-profile-common-shiny-pct');
    const commonShinyFillEl = document.getElementById('guided-setup-profile-common-shiny-fill');
    const commonGlowyPctEl = document.getElementById('guided-setup-profile-common-glowy-pct');
    const commonGlowyFillEl = document.getElementById('guided-setup-profile-common-glowy-fill');

    if (commonAvgEl) commonAvgEl.textContent = `${progress.common.avg}%`;
    if (commonShinyPctEl) commonShinyPctEl.textContent = `${progress.common.shiny}%`;
    if (commonShinyFillEl) commonShinyFillEl.style.width = `${progress.common.shiny}%`;
    if (commonGlowyPctEl) commonGlowyPctEl.textContent = `${progress.common.glowy}%`;
    if (commonGlowyFillEl) commonGlowyFillEl.style.width = `${progress.common.glowy}%`;

    const epicAvgEl = document.getElementById('guided-setup-profile-epic-avg');
    const epicShinyPctEl = document.getElementById('guided-setup-profile-epic-shiny-pct');
    const epicShinyFillEl = document.getElementById('guided-setup-profile-epic-shiny-fill');
    const epicGlowyPctEl = document.getElementById('guided-setup-profile-epic-glowy-pct');
    const epicGlowyFillEl = document.getElementById('guided-setup-profile-epic-glowy-fill');
    const epicStarryPctEl = document.getElementById('guided-setup-profile-epic-starry-pct');
    const epicStarryFillEl = document.getElementById('guided-setup-profile-epic-starry-fill');

    if (epicAvgEl) epicAvgEl.textContent = `${progress.epic.avg}%`;
    if (epicShinyPctEl) epicShinyPctEl.textContent = `${progress.epic.shiny}%`;
    if (epicShinyFillEl) epicShinyFillEl.style.width = `${progress.epic.shiny}%`;
    if (epicGlowyPctEl) epicGlowyPctEl.textContent = `${progress.epic.glowy}%`;
    if (epicGlowyFillEl) epicGlowyFillEl.style.width = `${progress.epic.glowy}%`;
    if (epicStarryPctEl) epicStarryPctEl.textContent = `${progress.epic.starry}%`;
    if (epicStarryFillEl) epicStarryFillEl.style.width = `${progress.epic.starry}%`;

    const equipmentListContainer = document.getElementById('guided-setup-profile-heroes-equipment-list');
    if (equipmentListContainer) {
        renderHeroEquipmentList(effectiveProfile, equipmentListContainer);
    }

    container.style.display = 'block';

    const infoTabBtn = document.getElementById('guided-setup-tab-btn-info');
    if (infoTabBtn && typeof infoTabBtn.click === 'function') infoTabBtn.click();
}
