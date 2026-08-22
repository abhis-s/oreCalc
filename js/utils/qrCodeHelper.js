/**
 * js/utils/qrCodeHelper.js
 * Utility helper for standardizing QR code rendering and device sync URLs.
 */

/**
 * Renders a styled sync QR Code into the specified container element.
 *
 * @param {HTMLElement|null} container - Target DOM container element.
 * @param {string} userId - User's sync UUID.
 * @param {number} [size=250] - Pixel width/height of the generated QR canvas.
 * @returns {any|null} The QRCodeStyling instance or null if invalid container/userId.
 */
export function renderSyncQRCode(container, userId, size = 250) {
    if (!container || !userId || typeof QRCodeStyling === 'undefined') return null;

    container.innerHTML = '';
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    const data = `${origin}?userId=${encodeURIComponent(userId)}`;
    const textPrimaryColor = (typeof getComputedStyle !== 'undefined' && typeof document !== 'undefined' && document.body)
        ? getComputedStyle(document.body).getPropertyValue('--text-primary').trim()
        : '';

    const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        data: data,
        image: 'assets/app_icon_small.png',
        dotsOptions: {
            color: textPrimaryColor || '#000000',
            type: 'rounded'
        },
        backgroundOptions: {
            color: 'transparent'
        },
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: Math.round(size * 0.03)
        },
        cornersSquareOptions: {
            type: 'extra-rounded',
            color: textPrimaryColor || '#000000'
        },
        cornersDotOptions: {
            type: 'dot',
            color: textPrimaryColor || '#000000'
        }
    });

    qrCode.append(container);
    return qrCode;
}
