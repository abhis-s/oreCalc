/**
 * Maps each slot index to the corresponding card element based on active drag position.
 *
 * @param {HTMLElement[]} originalCardsList - List of unhidden cards in natural DOM order.
 * @param {HTMLElement|null} activeDragCard - The card currently being dragged.
 * @param {number} startIndex - Initial index of active card.
 * @param {number} currentDropIndex - Target index where card would drop.
 * @returns {Map<number, HTMLElement>} Map from slot index to card element.
 */
export function computeSlotToCardMapping(originalCardsList, activeDragCard, startIndex, currentDropIndex) {
    const slotToCardMap = new Map();

    originalCardsList.forEach((c, idx) => {
        let targetIndex = idx;
        if (c === activeDragCard) {
            targetIndex = currentDropIndex;
        } else if (startIndex < currentDropIndex) {
            if (idx > startIndex && idx <= currentDropIndex) {
                targetIndex = idx - 1;
            }
        } else if (startIndex > currentDropIndex) {
            if (idx >= currentDropIndex && idx < startIndex) {
                targetIndex = idx + 1;
            }
        }
        slotToCardMap.set(targetIndex, c);
    });

    return slotToCardMap;
}

/**
 * Calculates absolute visual slot positions for 1-column and 2-column card layouts.
 *
 * @param {HTMLElement[]} originalCardsList - List of unhidden cards in natural DOM order.
 * @param {Map<HTMLElement, Object>} cardRectsMap - Measured bounding rectangles per card.
 * @param {Map<number, HTMLElement>} slotToCardMap - Slot-to-card mapping.
 * @returns {Map<number, { left: number, top: number }>} Map from slot index to visual left/top.
 */
export function calculateSlotVisualPositions(originalCardsList, cardRectsMap, slotToCardMap) {
    const slotVisualRects = new Map();
    const numCards = originalCardsList.length;
    if (numCards === 0) return slotVisualRects;

    const leftPositions = [];
    for (const c of originalCardsList) {
        const r = cardRectsMap.get(c);
        if (!r || r.width <= 0) continue;
        const existing = leftPositions.find(x => Math.abs(x - r.left) < 20);
        if (existing === undefined) {
            leftPositions.push(r.left);
        }
    }
    leftPositions.sort((a, b) => a - b);
    const numCols = Math.max(1, leftPositions.length);
    const verticalGap = 20;

    if (numCols === 1) {
        let currentTop = cardRectsMap.get(originalCardsList[0])?.top || 0;
        const initialLeft = leftPositions[0] !== undefined ? leftPositions[0] : (cardRectsMap.get(originalCardsList[0])?.left || 0);

        for (let slot = 0; slot < numCards; slot++) {
            const cardInSlot = slotToCardMap.get(slot);
            const cardHeight = cardRectsMap.get(cardInSlot)?.height || 0;

            slotVisualRects.set(slot, { left: initialLeft, top: currentTop });
            currentTop += cardHeight + verticalGap;
        }
    } else {
        const colLeft0 = leftPositions[0];
        const colLeft1 = leftPositions[1] !== undefined ? leftPositions[1] : (colLeft0 + 400);

        let colTop0 = Infinity;
        let colTop1 = Infinity;

        originalCardsList.forEach((c) => {
            const r = cardRectsMap.get(c);
            if (!r) return;
            if (Math.abs(r.left - colLeft0) < 20) {
                if (r.top < colTop0) colTop0 = r.top;
            } else if (Math.abs(r.left - colLeft1) < 20) {
                if (r.top < colTop1) colTop1 = r.top;
            }
        });

        if (!isFinite(colTop0)) colTop0 = cardRectsMap.get(originalCardsList[0])?.top || 0;
        if (!isFinite(colTop1)) colTop1 = colTop0;

        for (let slot = 0; slot < numCards; slot++) {
            const colIndex = slot % 2;
            const cardInSlot = slotToCardMap.get(slot);
            const cardHeight = cardRectsMap.get(cardInSlot)?.height || 0;

            if (colIndex === 0) {
                slotVisualRects.set(slot, { left: colLeft0, top: colTop0 });
                colTop0 += cardHeight + verticalGap;
            } else {
                slotVisualRects.set(slot, { left: colLeft1, top: colTop1 });
                colTop1 += cardHeight + verticalGap;
            }
        }
    }

    return slotVisualRects;
}

/**
 * Applies GPU translate3d transitions to all layout cards according to current drop slot candidate.
 *
 * @param {Object} params
 * @param {HTMLElement[]} params.originalCardsList - Ordered list of cards.
 * @param {Map<HTMLElement, Object>} params.cardRectsMap - Map of initial card coordinates.
 * @param {HTMLElement|null} params.activeDragCard - Currently dragged card.
 * @param {number} params.startIndex - Origin index.
 * @param {number} params.currentDropIndex - Current hover drop target index.
 */
export function applyGPUTransforms({ originalCardsList, cardRectsMap, activeDragCard, startIndex, currentDropIndex }) {
    if (!originalCardsList || originalCardsList.length === 0) return;

    const slotToCardMap = computeSlotToCardMapping(originalCardsList, activeDragCard, startIndex, currentDropIndex);
    const slotVisualRects = calculateSlotVisualPositions(originalCardsList, cardRectsMap, slotToCardMap);

    originalCardsList.forEach((c, idx) => {
        const originData = cardRectsMap.get(c);
        if (!originData) return;

        let targetIndex = idx;
        if (c === activeDragCard) {
            targetIndex = currentDropIndex;
        } else if (startIndex < currentDropIndex) {
            if (idx > startIndex && idx <= currentDropIndex) {
                targetIndex = idx - 1;
            }
        } else if (startIndex > currentDropIndex) {
            if (idx >= currentDropIndex && idx < startIndex) {
                targetIndex = idx + 1;
            }
        }

        const targetVisualPos = slotVisualRects.get(targetIndex);
        if (targetVisualPos) {
            const dx = targetVisualPos.left - originData.left;
            const dy = targetVisualPos.top - originData.top;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                c.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
                c.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                return;
            }
        }

        c.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        c.style.transform = '';
    });
}
