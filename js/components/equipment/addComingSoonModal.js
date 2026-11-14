/**
 * Modal Controller for Adding Custom "Coming Soon" Equipment.
 * Tier 4: UI Controller (Modal event listeners and state transactions).
 */

import { heroData } from '../../data/heroData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import {
    canAddComingSoonEquipment,
    createComingSoonEquipmentItem,
    COMING_SOON_KEY
} from '../../domain/equipment/comingSoonEquipmentDomain.js';
import { translate } from '../../i18n/translator.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

let selectedHeroKey = 'barbarianKing';
let selectedRarity = 'epic';
/** @type {((data?: { heroKey: string, rarity: string }) => void) | null} */
let activeOnAdded = null;
/** @type {(() => void) | null} */
let activeOnCancel = null;
let isInitialized = false;
let isConfirmed = false;

/**
 * Renders the hero selection buttons dynamically based on heroData and heroOrder.
 *
 * @param {HTMLElement} modal
 * @param {string} selectedKey
 */
function renderHeroOptions(modal, selectedKey) {
    const container = modal.querySelector('#coming-soon-hero-options');
    if (!container) return;

    container.innerHTML = '';
    let heroKeys = Object.keys(heroData);
    if (state.uiSettings?.heroOrder) {
        const savedOrder = state.uiSettings.heroOrder;
        heroKeys.sort((a, b) => {
            const nameA = heroData[a]?.name || a;
            const nameB = heroData[b]?.name || b;
            const idxA = savedOrder.indexOf(nameA);
            const idxB = savedOrder.indexOf(nameB);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }

    for (const heroKey of heroKeys) {
        const hero = heroData[heroKey];
        if (!hero) continue;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        const isSelected = heroKey === selectedKey;
        btn.setAttribute('aria-checked', String(isSelected));
        btn.className = `btn-hero-choice${isSelected ? ' is-selected' : ''}`;
        btn.setAttribute('data-hero-key', heroKey);

        const rawEmblem = hero.emblem || '';
        const emblemSrc = rawEmblem.startsWith('/') ? rawEmblem : `/${rawEmblem}`;
        const heroDisplayName = translate(`entities.heroes.${heroKey}`) || hero.name;

        btn.innerHTML = `
            <clashcalc-assets-image src="${emblemSrc}" alt="" class="hero-choice-emblem" size="thumbnail"></clashcalc-assets-image>
            <span class="hero-choice-name">${heroDisplayName}</span>
        `;

        btn.addEventListener('click', () => {
            selectedHeroKey = heroKey;
            container.querySelectorAll('.btn-hero-choice').forEach(b => {
                const isMatch = b === btn;
                b.classList.toggle('is-selected', isMatch);
                b.setAttribute('aria-checked', String(isMatch));
            });
        });

        container.appendChild(btn);
    }
}

/**
 * Initializes DOM listeners for the Add Coming Soon equipment modal.
 */
function initModalListeners() {
    if (isInitialized || typeof document === 'undefined') return;
    const modal = document.getElementById('add-coming-soon-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('close-add-coming-soon-modal-btn');
    const cancelBtn = document.getElementById('cancel-add-coming-soon-modal-btn');
    const confirmBtn = document.getElementById('confirm-add-coming-soon-btn');

    const handleCancel = () => {
        if (!isConfirmed && typeof activeOnCancel === 'function') {
            const cancelCb = activeOnCancel;
            activeOnCancel = null;
            cancelCb();
        }
        closeModalAnimated('add-coming-soon-modal');
    };

    closeBtn?.addEventListener('click', handleCancel);
    cancelBtn?.addEventListener('click', handleCancel);
    modal.addEventListener('close', () => {
        if (!isConfirmed && typeof activeOnCancel === 'function') {
            const cancelCb = activeOnCancel;
            activeOnCancel = null;
            cancelCb();
        }
    });

    modal.querySelectorAll('.btn-rarity-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            const rarity = btn.getAttribute('data-rarity');
            if (rarity === 'common' || rarity === 'epic') {
                selectedRarity = rarity;
                modal.querySelectorAll('.btn-rarity-choice').forEach(b => {
                    const isMatch = b === btn;
                    b.classList.toggle('is-selected', isMatch);
                    b.setAttribute('aria-checked', String(isMatch));
                });
            }
        });
    });

    confirmBtn?.addEventListener('click', () => {
        if (!canAddComingSoonEquipment(state.heroes, selectedHeroKey)) {
            closeModalAnimated('add-coming-soon-modal');
            return;
        }

        const addedHeroKey = selectedHeroKey;
        const addedRarity = selectedRarity;
        isConfirmed = true;
        activeOnCancel = null;

        handleStateUpdate(() => {
            if (!state.heroes[addedHeroKey]) {
                state.heroes[addedHeroKey] = { equipment: {} };
            }
            if (!state.heroes[addedHeroKey].equipment) {
                state.heroes[addedHeroKey].equipment = {};
            }
            state.heroes[addedHeroKey].equipment[COMING_SOON_KEY] = createComingSoonEquipmentItem(/** @type {'common' | 'epic'} */ (addedRarity));
            if (!state.planner.storageGoal) {
                state.planner.storageGoal = { preset: 'nextEpic' };
            } else {
                state.planner.storageGoal.preset = 'nextEpic';
            }
        });
        closeModalAnimated('add-coming-soon-modal', () => {
            if (typeof activeOnAdded === 'function') {
                activeOnAdded({ heroKey: addedHeroKey, rarity: addedRarity });
            }
        });
    });

    isInitialized = true;
}

/**
 * Opens the Add Coming Soon Equipment modal with hero and rarity selection.
 *
 * @param {((data?: { heroKey: string, rarity: string }) => void)} [onAdded] - Callback invoked when equipment is successfully added.
 * @param {string} [initialHeroKey='barbarianKing'] - Optional initially selected hero.
 * @param {(() => void)} [onCancel] - Optional callback invoked when modal is cancelled or closed without adding.
 */
export function openAddComingSoonModal(onAdded, initialHeroKey = 'barbarianKing', onCancel = null) {
    initModalListeners();
    activeOnAdded = onAdded || null;
    activeOnCancel = onCancel || null;
    isConfirmed = false;
    selectedHeroKey = initialHeroKey || 'barbarianKing';
    selectedRarity = 'epic';

    const modal = document.getElementById('add-coming-soon-modal');
    if (modal) {
        renderHeroOptions(modal, selectedHeroKey);
        const commonCap = modal.querySelector('[data-rarity-cap="common"]');
        if (commonCap) commonCap.textContent = translate('views.equipment.rarityMaxLevel', { level: 18 });
        const epicCap = modal.querySelector('[data-rarity-cap="epic"]');
        if (epicCap) epicCap.textContent = translate('views.equipment.rarityMaxLevel', { level: 27 });
        modal.querySelectorAll('.btn-rarity-choice').forEach(btn => {
            const isMatch = btn.getAttribute('data-rarity') === selectedRarity;
            btn.classList.toggle('is-selected', isMatch);
            btn.setAttribute('aria-checked', String(isMatch));
        });
    }

    openModal('add-coming-soon-modal');
}
