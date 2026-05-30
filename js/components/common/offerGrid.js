export function initializeOfferGrid({ container, offers, onStateChange, getDynamicOffers }) {
    if (!container) return;

    container.addEventListener('change', (event) => {
        const target = event.target;
        
        let offerId = target.dataset.offerId;
        if (!offerId && target.id) {
            const fullId = target.id;
            const lastUnderscoreIndex = fullId.lastIndexOf('_');
            if (lastUnderscoreIndex !== -1) {
                offerId = fullId.substring(0, lastUnderscoreIndex);
                if (offerId.startsWith('cb_')) {
                    offerId = offerId.substring(3);
                }
            }
        }

        if (!offerId) return;

        const currentOffers = getDynamicOffers ? getDynamicOffers() : (offers || []);
        const offer = currentOffers.find(o => o.id === offerId);
        
        if (!offer) return;

        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';

        if (target.type === 'checkbox') {
            let offerCheckboxes = Array.from(container.querySelectorAll(`input[type="checkbox"][data-offer-id="${CSS.escape(offerId)}"]`));
            if (offerCheckboxes.length === 0) {
                offerCheckboxes = Array.from(container.querySelectorAll(`input[type="checkbox"][id^="${offerId}_"], input[type="checkbox"][id^="cb_${offerId}_"]`));
            }
            
            offerCheckboxes.sort((a, b) => {
                const aInst = parseInt(a.dataset.instance || a.id.split('_').pop(), 10);
                const bInst = parseInt(b.dataset.instance || b.id.split('_').pop(), 10);
                return aInst - bInst;
            });

            const clickedIndex = offerCheckboxes.indexOf(target);
            if (clickedIndex === -1) return;

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
            onStateChange(offerId, oreType, newCheckedCount);
        } else if (target.tagName === 'SELECT') {
            const count = parseInt(target.value, 10) || 0;
            onStateChange(offerId, oreType, count);
        }
    });

    container.addEventListener('validated-input', (event) => {
        const target = event.target;
        let offerId = target.dataset.offerId;
        if (!offerId && target.id) {
            const fullId = target.id;
            const lastUnderscoreIndex = fullId.lastIndexOf('_');
            if (lastUnderscoreIndex !== -1) {
                offerId = fullId.substring(0, lastUnderscoreIndex);
                if (offerId.startsWith('cb_')) {
                    offerId = offerId.substring(3);
                }
            }
        }

        if (!offerId) return;

        const currentOffers = getDynamicOffers ? getDynamicOffers() : (offers || []);
        const offer = currentOffers.find(o => o.id === offerId);
        if (!offer) return;

        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
        const count = event.detail.value;
        onStateChange(offerId, oreType, count);
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