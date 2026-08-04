export const languagesData = [
    // Currently Active Production Languages
    { code: 'en', locale: 'en-US', flag: '🇺🇸', nameI18n: 'settings.languages.english', fallbackName: 'English', nativeName: 'English', enabled: true },
    { code: 'de', locale: 'de-DE', flag: '🇩🇪', nameI18n: 'settings.languages.german', fallbackName: 'German', nativeName: 'Deutsch', enabled: true },
    { code: 'tr', locale: 'tr-TR', flag: '🇹🇷', nameI18n: 'settings.languages.turkish', fallbackName: 'Turkish', nativeName: 'Türkçe', enabled: true },
    { code: 'zh', locale: 'zh-CN', flag: '🇨🇳', nameI18n: 'settings.languages.chineseSimplified', fallbackName: 'Chinese (Simplified)', nativeName: '中文（简体）', enabled: false },

    // Additional Crowdin Target Languages (Set enabled: true when ready to release)
    { code: 'cs', locale: 'cs-CZ', flag: '🇨🇿', nameI18n: 'settings.languages.czech', fallbackName: 'Czech', nativeName: 'Čeština', enabled: false },
    { code: 'da', locale: 'da-DK', flag: '🇩🇰', nameI18n: 'settings.languages.danish', fallbackName: 'Danish', nativeName: 'Dansk', enabled: false },
    { code: 'el', locale: 'el-GR', flag: '🇬🇷', nameI18n: 'settings.languages.greek', fallbackName: 'Greek', nativeName: 'Ελληνικά', enabled: false },
    { code: 'es-ES', locale: 'es-ES', flag: '🇪🇸', nameI18n: 'settings.languages.spanish', fallbackName: 'Spanish', nativeName: 'Español', enabled: false },
    { code: 'fi', locale: 'fi-FI', flag: '🇫🇮', nameI18n: 'settings.languages.finnish', fallbackName: 'Finnish', nativeName: 'Suomi', enabled: false },
    { code: 'fr', locale: 'fr-FR', flag: '🇫🇷', nameI18n: 'settings.languages.french', fallbackName: 'French', nativeName: 'Français', enabled: false },
    { code: 'he', locale: 'he-IL', flag: '🇮🇱', nameI18n: 'settings.languages.hebrew', fallbackName: 'Hebrew', nativeName: 'עברית', enabled: false },
    { code: 'hu', locale: 'hu-HU', flag: '🇭🇺', nameI18n: 'settings.languages.hungarian', fallbackName: 'Hungarian', nativeName: 'Magyar', enabled: false },
    { code: 'it', locale: 'it-IT', flag: '🇮🇹', nameI18n: 'settings.languages.italian', fallbackName: 'Italian', nativeName: 'Italiano', enabled: false },
    { code: 'ja', locale: 'ja-JP', flag: '🇯🇵', nameI18n: 'settings.languages.japanese', fallbackName: 'Japanese', nativeName: '日本語', enabled: false },
    { code: 'ko', locale: 'ko-KR', flag: '🇰🇷', nameI18n: 'settings.languages.korean', fallbackName: 'Korean', nativeName: '한국어', enabled: false },
    { code: 'nl', locale: 'nl-NL', flag: '🇳🇱', nameI18n: 'settings.languages.dutch', fallbackName: 'Dutch', nativeName: 'Nederlands', enabled: false },
    { code: 'no', locale: 'nb-NO', flag: '🇳🇴', nameI18n: 'settings.languages.norwegian', fallbackName: 'Norwegian', nativeName: 'Norsk', enabled: false },
    { code: 'pl', locale: 'pl-PL', flag: '🇵🇱', nameI18n: 'settings.languages.polish', fallbackName: 'Polish', nativeName: 'Polski', enabled: false },
    { code: 'pt-BR', locale: 'pt-BR', flag: '🇧🇷', nameI18n: 'settings.languages.portugueseBR', fallbackName: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', enabled: false },
    { code: 'pt-PT', locale: 'pt-PT', flag: '🇵🇹', nameI18n: 'settings.languages.portuguese', fallbackName: 'Portuguese (Portugal)', nativeName: 'Português', enabled: false },
    { code: 'ro', locale: 'ro-RO', flag: '🇷🇴', nameI18n: 'settings.languages.romanian', fallbackName: 'Romanian', nativeName: 'Română', enabled: false },
    { code: 'ru', locale: 'ru-RU', flag: '🇷🇺', nameI18n: 'settings.languages.russian', fallbackName: 'Russian', nativeName: 'Русский', enabled: false },
    { code: 'sr', locale: 'sr-RS', flag: '🇷🇸', nameI18n: 'settings.languages.serbian', fallbackName: 'Serbian', nativeName: 'Српски', enabled: false },
    { code: 'sv-SE', locale: 'sv-SE', flag: '🇸🇪', nameI18n: 'settings.languages.swedish', fallbackName: 'Swedish', nativeName: 'Svenska', enabled: false },
    { code: 'uk', locale: 'uk-UA', flag: '🇺🇦', nameI18n: 'settings.languages.ukrainian', fallbackName: 'Ukrainian', nativeName: 'Українська', enabled: false },
    { code: 'vi', locale: 'vi-VN', flag: '🇻🇳', nameI18n: 'settings.languages.vietnamese', fallbackName: 'Vietnamese', nativeName: 'Tiếng Việt', enabled: false },
    { code: 'zh-TW', locale: 'zh-TW', flag: '🇹🇼', nameI18n: 'settings.languages.chineseTraditional', fallbackName: 'Chinese (Traditional)', nativeName: '中文（繁體）', enabled: false }
];

export const enabledLanguages = languagesData.filter(l => l.enabled);
export const SUPPORTED_LANGUAGES = enabledLanguages.map(l => l.code);

export function getLocale(langCode) {
    const found = languagesData.find(l => l.code === langCode);
    if (found?.locale) return found.locale;
    if (langCode && langCode.length === 2) {
        return `${langCode}-${langCode.toUpperCase()}`;
    }
    return 'en-US';
}

export function getWeekStart(langCode) {
    const localeStr = getLocale(langCode);
    try {
        const locale = new Intl.Locale(localeStr);
        const firstDay = locale.weekInfo?.firstDay || locale.getWeekInfo?.()?.firstDay;
        if (firstDay === 1) return 'monday';
        if (firstDay === 2) return 'tuesday';
        if (firstDay === 5) return 'friday';
        if (firstDay === 6) return 'saturday';
        if (firstDay === 7) return 'sunday';
    } catch (e) {
        // Fallback below
    }
    return langCode === 'en' ? 'sunday' : 'monday';
}

const validFanContentPolicySubpaths = new Set([
    'id', 'ms', 'de', 'es', 'fr', 'it', 'nl', 'no', 'pt', 'fi',
    'vi', 'tr', 'ru', 'ar', 'fa', 'th', 'ko', 'jp', 'cn', 'cnt'
]);

export function getFanContentPolicyUrl(langCode = 'en') {
    const overrideMap = {
        zh: 'cn',
        'zh-TW': 'cnt',
        ja: 'jp',
        'pt-BR': 'pt',
        'es-ES': 'es'
    };
    const subPath = overrideMap[langCode] || langCode;
    
    if (subPath && validFanContentPolicySubpaths.has(subPath)) {
        return `https://supercell.com/en/fan-content-policy/${subPath}/`;
    }
    
    return 'https://supercell.com/en/fan-content-policy/';
}

const validSupercellEventSubpaths = new Set([
    'de', 'en', 'es', 'fr', 'it', 'pt', 'kr', 'jp', 'zh-tc'
]);

export function getSupercellEventUrl(langCode = 'en') {
    const overrideMap = {
        zh: 'zh-tc',
        'zh-TW': 'zh-tc',
        ko: 'kr',
        ja: 'jp',
        'pt-BR': 'pt',
        'es-ES': 'es'
    };
    const subPath = overrideMap[langCode] || langCode;
    
    if (subPath && validSupercellEventSubpaths.has(subPath)) {
        return `https://event.supercell.com/clashofclans/${subPath}`;
    }
    
    return 'https://event.supercell.com/clashofclans/en';
}
