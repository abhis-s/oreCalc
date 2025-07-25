export function initializeOfferGrid({ container, offers, onStateChange }) {
    if (!container) return;

    container.addEventListener('change', (event) => {
        const target = event.target;

        if (target.type === 'checkbox') {
            const fullCheckboxId = target.id;
            
            const lastUnderscoreIndex = fullCheckboxId.lastIndexOf('_');
            const baseOfferId = fullCheckboxId.substring(0, lastUnderscoreIndex);

            const offer = offers.find(o => o.id === baseOfferId);
            if (!offer) {
                return;
            }

            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';

            const offerCheckboxes = Array.from(container.querySelectorAll(`input[type="checkbox"][id^="${baseOfferId}_"]`))
                                    .sort((a, b) => parseInt(a.dataset.instance) - parseInt(b.dataset.instance));

            const clickedIndex = offerCheckboxes.indexOf(target);
            let newCheckedCount = 0;

            if (target.checked) {
                for (let i = 0; i <= clickedIndex; i++) {
                    offerCheckboxes[i].checked = true;
                }
                newCheckedCount = clickedIndex + 1;
            } else {
                for (let i = clickedIndex; i < offerCheckboxes.length; i++) {
                    offerCheckboxes[i].checked = false;
                }
                newCheckedCount = clickedIndex;
            }
            onStateChange(baseOfferId, oreType, newCheckedCount);
        } else if (target.tagName === 'SELECT') {
            const offerId = target.id;
            const offer = offers.find(o => o.id === offerId);
            if (!offer) return;
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            const count = parseInt(target.value, 10);
            onStateChange(offerId, oreType, count);
        }
    });
}

export function renderOfferGrid({ container, offers, stateSelector, renderRow, onRowAppended }) {
    if (!container) return;
    container.innerHTML = '';

    offers.forEach(offer => {
        const offerState = stateSelector(offer);
        const rowElement = renderRow(offer, offerState);
        if (rowElement) {
            container.appendChild(rowElement);
            if (onRowAppended) {
                onRowAppended(rowElement, offer);
            }
        }
    });
}