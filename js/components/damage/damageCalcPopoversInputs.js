/**
 * Contextual Help Popovers Event Listener Controller for Damage Calculator.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments).
 */

import { showCardHelpPopover, hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import {
    getGenericInfoPopoverContent,
    getActionInfoPopoverContent,
    getNoteCodePopoverContent,
    getDamageSourcePopoverContent
} from './damageCalcOffensePopoversDisplay.js';
import {
    getComboBreakdownPopoverContent,
    getClusterTargetPopoverContent,
    getCasualtyPopoverContent,
    getComboBadgePopoverContent,
    getSharedComboPopoverContent
} from './damageCalcGridPopoversDisplay.js';

/** @type {Object | null} */
let currentDamageState = null;
let isDamageCalcPopoversBound = false;

/**
 * Attaches contextual help popover listeners to the damage calculator root container.
 *
 * @param {HTMLElement} rootContainer - Root container element.
 * @param {Object} state - Damage calculator state.
 */
export function attachDamageCalcPopoverListeners(rootContainer, state) {
    if (!rootContainer) return;
    currentDamageState = state;

    // Contextual Help Popovers: Desktop hover (pointerenter/pointerleave) + Mobile/Keyboard (click/enter/space)
    const handlePopoverTrigger = (target, isClick = false) => {
        // Generic feature info
        const infoTrigger = target.closest('[data-calc-info]');
        if (infoTrigger) {
            const infoKey = infoTrigger.getAttribute('data-calc-info');
            const content = getGenericInfoPopoverContent(infoKey);
            if (content) {
                showCardHelpPopover(infoTrigger, content, { isToggle: isClick });
                return true;
            }
        }

        // Action info
        const actionTrigger = target.closest('[data-action-info]');
        if (actionTrigger) {
            const actionKey = actionTrigger.getAttribute('data-action-info');
            const content = getActionInfoPopoverContent(actionKey, currentDamageState || state);
            if (content) {
                showCardHelpPopover(actionTrigger, content, { isToggle: isClick });
                return true;
            }
        }

        // Strike log note code
        const noteTrigger = target.closest('[data-note-code]');
        if (noteTrigger) {
            const noteCode = noteTrigger.getAttribute('data-note-code');
            const content = getNoteCodePopoverContent(noteCode);
            if (content) {
                showCardHelpPopover(noteTrigger, content, { isToggle: isClick });
                return true;
            }
        }

        // Combo defense breakdown or table row breakdown
        const comboInfoBtn = target.closest('.calc-combo-defense-card__info-btn, [data-combo-defense-info], [data-combo-table-info]');
        const tableRow = target.closest('[data-combo-row-index]');
        const comboTrigger = comboInfoBtn || tableRow;
        if (comboTrigger) {
            const comboCard = target.closest('.calc-combo-defense-card, [data-combo-row-index], .calc-target-combo-row');
            if (comboCard) {
                const anchor = comboInfoBtn || target.closest('.calc-info-btn') || comboCard;
                const content = getComboBreakdownPopoverContent(comboCard, currentDamageState || state);
                if (content) {
                    showCardHelpPopover(anchor, content, { isToggle: isClick });
                    return true;
                }
            }
        }

        // Cluster target card breakdown
        const clusterInfoBtn = target.closest('.calc-info-btn[data-cluster-target-info]');
        if (clusterInfoBtn) {
            const clusterCard = target.closest('.cluster-target-card') || clusterInfoBtn;
            const content = getClusterTargetPopoverContent(clusterCard);
            if (content) {
                showCardHelpPopover(clusterInfoBtn, content, { isToggle: isClick });
                return true;
            }
        }

        // Casualty card strike breakdown
        const casualtyInfoBtn = target.closest('[data-casualty-info-btn], .calc-info-btn');
        const casualtyCard = target.closest('.calc-casualty-card');
        const casualtyTrigger = isClick ? casualtyInfoBtn : (casualtyInfoBtn || casualtyCard);
        if (casualtyTrigger && casualtyCard) {
            const anchor = casualtyInfoBtn || casualtyCard;
            const content = getCasualtyPopoverContent(casualtyCard, currentDamageState || state);
            if (content) {
                showCardHelpPopover(anchor, content, { isToggle: isClick });
                return true;
            }
        }

        // Damage sources bar popover (equipment, lightning, earthquake)
        const sourceTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-source-info]'));
        if (sourceTrigger) {
            if (!isClick) {
                const sourceKey = sourceTrigger.dataset?.sourceInfo || sourceTrigger.getAttribute?.('data-source-info') || '';
                const level = Number(sourceTrigger.dataset?.sourceLevel ?? sourceTrigger.getAttribute?.('data-source-level')) || 0;
                const content = getDamageSourcePopoverContent(sourceKey, level, currentDamageState || state);
                if (content) {
                    showCardHelpPopover(sourceTrigger, content, { isToggle: false });
                    return true;
                }
            }
        }

        // Combo card badges popover (equipment, lightning, earthquake)
        const comboBadge = /** @type {HTMLElement | null} */ (target.closest('[data-combo-badge]'));
        if (comboBadge) {
            const badgeType = comboBadge.dataset?.comboBadge || comboBadge.getAttribute?.('data-combo-badge') || '';
            const content = getComboBadgePopoverContent(comboBadge, badgeType, currentDamageState || state);
            if (content) {
                showCardHelpPopover(comboBadge, content, { isToggle: isClick });
                return true;
            }
        }

        // Shared combination info pill
        const sharedTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-shared-combo-info]'));
        if (sharedTrigger) {
            const rawKeys = sharedTrigger.dataset?.sharedDefenses || sharedTrigger.getAttribute?.('data-shared-defenses') || '';
            const defenseKeys = rawKeys ? rawKeys.split(',').filter(Boolean) : [];
            const content = getSharedComboPopoverContent(defenseKeys, currentDamageState || state);
            if (content) {
                showCardHelpPopover(sharedTrigger, content, { isToggle: isClick });
                return true;
            }
        }

        return false;
    };

    const damagePopoverTriggerSelector = '[data-calc-info], [data-action-info], [data-note-code], .calc-combo-defense-card__info-btn, [data-combo-defense-info], [data-combo-table-info], .calc-info-btn, [data-combo-row-index], [data-cluster-target-info], [data-casualty-info-btn], [data-source-info], [data-combo-badge], [data-shared-combo-info]';

    if (!isDamageCalcPopoversBound) {
        isDamageCalcPopoversBound = true;

        rootContainer.addEventListener('click', (e) => {
            const trigger = /** @type {HTMLElement | null} */ (e.target)?.closest(damagePopoverTriggerSelector);
            if (!trigger) return;
            const handled = handlePopoverTrigger(trigger, true);
            if (handled) {
                if (trigger.closest('.calc-info-btn, .sim-action-card__info-btn, .calc-note-badge, .calc-combo-defense-card__info-btn, [data-combo-defense-info], [data-combo-badge], [data-shared-combo-info]')) {
                    e.stopPropagation();
                }
            }
        });

        rootContainer.addEventListener('pointerover', (e) => {
            if (e.pointerType === 'touch') return;
            const trigger = /** @type {HTMLElement | null} */ (e.target)?.closest(damagePopoverTriggerSelector);
            if (trigger) {
                handlePopoverTrigger(trigger, false);
            }
        });

        rootContainer.addEventListener('pointerout', (e) => {
            if (e.pointerType === 'touch') return;
            const trigger = /** @type {HTMLElement | null} */ (e.target)?.closest(damagePopoverTriggerSelector);
            if (!trigger) return;

            const related = /** @type {Node | null} */ (e.relatedTarget);
            if (related && (trigger.contains(related) || document.getElementById('card-help-popover')?.contains(related))) {
                return;
            }

            hideCardHelpPopover();
        });

        rootContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const trigger = e.target.closest('[data-combo-badge], [data-shared-combo-info]');
                if (trigger) {
                    e.preventDefault();
                    handlePopoverTrigger(trigger, true);
                }
            }
        });
    }
}
