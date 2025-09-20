import { dom } from '../../dom/domElements.js';
import { formatDate } from '../../utils/dateFormatter.js';

export function renderRemainingTime(remainingTime) {
    const timeElements = dom.income?.home?.results?.time;
    const dateElements = dom.income?.home?.results?.date;
    const formatOptions = { year: '2-digit', month: 'short', day: '2-digit' };

    if (timeElements && dateElements) {
        if (timeElements.shiny) {
            if (remainingTime.shiny.years !== null) {
                timeElements.shiny.years.textContent = remainingTime.shiny.years;
                timeElements.shiny.months.textContent = remainingTime.shiny.months;
                timeElements.shiny.days.textContent = remainingTime.shiny.days;
            } else {
                timeElements.shiny.years.textContent = "0";
                timeElements.shiny.months.textContent = "0";
                timeElements.shiny.days.textContent = "0";
            }
        }
        if (dateElements.shiny) {
            dateElements.shiny.textContent = remainingTime.shiny?.date instanceof Date 
                ? formatDate(remainingTime.shiny.date, formatOptions) 
                : 'N/A';
        }

        if (timeElements.glowy) {
            if (remainingTime.glowy.years !== null) {
                timeElements.glowy.years.textContent = remainingTime.glowy.years;
                timeElements.glowy.months.textContent = remainingTime.glowy.months;
                timeElements.glowy.days.textContent = remainingTime.glowy.days;
            } else {
                timeElements.glowy.years.textContent = "0";
                timeElements.glowy.months.textContent = "0";
                timeElements.glowy.days.textContent = "0";
            }
        }
        if (dateElements.glowy) {
            dateElements.glowy.textContent = remainingTime.glowy?.date instanceof Date 
                ? formatDate(remainingTime.glowy.date, formatOptions) 
                : 'N/A';
        }
        
        if (timeElements.starry) {
            if (remainingTime.starry.years !== null) {
                timeElements.starry.years.textContent = remainingTime.starry.years;
                timeElements.starry.months.textContent = remainingTime.starry.months;
                timeElements.starry.days.textContent = remainingTime.starry.days;
            } else {
                timeElements.starry.years.textContent = "0";
                timeElements.starry.months.textContent = "0";
                timeElements.starry.days.textContent = "0";
            }
        }
        if (dateElements.starry) {
            dateElements.starry.textContent = remainingTime.starry?.date instanceof Date 
                ? formatDate(remainingTime.starry.date, formatOptions) 
                : 'N/A';
        }
    }
}