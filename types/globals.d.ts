/**
 * Ambient type declarations for OreCalc global environment and DOM extensions.
 */

declare global {
    interface Window {
        __ENV__?: {
            APP_VERSION?: string;
            API_BASE_URL?: string;
            [key: string]: any;
        };
        __APP_INITIALIZED__?: boolean;
        __APP_LOADED_STATUS__?: boolean;
        __APP_LOADED__?: any;
        __DOM_CONTENT_LOADED_REGISTERED__?: boolean;
        __FORCE_SYNC_RENDER__?: boolean;
        __WB__?: any;
        isAppStartingUp?: boolean;
        isTourPending?: boolean;
        isTourRunning?: boolean;
        sessionRandomAccent?: string | null;
        pendingChangelogContent?: any;
        pendingCommits?: any;
        resetApplication?: () => void;
        handleChunkError?: (error: any) => any;
        QRCodeStyling?: any;
        [key: string]: any;
    }

    const QRCodeStyling: any;
    const __ENV__: {
        APP_VERSION?: string;
        API_BASE_URL?: string;
        [key: string]: any;
    } | undefined;

    namespace Intl {
        interface Locale {
            weekInfo?: {
                firstDay?: number;
                minDays?: number;
                weekend?: number[];
            };
            getWeekInfo?: () => {
                firstDay?: number;
                minDays?: number;
                weekend?: number[];
            };
        }
    }

    interface DOMStringMap {
        [key: string]: any;
    }

    interface Node {
        [key: string]: any;
    }

    interface HTMLElement {
        __animationFrameId?: number | null;
        _currentNumericValue?: number;
        [key: string]: any;
    }

    interface Element {
        __animationFrameId?: number | null;
        _currentNumericValue?: number;
        [key: string]: any;
    }

    interface Navigator {
        sendBeacon(url: string | URL, data?: BodyInit | null): boolean;
        [key: string]: any;
    }

    interface EventTarget {
        [key: string]: any;
    }

    interface Event {
        [key: string]: any;
    }

    interface MouseEvent {
        [key: string]: any;
    }

    interface HTMLInputElement {
        [key: string]: any;
    }

    interface HTMLSelectElement {
        [key: string]: any;
    }

    interface HTMLIFrameElement {
        [key: string]: any;
    }
}

export {};
