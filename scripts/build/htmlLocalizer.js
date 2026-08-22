const fs = require('fs');
const path = require('path');

const localesMap = {
    en: 'en_US',
    de: 'de_DE',
    tr: 'tr_TR',
    cs: 'cs_CZ',
    da: 'da_DK',
    nl: 'nl_NL',
    fi: 'fi_FI',
    fr: 'fr_FR',
    el: 'el_GR',
    he: 'he_IL',
    hu: 'hu_HU',
    it: 'it_IT',
    ja: 'ja_JP',
    ko: 'ko_KR',
    no: 'nb_NO',
    nb: 'nb_NO',
    pl: 'pl_PL',
    'pt-PT': 'pt_PT',
    'pt-BR': 'pt_BR',
    ro: 'ro_RO',
    ru: 'ru_RU',
    sr: 'sr_RS',
    'es-ES': 'es_ES',
    'sv-SE': 'sv_SE',
    uk: 'uk_UA',
    vi: 'vi_VN',
    zh: 'zh_CN',
    'zh-CN': 'zh_CN',
    'zh-TW': 'zh_TW'
};

function getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

function resolveTranslation(translations, key, lang, getDynamicTranslationArgs) {
    let val = getNestedValue(translations, key);
    if (typeof val !== 'string') return null;

    if (getDynamicTranslationArgs) {
        const dynamicArgs = getDynamicTranslationArgs(key, lang, (k) => getNestedValue(translations, k) || '');
        if (dynamicArgs && Object.keys(dynamicArgs).length > 0) {
            for (const [paramKey, paramVal] of Object.entries(dynamicArgs)) {
                val = val.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramVal);
            }
        }
    }
    return val;
}

function injectOrReplaceAttribute(tagHtml, attrName, attrValue) {
    const escapedValue = attrValue.replace(/"/g, '&quot;');
    const attrRegex = new RegExp(`(?<!-)\\b${attrName}="[^"]*"`, 'i');
    if (attrRegex.test(tagHtml)) {
        return tagHtml.replace(attrRegex, `${attrName}="${escapedValue}"`);
    }
    if (tagHtml.endsWith('/>')) {
        return tagHtml.slice(0, -2) + ` ${attrName}="${escapedValue}"/>`;
    }
    return tagHtml.slice(0, -1) + ` ${attrName}="${escapedValue}">`;
}

/**
 * Compiles localized HTML with injected hreflang tags, OpenGraph metadata,
 * title/description tags, and pre-rendered data-i18n attributes.
 *
 * @param {string} baseHtml - The raw compiled base HTML string.
 * @param {string} lang - Language code ('en', 'de', etc.).
 * @param {string[]} supportedLanguages - List of enabled language codes.
 * @param {boolean} [isRoot=false] - Whether this is the root route.
 * @param {Function} [getDynamicTranslationArgs] - Dynamic translation args resolver.
 * @param {string} [projectRoot=process.cwd()] - Project root path.
 * @returns {string} Fully localized HTML string.
 */
function generateLocalizedHtml(baseHtml, lang, supportedLanguages, isRoot = false, getDynamicTranslationArgs = null, projectRoot = process.cwd()) {
    const i18nFilePath = path.join(projectRoot, `js/i18n/${lang}.json`);
    if (!fs.existsSync(i18nFilePath)) {
        return baseHtml;
    }
    const translations = JSON.parse(fs.readFileSync(i18nFilePath, 'utf8'));
    const title = translations.app?.title || 'Clash of Clans Ore Calculator & Equipment Planner | OreCalc';
    const description = translations.app?.description || '';
    const locale = localesMap[lang] || `${lang}_${lang.toUpperCase()}`;
    const url = isRoot ? 'https://orecalc.tech/' : `https://orecalc.tech/${lang}/`;

    let html = baseHtml;
    html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`);
    html = html.replace(/<title[^>]*>.*?<\/title>/s, `<title data-i18n="app.title">${title}</title>`);
    html = html.replace(/<meta name="description"\s+content="[^"]*">/s, `<meta name="description" content="${description}">`);
    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);

    const hreflangTags = supportedLanguages.map(l =>
        `<link rel="alternate" hreflang="${l}" href="https://orecalc.tech/${l === 'en' ? '' : l + '/'}" />`
    ).concat(['<link rel="alternate" hreflang="x-default" href="https://orecalc.tech/" />']).join('\n    ');
    html = html.replace(/(<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*)+/g, `${hreflangTags}\n    `);
    html = html.replace(/<meta property="og:title" content="[^"]*">/g, `<meta property="og:title" content="${title}">`);
    html = html.replace(/<meta property="og:description"\s+content="[^"]*">/g, `<meta property="og:description" content="${description}">`);
    html = html.replace(/<meta property="og:url" content="[^"]*">/g, `<meta property="og:url" content="${url}">`);
    if (html.includes('<meta property="og:locale"')) {
        html = html.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${locale}">`);
    } else {
        html = html.replace(/<meta property="og:type" content="website">/, `<meta property="og:type" content="website">\n    <meta property="og:locale" content="${locale}">`);
    }
    html = html.replace(/<meta property="twitter:title" content="[^"]*">/g, `<meta property="twitter:title" content="${title}">`);
    html = html.replace(/<meta property="twitter:description"\s+content="[^"]*">/g, `<meta property="twitter:description" content="${description}">`);
    html = html.replace(/<meta property="twitter:url" content="[^"]*">/g, `<meta property="twitter:url" content="${url}">`);
    html = html.replace(/"description": "[^"]*"/, `"description": "${description.replace(/"/g, '\\"')}"`);
    html = html.replace(/"url": "[^"]*"/, `"url": "${url}"`);

    // Pre-render static body elements marked with data-i18n
    html = html.replace(/<([a-z1-6]+)([^>]*?)\s+data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tagName, attrsBefore, key, attrsAfter) => {
        const val = resolveTranslation(translations, key, lang, getDynamicTranslationArgs);
        if (val !== null && val.trim()) {
            return `<${tagName}${attrsBefore} data-i18n="${key}"${attrsAfter}>${val}</${tagName}>`;
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-placeholder="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang, getDynamicTranslationArgs);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'placeholder', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-title="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang, getDynamicTranslationArgs);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'title', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-aria-label="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang, getDynamicTranslationArgs);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'aria-label', val);
        }
        return match;
    });

    html = html.replace(/<([a-z1-6]+)([^>]*?\s+data-i18n-alt="([^"]+)"[^>]*)>/gi, (match, tagName, allAttrs, key) => {
        const val = resolveTranslation(translations, key, lang, getDynamicTranslationArgs);
        if (val !== null) {
            return injectOrReplaceAttribute(match, 'alt', val);
        }
        return match;
    });

    return html;
}

module.exports = {
    generateLocalizedHtml,
    localesMap
};
