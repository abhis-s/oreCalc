const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env if present
try {
    require('dotenv').config();
} catch (e) {
    // dotenv optional
}

const projectRoot = path.resolve(__dirname, '..');
const token = process.env.CROWDIN_PERSONAL_TOKEN || process.env.CROWDIN_PAT || process.env.PAM || process.env.PERSONAL_ACCESS_TOKEN;
const projectId = process.env.CROWDIN_PROJECT_ID || process.env.PROJECT_ID || process.env.CROWDIN_PROJECT || '828948';
const MIN_THRESHOLD = parseInt(process.env.CROWDIN_MIN_PERCENT || '90', 10);

console.log(`--- OreCalc Smart Crowdin Downloader (Threshold: ${MIN_THRESHOLD}%) ---\n`);

function getFallbackLanguages() {
    try {
        const languagesDataPath = path.join(projectRoot, 'js/data/languagesData.js');
        const langContent = fs.readFileSync(languagesDataPath, 'utf8');
        const matches = [...langContent.matchAll(/code:\s*'([^']+)'[^}]*enabled:\s*true/g)].map(m => m[1]);
        return matches.filter(l => l !== 'en');
    } catch (e) {
        return ['de', 'tr'];
    }
}

function fetchLanguagesAndDownload() {
    if (!token) {
        console.warn(`[WARN] CROWDIN_PERSONAL_TOKEN not found in env. Falling back to enabled languages in languagesData.js.`);
        const fallback = getFallbackLanguages();
        downloadLanguages(fallback);
        return;
    }

    const options = {
        hostname: 'api.crowdin.com',
        path: `/api/v2/projects/${projectId}/languages/progress?limit=50`,
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'OreCalc-Downloader'
        }
    };

    const req = https.get(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    throw new Error(`HTTP ${res.statusCode}: ${body}`);
                }
                const json = JSON.parse(body);
                const eligibleLangs = json.data
                    .map(item => ({
                        code: item.data.languageId,
                        name: item.data.language?.name || item.data.languageId,
                        progress: item.data.translationProgress
                    }))
                    .filter(item => item.progress >= MIN_THRESHOLD && item.code !== 'en');

                console.log('Crowdin Translation Progress:');
                console.table(json.data.map(item => ({
                    code: item.data.languageId,
                    progress: `${item.data.translationProgress}%`,
                    status: item.data.translationProgress >= MIN_THRESHOLD ? 'ELIGIBLE' : 'SKIPPED'
                })));

                const langCodes = eligibleLangs.map(l => l.code);
                if (langCodes.length === 0) {
                    console.log(`[INFO] No languages meet the ${MIN_THRESHOLD}% completion threshold.`);
                    return;
                }

                downloadLanguages(langCodes);
            } catch (err) {
                console.warn(`[WARN] Failed to query Crowdin API progress: ${err.message}. Falling back to enabled languages.`);
                downloadLanguages(getFallbackLanguages());
            }
        });
    });

    req.on('error', (err) => {
        console.warn(`[WARN] Network error contacting Crowdin API: ${err.message}. Falling back to enabled languages.`);
        downloadLanguages(getFallbackLanguages());
    });
}

function downloadLanguages(langCodes) {
    console.log(`\n[OK] Downloading translations for eligible languages: ${langCodes.join(', ')}`);
    const langFlags = langCodes.map(c => `-l ${c}`).join(' ');
    const cmd = `npx @crowdin/cli download ${langFlags}`;
    
    try {
        execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
        sanitizeDownloadedTranslations();
        console.log('\n[SUCCESS] Translations downloaded and updated successfully.');
    } catch (err) {
        console.error(`\n[ERROR] Failed to run Crowdin CLI download command: ${err.message}`);
        process.exit(1);
    }
}

function sanitizeDownloadedTranslations() {
    const i18nDir = path.join(projectRoot, 'js/i18n');
    const enPath = path.join(i18nDir, 'en.json');
    if (!fs.existsSync(enPath)) return;

    let enFlat = {};
    try {
        enFlat = flattenObj(JSON.parse(fs.readFileSync(enPath, 'utf8')));
    } catch (e) {
        return;
    }

    const trPath = path.join(i18nDir, 'tr.json');
    if (fs.existsSync(trPath)) {
        let content = fs.readFileSync(trPath, 'utf8');
        let modified = false;

        if (content.includes('"{sayı} Yeşil Taş"')) {
            content = content.replace('"{sayı} Yeşil Taş"', '"{count} Yeşil Taş"');
            modified = true;
        }

        if (content.includes('"{itemName} cevheri beklerken {itemName} ürününü tamamlayın.')) {
            content = content.replace(
                '"{itemName} cevheri beklerken {itemName} ürününü tamamlayın. Planınızda herhangi bir gecikme olmayacak."',
                '"{itemName} cevherlerini beklerken {itemNames} yükseltmesini tamamlayın. Planınızda herhangi bir gecikme olmayacak."'
            );
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(trPath, content, 'utf8');
            console.log('[OK] Sanitized downloaded tr.json placeholder variables.');
        }
    }

    // Strip untranslated English fallback strings from downloaded locale JSON files
    const localeFiles = fs.readdirSync(i18nDir).filter(f => f.endsWith('.json') && f !== 'en.json');
    for (const file of localeFiles) {
        const filePath = path.join(i18nDir, file);
        let data;
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            continue;
        }

        let strippedCount = 0;
        function pruneUntranslated(obj, prefix = '') {
            for (const key in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    pruneUntranslated(obj[key], fullKey);
                    if (Object.keys(obj[key]).length === 0) {
                        delete obj[key];
                    }
                } else if (typeof obj[key] === 'string') {
                    const val = obj[key];
                    const enVal = enFlat[fullKey];
                    // Exclude genuine proper nouns, brand names, and short strings (< 15 chars) that are legitimately identical across languages
                    const allowedIdenticalKeys = [
                        'settings.github',
                        'settings.buyMeACoffee',
                        'settings.options.emailPlaceholder'
                    ];

                    const isLanguageName = fullKey.startsWith('settings.languages.');
                    const isLongString = val.length >= 15;
                    const isAllowedBrand = allowedIdenticalKeys.some(k => fullKey.includes(k));
                    // Strings with only placeholders and symbols/punctuation (e.g. "{equipmentName} (#{step})") are structural templates, not English words
                    const isPurePlaceholderFormat = val.replace(/\{[^{}]+\}/g, '').replace(/[^a-zA-Z]/g, '').length === 0;

                    // Strip Crowdin In-Context / Pseudo-localization strings (e.g. "crwdns573:0...")
                    if (val.includes('crwdns') || val.includes('crwdne')) {
                        delete obj[key];
                        strippedCount++;
                    }
                    // Strip if value is identical to English source text AND (it's >= 15 chars OR a language name key) AND not an allowed brand term or placeholder format
                    else if (enVal && val === enVal && (isLongString || isLanguageName) && !isAllowedBrand && !isPurePlaceholderFormat) {
                        delete obj[key];
                        strippedCount++;
                    }
                }
            }
        }

        pruneUntranslated(data);
        if (strippedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
            console.log(`[CLEAN] Stripped ${strippedCount} untranslated English fallback string(s) from ${file}`);
        }
    }
}

function flattenObj(obj, prefix = '') {
    let res = {};
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(res, flattenObj(obj[key], fullKey));
        } else {
            res[fullKey] = obj[key];
        }
    }
    return res;
}

fetchLanguagesAndDownload();
