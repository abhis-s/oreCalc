import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderSyncQRCode } from '../../js/utils/qrCodeHelper.js';

describe('QR Code Helper & Absolute Asset Resolution Suite', () => {
    let originalQRCodeStyling;
    let originalWindow;
    let originalDocument;
    let originalGetComputedStyle;

    beforeEach(() => {
        originalQRCodeStyling = globalThis.QRCodeStyling;
        originalWindow = globalThis.window;
        originalDocument = globalThis.document;
        originalGetComputedStyle = globalThis.getComputedStyle;
    });

    afterEach(() => {
        globalThis.QRCodeStyling = originalQRCodeStyling;
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.getComputedStyle = originalGetComputedStyle;
    });

    it('returns null if container or userId is missing', () => {
        const dummyContainer = { innerHTML: '' };
        assert.equal(renderSyncQRCode(null, 'test-uuid'), null);
        assert.equal(renderSyncQRCode(dummyContainer, ''), null);
        assert.equal(renderSyncQRCode(dummyContainer, null), null);
    });

    it('returns null if QRCodeStyling is undefined', () => {
        delete globalThis.QRCodeStyling;
        const dummyContainer = { innerHTML: 'existing' };
        const result = renderSyncQRCode(dummyContainer, 'test-uuid');
        assert.equal(result, null);
    });

    it('instantiates QRCodeStyling with root-absolute image path and appends to container', () => {
        let capturedOptions = null;
        let appendTarget = null;

        class MockQRCodeStyling {
            constructor(options) {
                capturedOptions = options;
            }

            append(target) {
                appendTarget = target;
            }
        }

        globalThis.QRCodeStyling = MockQRCodeStyling;
        globalThis.window = {
            location: {
                origin: 'https://clashcalc.com'
            }
        };
        globalThis.document = {
            body: {}
        };
        globalThis.getComputedStyle = () => ({
            getPropertyValue: () => '#ffffff'
        });

        const container = { innerHTML: 'previous-content' };
        const userId = '12345678-abcd-ef01-2345-6789abcdef01';

        const result = renderSyncQRCode(container, userId, 280);

        assert.ok(result instanceof MockQRCodeStyling);
        assert.equal(container.innerHTML, '');
        assert.equal(appendTarget, container);

        assert.ok(capturedOptions);
        assert.equal(capturedOptions.width, 280);
        assert.equal(capturedOptions.height, 280);
        assert.equal(capturedOptions.data, 'https://clashcalc.com?userId=12345678-abcd-ef01-2345-6789abcdef01');
        assert.equal(capturedOptions.image, '/assets/favicon.png', 'Must use root-absolute /assets/favicon.png to prevent 404 on sub-routes');
        assert.equal(capturedOptions.dotsOptions.color, '#ffffff');
    });

    it('uses fallback values when window or getComputedStyle is absent', () => {
        let capturedOptions = null;

        class MockQRCodeStyling {
            constructor(options) {
                capturedOptions = options;
            }

            append() {}
        }

        globalThis.QRCodeStyling = MockQRCodeStyling;
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.getComputedStyle;

        const container = { innerHTML: '' };
        renderSyncQRCode(container, 'user-id-xyz');

        assert.ok(capturedOptions);
        assert.equal(capturedOptions.width, 250);
        assert.equal(capturedOptions.height, 250);
        assert.equal(capturedOptions.data, '?userId=user-id-xyz');
        assert.equal(capturedOptions.image, '/assets/favicon.png');
        assert.equal(capturedOptions.dotsOptions.color, '#000000');
    });
});
