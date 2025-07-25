import { upgradeCosts, heroData } from '../data/appData.js';

export function calculateRequiredOres(heroesState, storedOres) {
    let totalRequired = { shiny: 0, glowy: 0, starry: 0 };

    for (const heroName in heroesState) {
        const hero = heroesState[heroName];
        if (!hero.enabled) continue;

        for (const equipName in hero.equipment) {
            const equip = hero.equipment[equipName];
            if (!equip.checked) continue;

            const equipData = getEquipmentData(heroName, equipName);
            if (!equipData) continue;

            for (let i = equip.level + 1; i <= equipData.maxLevel; i++) {
                if (upgradeCosts[i]) {
                    totalRequired.shiny += upgradeCosts[i].shiny || 0;
                    totalRequired.glowy += upgradeCosts[i].glowy || 0;
                    if (equipData.type === 'epic') {
                        totalRequired.starry += upgradeCosts[i].starry || 0;
                    }
                }
            }
        }
    }

    return {
        shiny: Math.max(0, totalRequired.shiny - (storedOres.shiny || 0)),
        glowy: Math.max(0, totalRequired.glowy - (storedOres.glowy || 0)),
        starry: Math.max(0, totalRequired.starry - (storedOres.starry || 0)),
    };
}

function getEquipmentData(heroName, equipName) {
    const hero = Object.values(heroData).find(h => h.name === heroName);
    const equipment = hero?.equipment.find(e => e.name === equipName);
    if (!equipment) return null;

    const maxLevel = equipment.type === 'common' ? 18 : 27;
    return { type: equipment.type, maxLevel: maxLevel };
}