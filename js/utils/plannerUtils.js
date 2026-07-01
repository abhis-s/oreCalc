import { state } from '../core/state.js';

/**
 * Cleans up the upgrade plan for a specific equipment.
 * Removes steps that have been reached and re-indexes remaining steps.
 */
export function cleanupUpgradePlan(equipment) {
    if (!equipment.upgradePlan) return;

    const currentLevel = equipment.level || 1;
    const remainingSteps = [];

    for (const stepKey in equipment.upgradePlan) {
        const step = equipment.upgradePlan[stepKey];
        if (step.enabled && step.targetLevel > currentLevel) {
            remainingSteps.push(step);
        }
    }

    if (remainingSteps.length === 0) {
        delete equipment.upgradePlan;
    } else {
        remainingSteps.sort((a, b) => a.targetLevel - b.targetLevel);
        const newUpgradePlan = {};
        remainingSteps.forEach((step, index) => {
            newUpgradePlan[(index + 1).toString()] = {
                targetLevel: step.targetLevel,
                enabled: step.enabled,
                priorityIndex: step.priorityIndex
            };
        });
        equipment.upgradePlan = newUpgradePlan;
    }
}

/**
 * Re-indexes the global priority indices for all enabled upgrade plan steps.
 */
export function reindexGlobalPriority() {
    const globalPriorityList = [];
    for (const heroKey in state.heroes) {
        for (const equipName in state.heroes[heroKey].equipment) {
            const equipment = state.heroes[heroKey].equipment[equipName];
            if (equipment.upgradePlan) {
                for (const stepNum in equipment.upgradePlan) {
                    const stepData = equipment.upgradePlan[stepNum];
                    if (stepData.enabled && stepData.priorityIndex > 0) {
                        globalPriorityList.push({
                            heroName: heroKey,
                            equipName: equipName,
                            step: stepNum,
                            priorityIndex: stepData.priorityIndex
                        });
                    }
                }
            }
        }
    }

    globalPriorityList.sort((a, b) => a.priorityIndex - b.priorityIndex);
    globalPriorityList.forEach((item, index) => {
        if (state.heroes[item.heroName]?.equipment[item.equipName]?.upgradePlan?.[item.step]) {
            state.heroes[item.heroName].equipment[item.equipName].upgradePlan[item.step].priorityIndex = index + 1;
        }
    });
}
