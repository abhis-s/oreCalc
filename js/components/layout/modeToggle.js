import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializeModeToggle() {
    const modeToggleSwitch = dom.appSettings?.modeToggle?.switch;
    if (!modeToggleSwitch) return;

    modeToggleSwitch.addEventListener('click', () => {
        const currentMode = state.uiSettings.mode;
        const newMode = currentMode === 'ease' ? 'tweak' : 'ease';
        
        handleStateUpdate(() => {
            state.uiSettings.mode = newMode;
        });
    });
}

export function renderModeToggle(uiSettings) {
    const modeToggleSwitch = dom.appSettings?.modeToggle?.switch;
    const easeLabel = dom.appSettings?.modeToggle?.easeLabel;
    const tweakLabel = dom.appSettings?.modeToggle?.tweakLabel;
    if (!modeToggleSwitch || !easeLabel || !tweakLabel) return;

    const isTweakMode = uiSettings.mode === 'tweak';
    modeToggleSwitch.classList.toggle('active', isTweakMode);
    easeLabel.classList.toggle('active-mode-label', !isTweakMode);
    tweakLabel.classList.toggle('active-mode-label', isTweakMode);
}