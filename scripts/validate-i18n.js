const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const i18nDir = path.join(projectRoot, 'js/i18n');
const enFilePath = path.join(i18nDir, 'en.json');
const languagesDataPath = path.join(projectRoot, 'js/data/languagesData.js');

console.log('--- OreCalc Comprehensive i18n & Translation Linter ---\n');

if (!fs.existsSync(enFilePath)) {
    console.error('[ERROR] Reference translation file en.json missing!');
    process.exit(1);
}

let enData;
try {
    enData = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
} catch (err) {
    console.error(`[ERROR] Failed to parse en.json: ${err.message}`);
    process.exit(1);
}

// 1. Flatten key dictionary
function getAllKeys(obj, prefix = '') {
    let keys = {};
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(keys, getAllKeys(obj[key], fullKey));
        } else {
            keys[fullKey] = obj[key];
        }
    }
    return keys;
}

function extractPlaceholders(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{(\w+)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
}

function extractHtmlTags(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/<\/?([a-z1-6]+)(?:\s+[^>]*)?>/gi);
    return matches ? matches.map(m => m.toLowerCase().replace(/\s+[^>]*>/, '>')) : [];
}

const enKeysMap = getAllKeys(enData);
const totalEnKeys = Object.keys(enKeysMap).length;
console.log(`[OK] Reference dictionary (en.json): ${totalEnKeys} keys loaded.\n`);

// 2. Scan codebase for missing keys (JS & HTML code usage)
console.log('--- Checking Codebase Translation Key References ---');
let missingInEnCount = 0;
const codeFiles = [];

function findCodeFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'scratch', '.git', '.vscode'].includes(entry.name)) continue;
            findCodeFiles(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
            codeFiles.push(fullPath);
        }
    }
}
findCodeFiles(projectRoot);

const usedKeysInCode = new Set();

for (const filePath of codeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        // Match translate('key.name') or translate("key.name")
        const translateMatches = line.matchAll(/translate\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
        for (const match of translateMatches) {
            const k = match[1];
            if (k !== 'key.name' && !k.endsWith('.')) {
                usedKeysInCode.add(k);
            }
        }
        
        // Match data-i18n="key.name"
        const dataI18nMatches = line.matchAll(/data-i18n=\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
        for (const match of dataI18nMatches) {
            const k = match[1];
            if (k !== 'key.name' && !k.endsWith('.')) {
                usedKeysInCode.add(k);
            }
        }
    }
}

for (const key of usedKeysInCode) {
    // Dynamic or concatenated keys can be skipped if they end with . or :
    if (key.endsWith('.') || key.includes('${') || key.includes('+')) continue;
    if (!(key in enKeysMap)) {
        console.warn(`[WARN] Codebase references key "${key}" which is MISSING from en.json`);
        missingInEnCount++;
    }
}

if (missingInEnCount === 0) {
    console.log(`[OK] All ${usedKeysInCode.size} static translation keys referenced in codebase exist in en.json.\n`);
} else {
    console.warn(`[WARN] Found ${missingInEnCount} translation key(s) used in code but missing from en.json.\n`);
}

// 3. Check enabled languages configuration
let enabledLangCodes = ['en', 'de', 'tr'];
try {
    if (fs.existsSync(languagesDataPath)) {
        const langContent = fs.readFileSync(languagesDataPath, 'utf8');
        const matches = [...langContent.matchAll(/code:\s*'([^']+)'[^}]*enabled:\s*true/g)].map(m => m[1]);
        if (matches.length > 0) enabledLangCodes = matches;
    }
} catch (e) {
    // fallback
}

// 4. Validate all translation files in js/i18n/
const files = fs.readdirSync(i18nDir).filter(file => file.endsWith('.json'));

let hasErrors = false;
const report = [];

for (const file of files) {
    const lang = path.basename(file, '.json');
    const filePath = path.join(i18nDir, file);

    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`[ERROR] ${file}: Invalid JSON syntax - ${err.message}`);
        hasErrors = true;
        continue;
    }

    if (lang === 'en') {
        report.push({
            lang,
            file,
            total: totalEnKeys,
            missing: 0,
            obsolete: 0,
            completion: '100.0%',
            status: 'REFERENCE'
        });
        continue;
    }

    const langKeysMap = getAllKeys(data);
    
    // Auto-clean 0% / empty translation files downloaded from Crowdin
    if (Object.keys(langKeysMap).length === 0) {
        fs.unlinkSync(filePath);
        console.log(`[CLEAN] Removed empty 0% translation file: ${file}`);
        continue;
    }
    let missingCount = 0;
    let obsoleteCount = 0;
    let placeholderErrors = 0;
    let htmlErrors = 0;

    // Check missing keys & placeholder / html tag consistency
    for (const [key, enValue] of Object.entries(enKeysMap)) {
        if (!(key in langKeysMap) || langKeysMap[key] === undefined || langKeysMap[key] === '') {
            missingCount++;
            continue;
        }

        const langValue = langKeysMap[key];
        
        // Placeholders check (e.g. {count}, {minutes})
        const enPlaceholders = extractPlaceholders(enValue);
        const langPlaceholders = extractPlaceholders(langValue);

        for (const ph of enPlaceholders) {
            if (!langPlaceholders.includes(ph)) {
                placeholderErrors++;
                console.error(`[ERROR] [${lang}] Missing required placeholder {${ph}} in key "${key}"`);
            }
        }

        for (const ph of langPlaceholders) {
            if (!enPlaceholders.includes(ph)) {
                placeholderErrors++;
                console.error(`[ERROR] [${lang}] Unexpected placeholder {${ph}} in key "${key}"`);
            }
        }

        // HTML tag check (e.g. <code>, <a>, <span>)
        const enTags = extractHtmlTags(enValue);
        const langTags = extractHtmlTags(langValue);

        if (enTags.length !== langTags.length) {
            htmlErrors++;
            console.warn(`[WARN] [${lang}] HTML tag count mismatch in key "${key}" (en: ${enTags.length}, ${lang}: ${langTags.length})`);
        }
    }

    // Check obsolete / leftover keys in translation file
    for (const key of Object.keys(langKeysMap)) {
        if (!(key in enKeysMap)) {
            obsoleteCount++;
            console.warn(`[WARN] [${lang}] Obsolete key "${key}" found in ${file} (deleted from en.json)`);
        }
    }

    const foundCount = totalEnKeys - missingCount;
    const completionPctNum = (foundCount / totalEnKeys) * 100;
    const completionPct = completionPctNum.toFixed(1) + '%';
    const isEnabled = enabledLangCodes.includes(lang);

    // Strict threshold: Enabled production languages must have >= 95% completion & 0 placeholder errors
    let status = isEnabled ? 'ENABLED (PROD)' : 'PENDING (DRAFT)';
    if (placeholderErrors > 0) {
        hasErrors = true;
        status += ' [PLACEHOLDER ERROR]';
    } else if (isEnabled && completionPctNum < 95.0) {
        hasErrors = true;
        console.error(`[ERROR] [${lang}] Enabled production language completion is ${completionPct} (below 95% threshold)`);
        status += ' [LOW COMPLETION]';
    }

    report.push({
        lang,
        file,
        total: totalEnKeys,
        missing: missingCount,
        obsolete: obsoleteCount,
        completion: completionPct,
        status
    });
}

console.log('\n--- Language Translation Quality Report ---');
console.table(report);

if (hasErrors) {
    console.error('\n[ERROR] i18n validation failed! Please fix placeholder errors or missing keys.');
    process.exit(1);
} else {
    console.log('\n[SUCCESS] All i18n translation files passed strict validation successfully.');
}
