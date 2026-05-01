import { conversionRates } from '../data/oreConversionData.js';

function getOreValue(oreType) {
    switch (oreType) {
        case 'shiny':
            return 1;
        case 'glowy':
            return conversionRates.shiny / conversionRates.glowy;
        case 'starry':
            return conversionRates.shiny / conversionRates.starry;
        default:
            return 0;
    }
}

export function convertOres(fromOre, toOre, fromAmount) {
    if (fromOre === toOre) {
        return fromAmount;
    }

    const fromValue = getOreValue(fromOre);
    const toValue = getOreValue(toOre);

    const conversionFactor = fromValue / toValue;

    return Math.round(fromAmount * conversionFactor);
}

export function calculateProspectorIncome(prospectorState) {
    const zeroIncome = { shiny: 0, glowy: 0, starry: 0 };
    
    if (!prospectorState) {
        return { daily: zeroIncome, weekly: zeroIncome, monthly: zeroIncome, bimonthly: zeroIncome };
    }

    const { goldPass, fromOre, toOre, fromAmount } = prospectorState;

    if (!goldPass) {
        return { daily: zeroIncome, weekly: zeroIncome, monthly: zeroIncome, bimonthly: zeroIncome };
    }

    const daily = { shiny: 0, glowy: 0, starry: 0 };
    const toAmount = convertOres(fromOre, toOre, fromAmount);

    daily[fromOre] -= fromAmount;
    daily[toOre] += toAmount;

    const monthly = {
        shiny: daily.shiny * 30,
        glowy: daily.glowy * 30,
        starry: daily.starry * 30,
    };

    const weekly = {
        shiny: daily.shiny * 7,
        glowy: daily.glowy * 7,
        starry: daily.starry * 7,
    };

    const bimonthly = {
        shiny: monthly.shiny * 2,
        glowy: monthly.glowy * 2,
        starry: monthly.starry * 2,
    };

    return { daily, weekly, monthly, bimonthly };
}

