import { translate } from '../../i18n/translator.js';

/**
 * Creates the initial Town Hall start divider at the beginning of the track.
 * @param {number} startTH
 * @param {number} startLvl
 * @param {boolean} isCurrentTH
 * @returns {HTMLDivElement}
 */
export function createTHStartDivider(startTH, startLvl, isCurrentTH) {
    const startDivider = document.createElement('div');
    startDivider.className = `th-max-divider th-start-initial-divider ${isCurrentTH ? 'current-th-divider' : ''}`;
    startDivider.dataset.th = String(startTH);
    startDivider.dataset.startLvl = String(startLvl);

    const line = document.createElement('div');
    line.className = 'th-max-line';
    startDivider.appendChild(line);

    const pill = document.createElement('div');
    pill.className = 'th-max-pill';
    pill.innerHTML = `
        <orecalc-assets-image src="assets/th/th${startTH}.png" alt="TH${startTH}" class="th-max-img"></orecalc-assets-image>
        <div class="th-max-pill-content">
            <span class="th-max-tag" data-i18n="views.home.heroJourney.thStartTag" data-i18n-args='{"th":${startTH}}'>${translate('views.home.heroJourney.thStartTag', { th: startTH })}</span>
            <span class="th-max-lvl" data-i18n="views.home.heroJourney.thStartLvl" data-i18n-args='{"lvl":${startLvl}}'>${translate('views.home.heroJourney.thStartLvl', { lvl: startLvl })}</span>
        </div>
    `;
    startDivider.appendChild(pill);
    return startDivider;
}

/**
 * Creates a Town Hall milestone divider between nodes.
 * @param {number} highestNextTH
 * @param {number} startLvlVal
 * @param {boolean} isCurrentTHDivider
 * @returns {HTMLDivElement}
 */
export function createTHBoundaryDivider(highestNextTH, startLvlVal, isCurrentTHDivider) {
    const divider = document.createElement('div');
    divider.className = `th-max-divider ${isCurrentTHDivider ? 'current-th-divider' : ''}`;
    divider.dataset.th = String(highestNextTH);
    divider.dataset.startLvl = String(startLvlVal);

    const line = document.createElement('div');
    line.className = 'th-max-line';
    divider.appendChild(line);

    const pill = document.createElement('div');
    pill.className = 'th-max-pill';

    pill.innerHTML = `
        <orecalc-assets-image src="assets/th/th${highestNextTH}.png" alt="TH${highestNextTH}" class="th-max-img"></orecalc-assets-image>
        <div class="th-max-pill-content">
            <span class="th-max-tag" data-i18n="views.home.heroJourney.thStartTag" data-i18n-args='{"th":${highestNextTH}}'>${translate('views.home.heroJourney.thStartTag', { th: highestNextTH })}</span>
            <span class="th-max-lvl" data-i18n="views.home.heroJourney.thStartLvl" data-i18n-args='{"lvl":${startLvlVal}}'>${translate('views.home.heroJourney.thStartLvl', { lvl: startLvlVal })}</span>
        </div>
    `;
    divider.appendChild(pill);
    return divider;
}

/**
 * Creates an end-of-track block card (True Max or Town Hall limit preview).
 * @param {Object} opts
 * @param {boolean} opts.isTrueMax
 * @param {boolean} opts.isGuest
 * @param {number} opts.thLevel
 * @param {boolean} opts.revealBeyondTH
 * @param {number} opts.nextTH
 * @param {number} opts.nextTHStartLvl
 * @returns {HTMLDivElement}
 */
export function createTHLimitBlockCard({ isTrueMax, isGuest, thLevel, revealBeyondTH, nextTH, nextTHStartLvl }) {
    const blockCard = document.createElement('div');

    if (isTrueMax || (isGuest && thLevel >= 18)) {
        blockCard.className = 'th-limit-block-card true-max-card';
        blockCard.innerHTML = `
            <orecalc-assets-image src="assets/th/th18.png" alt="TH18" class="th-limit-img"></orecalc-assets-image>
            <div class="th-limit-text"><span data-i18n="views.home.heroJourney.trueMaxTitle">${translate('views.home.heroJourney.trueMaxTitle')}</span><br><span data-i18n="views.home.heroJourney.trueMaxDesc">${translate('views.home.heroJourney.trueMaxDesc')}</span></div>
            <button class="th-limit-reveal-btn btn-active" id="home-hj-hide-btn" data-i18n="views.home.heroJourney.hideTrack">${translate('views.home.heroJourney.hideTrack')}</button>
        `;
    } else {
        blockCard.className = 'th-limit-block-card';

        const previewBtnI18n = !revealBeyondTH ? 'views.home.heroJourney.preview' : 'views.home.heroJourney.closePreview';
        const previewBtnText = translate(previewBtnI18n);
        const previewBtnClass = !revealBeyondTH ? 'th-limit-reveal-btn' : 'th-limit-reveal-btn btn-active';
        const previewBtnHtml = `<button class="${previewBtnClass}" id="home-hj-reveal-btn" data-i18n="${previewBtnI18n}">${previewBtnText}</button>`;

        const limitTextI18n = !revealBeyondTH ? 'views.home.heroJourney.thLimitLockedText' : 'views.home.heroJourney.thLimitUnlockedText';
        const limitTextArgs = !revealBeyondTH ? JSON.stringify({ th: nextTH, lvl: nextTHStartLvl }) : JSON.stringify({ th: nextTH });
        const limitText = translate(limitTextI18n, !revealBeyondTH ? { th: nextTH, lvl: nextTHStartLvl } : { th: nextTH });

        if (isGuest) {
            const hideBtnHtml = `<button class="th-limit-reveal-btn btn-active" id="home-hj-hide-btn" data-i18n="views.home.heroJourney.hideTrack">${translate('views.home.heroJourney.hideTrack')}</button>`;
            blockCard.innerHTML = `
                <orecalc-assets-image src="assets/th/th${nextTH}.png" alt="TH${nextTH}" class="th-limit-img"></orecalc-assets-image>
                <div class="th-limit-text" data-i18n="${limitTextI18n}" data-i18n-args='${limitTextArgs}'>${limitText}</div>
                <div class="th-limit-buttons-group">
                    ${previewBtnHtml}
                    ${hideBtnHtml}
                </div>
            `;
        } else {
            blockCard.innerHTML = `
                <orecalc-assets-image src="assets/th/th${nextTH}.png" alt="TH${nextTH}" class="th-limit-img"></orecalc-assets-image>
                <div class="th-limit-text" data-i18n="${limitTextI18n}" data-i18n-args='${limitTextArgs}'>${limitText}</div>
                ${previewBtnHtml}
            `;
        }
    }

    return blockCard;
}
