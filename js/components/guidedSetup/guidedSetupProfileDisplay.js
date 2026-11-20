import { calculateMaxedEquipmentCount } from '../../domain/equipment/equipmentProgressDomain.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { MAX_TOWN_HALL, UNRANKED_LEAGUE_ID } from '../../core/constants.js';
import { formatDisplayTag } from '../../core/storageKeys.js';
import { getTownHallIconUrl } from '../../domain/townHall/townHallSchedule.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { formatClanRole } from '../common/profileHeaderDisplay.js';

import { calculateEquipmentProgress } from './guidedSetupEquipmentProgress.js';
import { renderHeroEquipmentList } from './guidedSetupHeroEquipmentDisplay.js';

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
        const thLevel = playerData.townHallLevel || MAX_TOWN_HALL;
        thImage.setAttribute('src', getTownHallIconUrl(thLevel));
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
            const clanBadgeUrl = playerData.clan.badgeUrls?.small;
            if (clanBadgeUrl) {
                clanBadge.setAttribute('src', clanBadgeUrl);
            }
            clanBadge.hidden = !clanBadgeUrl;
            clanBadge.style.display = '';
        }
        if (clanRole) {
            if (playerData.role) {
                clanRole.textContent = `(${formatClanRole(playerData.role)})`;
            }
            clanRole.hidden = !playerData.role;
            clanRole.style.display = '';
        }
        if (clanSection) clanSection.style.display = 'flex';
    } else {
        if (clanName) {
            const noClanText = translate('views.guidedSetup.noClan') || 'No Clan';
            clanName.textContent = noClanText;
            clanName.setAttribute('data-i18n', 'views.guidedSetup.noClan');
        }
        if (clanBadge) {
            clanBadge.hidden = true;
            clanBadge.style.display = '';
        }
        if (clanRole) {
            clanRole.hidden = true;
            clanRole.style.display = '';
        }
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
                leagueIcon.hidden = false;
                leagueIcon.style.display = '';
            }
            if (leagueDefaultIcon) {
                leagueDefaultIcon.hidden = true;
                leagueDefaultIcon.style.display = '';
            }
        } else {
            if (leagueIcon) {
                leagueIcon.hidden = true;
                leagueIcon.style.display = '';
            }
            if (leagueDefaultIcon) {
                leagueDefaultIcon.hidden = false;
                leagueDefaultIcon.style.display = '';
            }
        }
    }

    const trophiesEl = document.getElementById('guided-setup-profile-trophies');
    if (trophiesEl) trophiesEl.textContent = formatNumber(playerData.trophies || 0);

    const maxedEquipEl = document.getElementById('guided-setup-profile-maxed-equip');
    if (maxedEquipEl) {
        const { maxedCount, totalCount } = calculateMaxedEquipmentCount(ownedEquip);
        maxedEquipEl.textContent = `${maxedCount}/${totalCount}`;
    }

    const progress = calculateEquipmentProgress(effectiveProfile);

    const rarityTiers = [
        { key: 'common', hasStarry: false, groupId: null },
        { key: 'epic', hasStarry: true, groupId: null },
        { key: 'legendary', hasStarry: true, groupId: 'guided-setup-profile-legendary-group' }
    ];

    for (const tier of rarityTiers) {
        const stats = progress[tier.key] || { avg: 0, shiny: 0, glowy: 0, starry: 0, total: { shiny: 0 } };
        const isDisabled = tier.key === 'legendary' && (stats.total?.shiny || 0) === 0;
        const groupEl = tier.groupId ? document.getElementById(tier.groupId) : null;
        if (groupEl) {
            groupEl.classList.toggle('is-disabled', isDisabled);
        }

        const ores = tier.hasStarry ? ['shiny', 'glowy', 'starry'] : ['shiny', 'glowy'];
        const avgEl = document.getElementById(`guided-setup-profile-${tier.key}-avg`);
        if (avgEl) avgEl.textContent = isDisabled ? '-' : `${stats.avg}%`;

        for (const ore of ores) {
            const pctEl = document.getElementById(`guided-setup-profile-${tier.key}-${ore}-pct`);
            const fillEl = document.getElementById(`guided-setup-profile-${tier.key}-${ore}-fill`);
            const pct = stats[ore] || 0;
            if (pctEl) pctEl.textContent = isDisabled ? '-' : `${pct}%`;
            if (fillEl) fillEl.style.width = isDisabled ? '0%' : `${pct}%`;
        }
    }

    const equipmentListContainer = document.getElementById('guided-setup-profile-heroes-equipment-list');
    if (equipmentListContainer) {
        renderHeroEquipmentList(effectiveProfile, equipmentListContainer);
    }

    container.hidden = false;
    container.style.display = '';

    const infoTabBtn = document.getElementById('guided-setup-tab-btn-info');
    if (infoTabBtn && typeof infoTabBtn.click === 'function') infoTabBtn.click();
}
