/**
 * Settings Modals Aggregator
 * Re-exports legal, support, and utility modals.
 */

export {
    openLicensesModal,
    openPrivacyModal,
    openTermsOfUseModal
} from './settingsLegalModals.js';

export {
    formatInvoiceMonth,
    renderRunningCostsData,
    openRunningCostsModal
} from './settingsRunningCostsModal.js';

export {
    openBugReportModal
} from './settingsSupportModals.js';
