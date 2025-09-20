import { dom } from '../../dom/domElements.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderRequiredOres(requiredOres) {
    const eqTabElements = dom.equipment?.results?.quantity;
    const homeTabElements = dom.income.home?.results?.quantity;

    const shiny = formatNumber(Math.round(requiredOres.shiny || 0));
    const glowy = formatNumber(Math.round(requiredOres.glowy || 0));
    const starry = formatNumber(Math.round(requiredOres.starry || 0));

    if (eqTabElements?.shiny) eqTabElements.shiny.textContent = shiny;
    if (eqTabElements?.glowy) eqTabElements.glowy.textContent = glowy;
    if (eqTabElements?.starry) eqTabElements.starry.textContent = starry;

    if (homeTabElements?.shiny) homeTabElements.shiny.textContent = shiny;
    if (homeTabElements?.glowy) homeTabElements.glowy.textContent = glowy;
    if (homeTabElements?.starry) homeTabElements.starry.textContent = starry;
}