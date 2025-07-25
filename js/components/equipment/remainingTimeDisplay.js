import { dom } from '../../dom/domElements.js';

export function renderRemainingTime(remainingTime) {
    const timeElements = dom.income?.home?.results?.time;
    const dateElements = dom.income?.home?.results?.date;

    if (timeElements && dateElements) {
        if (timeElements.shiny) timeElements.shiny.textContent = remainingTime.shiny?.time || 'N/A';
        if (dateElements.shiny) dateElements.shiny.textContent = remainingTime.shiny?.date || 'N/A';

        if (timeElements.glowy) timeElements.glowy.textContent = remainingTime.glowy?.time || 'N/A';
        if (dateElements.glowy) dateElements.glowy.textContent = remainingTime.glowy?.date || 'N/A';
        
        if (timeElements.starry) timeElements.starry.textContent = remainingTime.starry?.time || 'N/A';
        if (dateElements.starry) dateElements.starry.textContent = remainingTime.starry?.date || 'N/A';
    }
}