import { dom } from '../../dom/domElements.js';

export function renderRequiredOres(requiredOres) {
    const eqTabElements = dom.equipment?.results?.quantity;
    const homeTabElements = dom.income.home?.results?.quantity;

    const shiny = (requiredOres.shiny || 0).toLocaleString();
    const glowy = (requiredOres.glowy || 0).toLocaleString();
    const starry = (requiredOres.starry || 0).toLocaleString();

    if (eqTabElements?.shiny) eqTabElements.shiny.textContent = shiny;
    if (eqTabElements?.glowy) eqTabElements.glowy.textContent = glowy;
    if (eqTabElements?.starry) eqTabElements.starry.textContent = starry;

    if (homeTabElements?.shiny) homeTabElements.shiny.textContent = shiny;
    if (homeTabElements?.glowy) homeTabElements.glowy.textContent = glowy;
    if (homeTabElements?.starry) homeTabElements.starry.textContent = starry;
}