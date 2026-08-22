import { licensesData } from '../../data/licensesData.js';
import { translate } from '../../i18n/translator.js';

import { EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_TERMS, state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

import { dom } from '../../dom/domElements.js';

/**
 * Opens the Open Source Licenses legal dialog and renders license packages.
 */
export function openLicensesModal() {
    const modal = document.getElementById('licenses-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const closeHeaderBtn = document.getElementById('close-licenses-header-btn');
    const closeBtn = document.getElementById('close-licenses-modal-btn');
    const container = document.getElementById('licenses-container');

    const closeModal = () => {
        closeModalAnimated(modal);
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (container) {
        container.innerHTML = '';
        licensesData.forEach(item => {
            const details = document.createElement('details');
            const summary = document.createElement('summary');

            const titleSpan = document.createElement('span');
            titleSpan.className = 'license-title';
            titleSpan.textContent = item.name;
            summary.appendChild(titleSpan);

            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'license-badge';
            badgeSpan.textContent = item.license;
            summary.appendChild(badgeSpan);

            details.appendChild(summary);

            const detailsBody = document.createElement('div');
            detailsBody.className = 'details-body';

            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta-row';

            const authorSpan = document.createElement('span');
            authorSpan.innerHTML = `<strong>${translate('views.settings.author')}:</strong> ${item.copyright}`;
            metaDiv.appendChild(authorSpan);

            const link = document.createElement('a');
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'license-link';

            let text = translate('views.settings.sourceLink');
            text = text.replace(' ->', '').replace(' \u2192', '');

            const linkText = document.createElement('span');
            linkText.textContent = text;
            link.appendChild(linkText);

            const svgIcon = document.createElement('orecalc-assets-svg');
            svgIcon.setAttribute('name', 'open-in-new');
            link.appendChild(svgIcon);

            metaDiv.appendChild(link);
            detailsBody.appendChild(metaDiv);

            const pre = document.createElement('pre');
            pre.className = 'license-text';
            pre.textContent = translate('views.settings.loadingLicense');
            detailsBody.appendChild(pre);

            let isLoaded = false;
            details.addEventListener('toggle', () => {
                if (details.open) {
                    const allDetails = container.querySelectorAll('details');
                    allDetails.forEach(d => {
                        if (d !== details && d.open) {
                            d.open = false;
                        }
                    });

                    setTimeout(() => {
                        if (details.open) {
                            const containerTop = container.getBoundingClientRect().top;
                            const detailsTop = details.getBoundingClientRect().top;
                            const scrollOffset = detailsTop - containerTop + container.scrollTop - 5;
                            container.scrollTo({
                                top: scrollOffset,
                                behavior: 'smooth'
                            });
                        }
                    }, 80);

                    if (!isLoaded) {
                        fetch(item.file)
                            .then(response => {
                                if (!response.ok) throw new Error('Network response was not ok');
                                return response.text();
                            })
                            .then(text => {
                                pre.textContent = text;
                                isLoaded = true;
                            })
                            .catch(err => {
                                pre.textContent = `${translate('views.settings.errorLoadingLicense')}\n\n${item.licenseUrl ? 'Please view it here: ' + item.licenseUrl : ''}`;
                                console.error('Error fetching license:', err);
                            });
                    }
                }
            });

            details.appendChild(detailsBody);
            container.appendChild(details);
        });
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

/**
 * Opens the Privacy Policy modal dialog and handles user consent timestamps.
 */
export function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
    const needsConsent = !privacyTimestamp || privacyTimestamp < EFFECTIVE_DATE_PRIVACY;

    const closeHeaderBtn = document.getElementById('close-privacy-header-btn');
    const closeBtn = document.getElementById('close-privacy-modal-btn');
    const themeBtn = document.getElementById('privacy-theme-toggle-btn');
    /** @type {HTMLElement|any} */
    const iframe = document.getElementById('privacy-policy-iframe');
    const externalBtn = document.getElementById('privacy-open-external-btn');
    const translateBtn = document.getElementById('privacy-translate-btn');

    const SUPPORTED_LEGAL_LANGS = ['de'];
    const currentLang = state.uiSettings?.language || 'en';
    const hasTranslation = currentLang !== 'en' && SUPPORTED_LEGAL_LANGS.includes(currentLang);
    let showingEnglish = !hasTranslation;
    const initialUrl = hasTranslation ? `/${currentLang}/privacy/` : '/privacy/';

    if (translateBtn) {
        if (!hasTranslation) {
            translateBtn.style.display = 'none';
        } else {
            translateBtn.style.display = 'inline-flex';
            translateBtn.onclick = (e) => {
                e.preventDefault();
                showingEnglish = !showingEnglish;
                let currentTheme = 'dark';
                if (iframe && iframe.contentDocument) {
                    try {
                        currentTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || state.uiSettings?.theme || 'dark';
                    } catch (err) {
                        currentTheme = state.uiSettings?.theme || 'dark';
                    }
                } else {
                    currentTheme = state.uiSettings?.theme || 'dark';
                }
                const targetUrl = showingEnglish ? '/privacy/' : `/${currentLang}/privacy/`;
                if (iframe) {
                    iframe.src = `${targetUrl}?theme=${currentTheme}`;
                }
                if (externalBtn) {
                    externalBtn.href = targetUrl;
                }
            };
        }
    }

    const updateThemeBtnIcon = (currentTheme) => {
        if (themeBtn) {
            const svgIcon = themeBtn.querySelector('orecalc-assets-svg');
            if (svgIcon) {
                if (currentTheme === 'light') {
                    svgIcon.setAttribute('name', 'dark-mode');
                    svgIcon.setAttribute('class', 'icon-dark');
                } else {
                    svgIcon.setAttribute('name', 'light-mode');
                    svgIcon.setAttribute('class', 'icon-light');
                }
            }
        }
    };

    const closeModal = () => {
        closeModalAnimated(modal);
        modal.classList.remove('modal-top');
    };

    const handleAccept = () => {
        handleStateUpdate(() => {
            if (!state.uiSettings.uiTimestamps) {
                state.uiSettings.uiTimestamps = {};
            }
            state.uiSettings.uiTimestamps.privacy = Date.now();
        }, true);
        closeModal();
    };

    const handleDecline = () => {
        closeModal();
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            if (needsConsent) {
                handleDecline();
            } else {
                closeModal();
            }
        };
    }

    if (closeBtn) {
        closeBtn.className = 'reject-button';
        if (needsConsent) {
            closeBtn.textContent = translate('actions.cancel');
            closeBtn.setAttribute('data-i18n', 'actions.cancel');
            closeBtn.onclick = (e) => {
                e.preventDefault();
                handleDecline();
            };
        } else {
            closeBtn.textContent = translate('actions.close');
            closeBtn.setAttribute('data-i18n', 'actions.close');
            closeBtn.onclick = (e) => {
                e.preventDefault();
                closeModal();
            };
        }
    }

    let acceptBtn = document.getElementById('accept-privacy-modal-btn') || document.getElementById('privacy-accept-btn');
    if (needsConsent) {
        if (!acceptBtn && closeBtn && closeBtn.parentNode) {
            acceptBtn = document.createElement('button');
            acceptBtn.id = 'accept-privacy-modal-btn';
            acceptBtn.className = 'accept-button';
            acceptBtn.textContent = translate('actions.accept');
            acceptBtn.setAttribute('data-i18n', 'actions.accept');
            closeBtn.parentNode.insertBefore(acceptBtn, closeBtn.nextSibling);
        }
        if (acceptBtn) {
            acceptBtn.className = 'accept-button';
            acceptBtn.style.display = 'inline-flex';
            acceptBtn.textContent = translate('actions.accept');
            acceptBtn.setAttribute('data-i18n', 'actions.accept');
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                handleAccept();
            };
        }
    } else {
        if (acceptBtn) {
            acceptBtn.style.display = 'none';
        }
    }

    if (iframe) {
        const theme = state.uiSettings?.theme || 'dark';
        iframe.src = `${initialUrl}?theme=${theme}`;
        if (externalBtn) {
            externalBtn.href = initialUrl;
        }

        updateThemeBtnIcon(theme);

        if (themeBtn) {
            themeBtn.onclick = (e) => {
                e.preventDefault();
                let currentIframeTheme = 'dark';
                if (iframe.contentDocument) {
                    try {
                        currentIframeTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || 'dark';
                    } catch (err) {
                        currentIframeTheme = state.uiSettings?.theme || 'dark';
                    }
                }
                const newTheme = currentIframeTheme === 'light' ? 'dark' : 'light';

                if (iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({ type: 'theme-toggle', theme: newTheme }, '*');
                    } catch (err) {
                        iframe.src = `${initialUrl}?theme=${newTheme}`;
                    }
                }
                updateThemeBtnIcon(newTheme);
            };
        }
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}

/**
 * Opens the Terms of Use modal dialog and handles user agreement consent timestamps.
 */
export function openTermsOfUseModal() {
    const modal = document.getElementById('terms-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const tosTimestamp = state.uiSettings?.uiTimestamps?.tos ?? state.uiSettings?.uiTimestamps?.terms;
    const needsConsent = !tosTimestamp || tosTimestamp < EFFECTIVE_DATE_TERMS;

    const closeHeaderBtn = document.getElementById('close-terms-header-btn');
    const closeBtn = document.getElementById('close-terms-modal-btn');
    const themeBtn = document.getElementById('terms-theme-toggle-btn');
    /** @type {HTMLElement|any} */
    const iframe = document.getElementById('terms-policy-iframe') || document.getElementById('terms-iframe');
    const externalBtn = document.getElementById('terms-open-external-btn');
    const translateBtn = document.getElementById('terms-translate-btn');

    const SUPPORTED_LEGAL_LANGS = ['de'];
    const currentLang = state.uiSettings?.language || 'en';
    const hasTranslation = currentLang !== 'en' && SUPPORTED_LEGAL_LANGS.includes(currentLang);
    let showingEnglish = !hasTranslation;
    const initialUrl = hasTranslation ? `/${currentLang}/terms/` : '/terms/';

    if (translateBtn) {
        if (!hasTranslation) {
            translateBtn.style.display = 'none';
        } else {
            translateBtn.style.display = 'inline-flex';
            translateBtn.onclick = (e) => {
                e.preventDefault();
                showingEnglish = !showingEnglish;
                let currentTheme = 'dark';
                if (iframe && iframe.contentDocument) {
                    try {
                        currentTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || state.uiSettings?.theme || 'dark';
                    } catch (err) {
                        currentTheme = state.uiSettings?.theme || 'dark';
                    }
                } else {
                    currentTheme = state.uiSettings?.theme || 'dark';
                }
                const targetUrl = showingEnglish ? '/terms/' : `/${currentLang}/terms/`;
                if (iframe) {
                    iframe.src = `${targetUrl}?theme=${currentTheme}`;
                }
                if (externalBtn) {
                    externalBtn.href = targetUrl;
                }
            };
        }
    }

    const updateThemeBtnIcon = (currentTheme) => {
        if (themeBtn) {
            const svgIcon = themeBtn.querySelector('orecalc-assets-svg');
            if (svgIcon) {
                if (currentTheme === 'light') {
                    svgIcon.setAttribute('name', 'dark-mode');
                    svgIcon.setAttribute('class', 'icon-dark');
                } else {
                    svgIcon.setAttribute('name', 'light-mode');
                    svgIcon.setAttribute('class', 'icon-light');
                }
            }
        }
    };

    const closeModal = () => {
        closeModalAnimated(modal);
        modal.classList.remove('modal-top');
        document.dispatchEvent(new CustomEvent('terms:close'));
    };

    const handleAccept = () => {
        handleStateUpdate(() => {
            if (!state.uiSettings.uiTimestamps) {
                state.uiSettings.uiTimestamps = {};
            }
            state.uiSettings.uiTimestamps.tos = Date.now();
            if ('terms' in state.uiSettings.uiTimestamps) {
                delete state.uiSettings.uiTimestamps.terms;
            }
        }, true);
        closeModal();
    };

    const handleDecline = () => {
        closeModal();
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            if (needsConsent) {
                handleDecline();
            } else {
                closeModal();
            }
        };
    }

    if (closeBtn) {
        closeBtn.className = 'reject-button';
        if (needsConsent) {
            closeBtn.textContent = translate('actions.cancel');
            closeBtn.setAttribute('data-i18n', 'actions.cancel');
            closeBtn.onclick = (e) => {
                e.preventDefault();
                handleDecline();
            };
        } else {
            closeBtn.textContent = translate('actions.close');
            closeBtn.setAttribute('data-i18n', 'actions.close');
            closeBtn.onclick = (e) => {
                e.preventDefault();
                closeModal();
            };
        }
    }

    let acceptBtn = document.getElementById('accept-terms-modal-btn') || document.getElementById('terms-accept-btn');
    if (needsConsent) {
        if (!acceptBtn && closeBtn && closeBtn.parentNode) {
            acceptBtn = document.createElement('button');
            acceptBtn.id = 'accept-terms-modal-btn';
            acceptBtn.className = 'accept-button';
            acceptBtn.textContent = translate('actions.accept');
            acceptBtn.setAttribute('data-i18n', 'actions.accept');
            closeBtn.parentNode.insertBefore(acceptBtn, closeBtn.nextSibling);
        }
        if (acceptBtn) {
            acceptBtn.className = 'accept-button';
            acceptBtn.style.display = 'inline-flex';
            acceptBtn.textContent = translate('actions.accept');
            acceptBtn.setAttribute('data-i18n', 'actions.accept');
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                handleAccept();
            };
        }
    } else {
        if (acceptBtn) {
            acceptBtn.style.display = 'none';
        }
    }

    if (iframe) {
        const theme = state.uiSettings?.theme || 'dark';
        iframe.src = `${initialUrl}?theme=${theme}`;
        if (externalBtn) {
            externalBtn.href = initialUrl;
        }

        updateThemeBtnIcon(theme);

        if (themeBtn) {
            themeBtn.onclick = (e) => {
                e.preventDefault();
                let currentIframeTheme = 'dark';
                if (iframe.contentDocument) {
                    try {
                        currentIframeTheme = iframe.contentDocument.documentElement.getAttribute('data-theme') || 'dark';
                    } catch (err) {
                        currentIframeTheme = state.uiSettings?.theme || 'dark';
                    }
                }
                const newTheme = currentIframeTheme === 'light' ? 'dark' : 'light';

                if (iframe.contentWindow) {
                    try {
                        iframe.contentWindow.postMessage({ type: 'theme-toggle', theme: newTheme }, '*');
                    } catch (err) {
                        iframe.src = `${initialUrl}?theme=${newTheme}`;
                    }
                }
                updateThemeBtnIcon(newTheme);
            };
        }
    }

    modal.classList.add('show');
    if (dom.overlay) dom.overlay.classList.add('show');
}
