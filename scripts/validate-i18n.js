const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const i18nDir = path.join(projectRoot, 'js/i18n');
const enFilePath = path.join(i18nDir, 'en.json');
const languagesDataPath = path.join(projectRoot, 'js/data/languagesData.js');

function getAllKeys(obj, prefix = '') {
    let keys = {};
    for (const key in obj) {
        if (!Object.hasOwn(obj, key)) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(keys, getAllKeys(obj[key], fullKey));
        } else {
            keys[fullKey] = obj[key];
        }
    }
    return keys;
}

/**
 * Centrally documented allowlist of justified duplicate string values in en.json.
 * Any duplicate value in en.json must be explicitly registered here with
 * a clear linguistic, architectural, or domain justification.
 * @type {Record<string, string>}
 */
const ALLOWED_DUPLICATE_KEYS = {
    // 1. Linguistic: Verb action vs Completion status (Turkish: Tamam vs Tamamlandı; Chinese: 完成 vs 已完成)
    'actions.done': 'Linguistic: Action verb (Turkish: Tamam) vs time status (Turkish: Tamamlandı)',
    'time.done': 'Linguistic: Action verb (Turkish: Tamam) vs time status (Turkish: Tamamlandı)',

    // 2. Linguistic: Action button verb vs Changelog category badge (German: Beheben vs Fehlerbehebung)
    'actions.fix': 'Linguistic: Action button verb vs Changelog entry category badge',
    'views.changelog.type.fix': 'Linguistic: Action button verb vs Changelog entry category badge',

    // 3. Linguistic: Step navigation vs Temporal iteration (Chinese: 上一步 vs 上期)
    'actions.previous': 'Linguistic: Navigation step (Chinese: 上一步) vs seasonal pass iteration (Chinese: 上期)',
    'views.income.eventPass.previous': 'Linguistic: Navigation step (Chinese: 上一步) vs seasonal pass iteration (Chinese: 上期)',

    // 4-8. Architectural: Dynamic HTTP status code alias mappings in apiService.js
    'apiErrors.400': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.badRequest': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.403': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.accessDenied': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.404': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.notFound': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.429': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.tooManyRequests': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.503': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',
    'apiErrors.inMaintenance': 'Architectural: Numerical HTTP status alias for dynamic apiService.js fallback',

    // 9-11. Domain: Multiplayer league tier entity vs Tournament equipment modifier mode
    'entities.leagues.legendI': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',
    'views.equipment.modifiers.legend1': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',
    'entities.leagues.legendII': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',
    'views.equipment.modifiers.legend2': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',
    'entities.leagues.legendIII': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',
    'views.equipment.modifiers.legend3': 'Domain: Multiplayer league tier entity vs tournament equipment modifier mode',

    // 12. Context: Modal/Page title header vs Settings menu item
    'views.changelog.title': 'Context: Modal/Page title header vs About settings menu item',
    'views.settings.about.changelog': 'Context: Modal/Page title header vs About settings menu item',

    // 13. Linguistic: Substitute item reward vs Algorithmic fallback rule (German: Ersatz vs Zurückgreifen)
    'views.heroJourney.nodes.fallbackLabel': 'Linguistic: Substitute item reward (German: Ersatz) vs fallback calculation (German: Zurückgreifen)',
    'views.income.prospector.tips.fallback': 'Linguistic: Substitute item reward (German: Ersatz) vs fallback calculation (German: Zurückgreifen)',

    // 14. UI Context: Full card title vs Compact mobile shortcut pill
    'views.income.cwl.title': 'UI Context: Full card title vs compact mobile shortcut pill',
    'views.income.shortcuts.cwl': 'UI Context: Full card title vs compact mobile shortcut pill',

    // 15. UI Context: In-game currency entity name vs Trader shortcut pill
    'views.income.ores.gem': 'UI Context: In-game currency entity name vs Trader shortcut pill',
    'views.income.shortcuts.gemTrader': 'UI Context: In-game currency entity name vs Trader shortcut pill',

    // 16. UI Context: Compact shortcut pill vs Event table column header
    'views.income.shortcuts.eventTrader': 'UI Context: Compact shortcut pill vs Event table column header',
    'views.income.supercellEvents.tableEvent': 'UI Context: Compact shortcut pill vs Event table column header',

    // 17. Linguistic: Income revenue origin vs Source code repository link (Chinese: 来源 vs 源码)
    'views.income.source': 'Linguistic: Income revenue stream (Chinese: 来源) vs Source code repository link (Chinese: 源码)',
    'views.settings.about.sourceLink': 'Linguistic: Income revenue stream (Chinese: 来源) vs Source code repository link (Chinese: 源码)'
};

/**
 * Detects unauthorized duplicate string values or accidental casing discrepancies in en.json.
 * @param {Record<string, string>} enKeysMap
 * @param {Record<string, string>} [allowedDuplicates=ALLOWED_DUPLICATE_KEYS]
 * @returns {{ unauthorizedDuplicates: Array<{ value: string, collidingKeys: string[], unallowedKeys: string[] }>, caseDiscrepancies: Array<{ lower: string, variations: string[], keys: string[] }> }}
 */
function findDuplicateEnStrings(enKeysMap, allowedDuplicates = ALLOWED_DUPLICATE_KEYS) {
    const valueToKeys = {};
    const lowerToValues = {};

    for (const [key, rawVal] of Object.entries(enKeysMap)) {
        if (typeof rawVal !== 'string') continue;
        const val = rawVal.trim();
        if (!valueToKeys[val]) valueToKeys[val] = [];
        valueToKeys[val].push(key);

        const lower = val.toLowerCase();
        if (!lowerToValues[lower]) lowerToValues[lower] = [];
        lowerToValues[lower].push({ key, val });
    }

    const unauthorizedDuplicates = [];
    for (const [val, keys] of Object.entries(valueToKeys)) {
        if (keys.length > 1) {
            const unallowed = keys.filter(k => !allowedDuplicates[k]);
            if (unallowed.length > 0) {
                unauthorizedDuplicates.push({
                    value: val,
                    collidingKeys: keys,
                    unallowedKeys: unallowed
                });
            }
        }
    }

    const caseDiscrepancies = [];
    for (const [lower, items] of Object.entries(lowerToValues)) {
        const uniqueOriginals = new Set(items.map(i => i.val));
        if (uniqueOriginals.size > 1) {
            caseDiscrepancies.push({
                lower,
                variations: Array.from(uniqueOriginals),
                keys: items.map(i => `${i.key} ("${i.val}")`)
            });
        }
    }

    return { unauthorizedDuplicates, caseDiscrepancies };
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

// Check alphabetical sorting of object keys recursively
function checkAlphabeticalSort(obj, pathPrefix = '') {
    const errors = [];
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return errors;
    }
    const keys = Object.keys(obj);
    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== sortedKeys[i]) {
            errors.push(`At "${pathPrefix || 'root'}": key "${keys[i]}" should be after "${sortedKeys[i]}"`);
            break;
        }
    }
    for (const k of keys) {
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            const nextPrefix = pathPrefix ? `${pathPrefix}.${k}` : k;
            errors.push(...checkAlphabeticalSort(obj[k], nextPrefix));
        }
    }
    return errors;
}

function findCodeFiles(dir, codeFiles = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'scratch', '.git', '.vscode', '.agents', 'scripts'].includes(entry.name)) continue;
            findCodeFiles(fullPath, codeFiles);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
            codeFiles.push(fullPath);
        }
    }
    return codeFiles;
}

/**
 * Validates a single dynamic template literal or concatenation pattern for namespace sanity and semantic correctness.
 * @param {string} pattern - Raw pattern e.g. "views.equipment.${effectiveRarity.toLowerCase()}"
 * @param {string} filePath - Path to source file
 * @param {number} lineNum - Line number
 * @param {Record<string, string>} enKeysMap - Flattened map of all reference keys in en.json
 * @returns {string[]} List of error messages (empty if valid)
 */
function validateTemplateLiteral(pattern, filePath, lineNum, enKeysMap) {
    const errors = [];
    const relPath = path.relative(projectRoot, filePath);

    // Extract static namespace prefix up to the first ${
    const prefixMatch = pattern.match(/^([a-zA-Z0-9_.-]+\.)\$\{/);
    if (!prefixMatch) {
        errors.push(`[ERROR] Unrecognized dynamic translation pattern \`${pattern}\` at ${relPath}:${lineNum}`);
        return errors;
    }

    const prefix = prefixMatch[1];

    // Verify prefix root exists in enKeysMap
    const hasKeysWithPrefix = Object.keys(enKeysMap).some(k => k.startsWith(prefix));
    if (!hasKeysWithPrefix) {
        errors.push(`[ERROR] Non-existent namespace prefix "${prefix}" in template literal \`${pattern}\` at ${relPath}:${lineNum}`);
    }

    // Semantic misuse check: equipment rarities/types/categories used under entities.equipment.* instead of views.equipment.*
    if (prefix === 'entities.equipment.') {
        if (/\b(rarity|effectiveRarity|type|effectiveType|category|group\.category)\b/i.test(pattern)) {
            errors.push(`[ERROR] Namespace misuse: Equipment rarity, type, or category queried under "entities.equipment.*" instead of "views.equipment.*" in \`${pattern}\` at ${relPath}:${lineNum}`);
        }
    }

    // Semantic misuse check: equipment item names queried under views.equipment.* instead of entities.equipment.*
    if (prefix === 'views.equipment.' && !prefix.startsWith('views.equipment.modifiers.')) {
        if (/\b(toCamelCase|equipName|equipmentName|node\.equipmentKey|eqKeyStr|data\?\.id)\b/i.test(pattern)) {
            errors.push(`[ERROR] Namespace misuse: Equipment item name queried under "views.equipment.*" instead of "entities.equipment.*" in \`${pattern}\` at ${relPath}:${lineNum}`);
        }
    }

    return errors;
}

/**
 * Scans code files for translation references (static strings, data-i18n attributes, template literals, concatenations).
 * @param {string[]} files - List of code file paths
 * @param {Record<string, string>} enKeysMap - Flattened map of all reference keys in en.json
 * @returns {{ usedKeysInCode: Set<string>, dynamicPatterns: Array<{ pattern: string, file: string, line: number }>, errors: string[] }}
 */
function scanCodebaseKeys(files, enKeysMap) {
    const usedKeysInCode = new Set();
    const dynamicPatterns = [];
    const errors = [];

    for (const filePath of files) {
        if (filePath.includes('js/i18n/')) continue;
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

            // A. Match translate('static.key') or translate("static.key")
            const staticMatches = line.matchAll(/translate\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
            for (const match of staticMatches) {
                const k = match[1];
                if (k !== 'key.name' && !k.endsWith('.')) {
                    usedKeysInCode.add(k);
                }
            }

            // B. Match data-i18n="static.key" or data-i18n-*="static.key"
            const dataI18nMatches = line.matchAll(/data-i18n(?:-[a-z-]+)?=\s*['"]([a-zA-Z0-9_.-]+)['"]/g);
            for (const match of dataI18nMatches) {
                const k = match[1];
                if (k !== 'key.name' && !k.endsWith('.')) {
                    usedKeysInCode.add(k);
                }
            }

            // C. Match template literals: translate(`...`) or inside translate expressions
            const templateMatches = line.matchAll(/translate\(\s*(?:[^`()]*\|\|\s*)?`([^`]+)`/g);
            for (const match of templateMatches) {
                const rawTemplate = match[1];
                if (!rawTemplate.includes('${')) {
                    // Static template literal without interpolation
                    if (rawTemplate !== 'key.name' && !rawTemplate.endsWith('.')) {
                        usedKeysInCode.add(rawTemplate);
                    }
                } else {
                    // Dynamic template literal with interpolation
                    dynamicPatterns.push({ pattern: rawTemplate, file: filePath, line: lineNum });
                    const patternErrors = validateTemplateLiteral(rawTemplate, filePath, lineNum, enKeysMap);
                    errors.push(...patternErrors);
                }
            }

            // D. Match string concatenations: translate('entities.equipment.' + ...)
            const concatMatches = line.matchAll(/translate\(\s*['"]([a-zA-Z0-9_.-]+\.)['"]\s*\+\s*([^),]+)/g);
            for (const match of concatMatches) {
                const synthesized = `${match[1]}\${${match[2].trim()}}`;
                dynamicPatterns.push({ pattern: synthesized, file: filePath, line: lineNum });
                const patternErrors = validateTemplateLiteral(synthesized, filePath, lineNum, enKeysMap);
                errors.push(...patternErrors);
            }

            // E. Match ambient canonical namespace string literals across production code
            // (e.g. showConfirm(msg, 'actions.confirm', 'actions.clear'), notice titleKey/okBtnKey, configs)
            const isTestFile = filePath.includes('/tests/') || filePath.includes('\\tests\\');
            if (!isTestFile) {
                const codePart = line.replace(/\/\/.*$/, '');
                if (!/\.(startsWith|endsWith|includes)\(/.test(codePart)) {
                    const namespaceMatches = codePart.matchAll(/['"`]((?:actions|alerts|apiErrors|app|auth|colors|confirms|entities|errors|legal|nav|player|status|time|validation|views)\.[a-zA-Z0-9_.-]+)['"`]/g);
                    for (const match of namespaceMatches) {
                        const k = match[1];
                        if (k !== 'key.name' && !k.endsWith('.') && !/\.(css|js|png|html|svg|json)$/i.test(k)) {
                            usedKeysInCode.add(k);
                        }
                    }
                }
            }
        }
    }

    return { usedKeysInCode, dynamicPatterns, errors };
}

function validateDomainEnumerations(enKeysMap, rootDir = projectRoot) {
    const errors = [];
    let count = 0;

    const rarities = ['common', 'epic'];
    for (const r of rarities) {
        const key = `views.equipment.${r}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing equipment rarity key in en.json: ${key}`);
        }
    }

    const equipTypes = ['active', 'passive'];
    for (const t of equipTypes) {
        const key = `views.equipment.${t}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing equipment type key in en.json: ${key}`);
        }
    }

    const statCategories = ['ability', 'heroBoost', 'generalStats'];
    for (const c of statCategories) {
        const key = `views.equipment.${c}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing equipment stat category key in en.json: ${key}`);
        }
    }

    const oreTypes = ['shiny', 'glowy', 'starry', 'shinyShort', 'glowyShort', 'starryShort'];
    for (const o of oreTypes) {
        const key = `entities.ores.${o}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing ore type key in en.json: ${key}`);
        }
    }

    const dynamicHeroes = ['barbarianKing', 'archerQueen', 'grandWarden', 'royalChampion', 'minionPrince', 'dragonDuke'];
    for (const h of dynamicHeroes) {
        const key = `entities.heroes.${h}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing hero entity key in en.json: ${key}`);
        }
    }

    const modifiers = ['standard', 'esports', 'leagueContext', 'legend1', 'legend2', 'legend3', 'effectiveLevel', 'effectiveMaxLevel'];
    for (const m of modifiers) {
        const key = `views.equipment.modifiers.${m}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing equipment modifier key in en.json: ${key}`);
        }
    }

    const unitTypes = ['archer', 'barbarian', 'giantGiant', 'healer', 'henchmen', 'hogRider', 'lavaloon', 'snake'];
    for (const u of unitTypes) {
        const key = `entities.unitTypes.${u}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing unit type key in en.json: ${key}`);
        }
    }

    const magicItems = ['heroPotion', 'mightyMorsel', 'bookOfHeroes', 'runeOfElixir', 'petPotion', 'runeOfDarkElixir'];
    for (const mi of magicItems) {
        const itemKey = `entities.magicItems.${mi}`;
        const descKey = `entities.magicItemDescriptions.${mi}`;
        count += 2;
        if (!(itemKey in enKeysMap)) {
            errors.push(`[ERROR] Missing magic item key in en.json: ${itemKey}`);
        }
        if (!(descKey in enKeysMap)) {
            errors.push(`[ERROR] Missing magic item description key in en.json: ${descKey}`);
        }
    }

    const skins = ['majesticBarbarianKing', 'majesticArcherQueen', 'majesticMinionPrince', 'majesticGrandWarden', 'majesticRoyalChampion', 'majesticDragonDuke'];
    for (const s of skins) {
        const key = `entities.skins.${s}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing skin entity key in en.json: ${key}`);
        }
    }

    const resources = ['darkElixir', 'elixir'];
    for (const res of resources) {
        const key = `entities.resources.${res}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing resource entity key in en.json: ${key}`);
        }
    }

    const defensesList = [
        'airDefense', 'airSweeper', 'archerTower', 'bombTower', 'buildersHut',
        'cakeAPult', 'cannon', 'clanCastle', 'darkElixirStorage', 'eagleArtillery',
        'elixirStorage', 'firespitter', 'goldStorage', 'heroHunter', 'hiddenTesla',
        'hotCandle', 'infernoTower', 'logger', 'longshot', 'monolith',
        'mortar', 'multiArcherTower', 'multiGearTower', 'revengeTower', 'ricochetCannon',
        'scattershot', 'smasher', 'storages', 'spellTower', 'superWizardTower', 'townHall',
        'wizardTower', 'xBow'
    ];
    for (const def of defensesList) {
        const key = `entities.defenses.${def}`;
        count++;
        if (!(key in enKeysMap)) {
            errors.push(`[ERROR] Missing defense entity key in en.json: ${key}`);
        }
    }

    const equipDir = path.join(rootDir, 'js/data/equipment');
    if (fs.existsSync(equipDir)) {
        const equipFiles = fs.readdirSync(equipDir).filter(f => f.endsWith('.json'));
        for (const eqf of equipFiles) {
            const eqData = JSON.parse(fs.readFileSync(path.join(equipDir, eqf), 'utf8'));
            const camelId = (eqData.id || eqf.replace('.json', '')).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            const key = `entities.equipment.${camelId}`;
            count++;
            if (!(key in enKeysMap)) {
                errors.push(`[ERROR] Missing equipment entity key in en.json: ${key}`);
            }
            if (Array.isArray(eqData.staticStats)) {
                eqData.staticStats.forEach(s => {
                    if (s.key) {
                        count++;
                        if (!(`entities.stats.${s.key}` in enKeysMap)) {
                            errors.push(`[ERROR] Missing equipment stat key in en.json: entities.stats.${s.key}`);
                        }
                    }
                });
            }
            if (Array.isArray(eqData.statsMeta)) {
                eqData.statsMeta.forEach(s => {
                    if (s.key) {
                        count++;
                        if (!(`entities.stats.${s.key}` in enKeysMap)) {
                            errors.push(`[ERROR] Missing equipment stat key in en.json: entities.stats.${s.key}`);
                        }
                    }
                });
            }
        }
    }

    return { errors, count };
}

/**
 * Audits en.json canonical dictionary for unreferenced keys outside dynamic domain namespaces.
 * @param {Record<string, string>} enKeysMap
 * @param {string[]} codeFiles
 * @param {Set<string>} usedKeysInCode
 * @returns {string[]} List of unreferenced keys
 */
function auditUnusedKeys(enKeysMap, codeFiles, usedKeysInCode) {
    const dynamicPrefixes = [
        'entities.',
        'apiErrors.',
        'theme.',
        'languages.',
        'rarity.',
        'player.roles.',
        'views.equipment.',
        'views.changelog.type.',
        'views.income.shortcuts.',
        'views.income.starBonus.event',
        'views.income.supercellEvents.',
        'app.description',
        'time.'
    ];

    const fileContents = codeFiles.map(f => fs.readFileSync(f, 'utf8'));
    const unreferencedKeys = [];

    for (const key of Object.keys(enKeysMap)) {
        if (usedKeysInCode.has(key)) continue;
        if (dynamicPrefixes.some(p => key.startsWith(p) || key === p)) continue;
        const isFound = fileContents.some(content => content.includes(key));
        if (!isFound) {
            unreferencedKeys.push(key);
        }
    }

    return unreferencedKeys;
}

function runValidatorCli() {
    console.log('--- OreCalc Canonical i18n & Translation Linter ---\n');

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

    const enKeysMap = getAllKeys(enData);
    const totalEnKeys = Object.keys(enKeysMap).length;
    console.log(`[OK] Reference canonical dictionary (en.json): ${totalEnKeys} keys loaded.\n`);

    let hasErrors = false;

    const enSortErrors = checkAlphabeticalSort(enData);
    if (enSortErrors.length > 0) {
        console.error(`[ERROR] en.json has unsorted keys:\n  ${enSortErrors.join('\n  ')}`);
        hasErrors = true;
    } else {
        console.log('[OK] en.json keys are strictly sorted in alphabetical order (A-Z).');
    }

    console.log('\n--- Checking Codebase Translation Key References & Template Literals ---');
    const codeFiles = findCodeFiles(projectRoot);
    const { usedKeysInCode, dynamicPatterns, errors: scanErrors } = scanCodebaseKeys(codeFiles, enKeysMap);

    let missingInEnCount = 0;
    for (const key of usedKeysInCode) {
        if (key.endsWith('.') || key.includes('${') || key.includes('+')) continue;
        if (!(key in enKeysMap)) {
            console.warn(`[WARN] Codebase references key "${key}" which is MISSING from en.json`);
            missingInEnCount++;
        }
    }

    if (missingInEnCount === 0) {
        console.log(`[OK] All ${usedKeysInCode.size} static translation keys referenced in codebase exist in en.json.`);
    } else {
        console.warn(`[WARN] Found ${missingInEnCount} translation key(s) used in code but missing from en.json.`);
        hasErrors = true;
    }

    if (scanErrors.length > 0) {
        console.error(`[ERROR] Template literal / namespace scan errors:\n  ${scanErrors.join('\n  ')}`);
        hasErrors = true;
    } else {
        console.log(`[OK] All ${dynamicPatterns.length} dynamic template literal and concatenation patterns verified with valid namespaces.`);
    }

    console.log('\n--- Statically Verifying Dynamic Domain Entities & Enumerations ---');
    const { errors: domainErrors, count: domainCount } = validateDomainEnumerations(enKeysMap, projectRoot);
    if (domainErrors.length > 0) {
        console.error(`[ERROR] Domain enumeration verification failed:\n  ${domainErrors.join('\n  ')}`);
        hasErrors = true;
    } else {
        console.log(`[OK] All ${domainCount} dynamic domain entities and enumerations verify cleanly in en.json.`);
    }

    console.log('\n--- Unused Translation Key Audit ---');
    const unusedKeys = auditUnusedKeys(enKeysMap, codeFiles, usedKeysInCode);
    if (unusedKeys.length > 0) {
        console.warn(`[WARN] Found ${unusedKeys.length} potentially unused translation key(s) in en.json:\n  ${unusedKeys.slice(0, 10).map(k => ' - ' + k).join('\n  ')}${unusedKeys.length > 10 ? `\n  ... and ${unusedKeys.length - 10} more` : ''}`);
    } else {
        console.log('[OK] 0 unreferenced keys detected in canonical en.json dictionary.');
    }

    console.log('\n--- Canonical en.json Duplicate String Audit ---');
    const { unauthorizedDuplicates, caseDiscrepancies } = findDuplicateEnStrings(enKeysMap, ALLOWED_DUPLICATE_KEYS);
    if (unauthorizedDuplicates.length > 0) {
        hasErrors = true;
        console.error(`[ERROR] Found ${unauthorizedDuplicates.length} unauthorized duplicate string value(s) in en.json:`);
        unauthorizedDuplicates.forEach(dup => {
            console.error(`   - "${dup.value}" is shared by [${dup.collidingKeys.join(', ')}]. Unauthorized: [${dup.unallowedKeys.join(', ')}]`);
        });
        console.error('   Rule: Reuse existing canonical key or register justified false-friends in ALLOWED_DUPLICATE_KEYS.');
    } else if (caseDiscrepancies.length > 0) {
        hasErrors = true;
        console.error(`[ERROR] Found ${caseDiscrepancies.length} accidental case variation(s) in en.json:`);
        caseDiscrepancies.forEach(cd => {
            console.error(`   - Variations [${cd.variations.join(', ')}] across keys: ${cd.keys.join(', ')}`);
        });
    } else {
        console.log('[OK] 0 unauthorized duplicate strings in en.json (all duplicate values strictly allowlisted).');
    }

    let enabledLangCodes = ['en', 'de', 'tr', 'zh'];
    try {
        if (fs.existsSync(languagesDataPath)) {
            const langContent = fs.readFileSync(languagesDataPath, 'utf8');
            const matches = [...langContent.matchAll(/code:\s*'([^']+)'[^}]*enabled:\s*true/g)].map(m => m[1]);
            if (matches.length > 0) enabledLangCodes = matches;
        }
    } catch (e) {
    }

    const { hasErrors: dictErrors, report, errors: validationErrors } = validateDictionaries(
        i18nDir,
        enKeysMap,
        totalEnKeys,
        enabledLangCodes
    );

    if (dictErrors) {
        hasErrors = true;
        validationErrors.forEach(err => console.error(err));
    }

    console.log(`\n[i18n] Translation Quality Report (${report.length} locales, ${totalEnKeys} keys):`);
    let hasCommunityMissing = false;
    report.forEach(r => {
        if (r.lang === 'en') {
            console.log(`[i18n]   ${r.lang} (${r.file}): 100.0% -> REFERENCE`);
        } else {
            console.log(`[i18n]   ${r.lang} (${r.file}): ${r.completion} (${r.missing} missing, ${r.obsolete} obsolete) -> ${r.status}`);
            if (r.missing > 0 && !r.isStrictDeveloperLocale) {
                hasCommunityMissing = true;
            }
        }
    });

    if (hasCommunityMissing) {
        console.log('\n[i18n] Note: Missing strings in community translations (non-en, non-de) will be imported directly on GitHub using Crowdin CI.');
    }

    if (hasErrors) {
        console.error('\n[ERROR] i18n validation failed! Please fix errors above.');
        process.exit(1);
    } else {
        console.log('\n[SUCCESS] All i18n translation files passed canonical validation successfully.');
    }
}

function validateDictionaries(i18nDir, enKeysMap, totalEnKeys, enabledLangCodes = ['en', 'de', 'tr', 'zh']) {
    const files = fs.readdirSync(i18nDir).filter(file => file.endsWith('.json'));
    const report = [];
    let hasErrors = false;
    const errors = [];

    for (const file of files) {
        const lang = path.basename(file, '.json');
        const filePath = path.join(i18nDir, file);

        let data;
        const rawContent = fs.readFileSync(filePath, 'utf8');
        try {
            data = JSON.parse(rawContent);
        } catch (err) {
            errors.push(`[ERROR] ${file}: Invalid JSON syntax - ${err.message}`);
            hasErrors = true;
            continue;
        }

        const lines = rawContent.split('\n');
        const middleBlankLines = [];
        for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].trim() === '') {
                middleBlankLines.push(i + 1);
            }
        }
        if (middleBlankLines.length > 0) {
            errors.push(`[ERROR] [${lang}] Found blank line(s) in middle of ${file} at line(s): ${middleBlankLines.join(', ')}`);
            hasErrors = true;
        }

        const sortErrors = checkAlphabeticalSort(data);
        if (sortErrors.length > 0) {
            errors.push(`[ERROR] [${lang}] Unsorted keys in ${file}:\n  ${sortErrors.join('\n  ')}`);
            hasErrors = true;
        }

        if (lang === 'en') {
            report.push({
                lang,
                file,
                total: totalEnKeys,
                missing: 0,
                obsolete: 0,
                completion: '100.0%',
                status: 'REFERENCE',
                isStrictDeveloperLocale: true
            });
            continue;
        }

        const langKeysMap = getAllKeys(data);

        // Auto-clean 0% / empty translation files downloaded from Crowdin
        if (Object.keys(langKeysMap).length === 0) {
            try { fs.unlinkSync(filePath); } catch (e) {}
            continue;
        }
        let missingCount = 0;
        let obsoleteCount = 0;
        let placeholderErrors = 0;

        for (const [key, enValue] of Object.entries(enKeysMap)) {
            if (!(key in langKeysMap) || langKeysMap[key] === undefined || langKeysMap[key] === '') {
                missingCount++;
                continue;
            }

            const langValue = langKeysMap[key];

            const enPlaceholders = extractPlaceholders(enValue);
            const langPlaceholders = extractPlaceholders(langValue);

            for (const ph of enPlaceholders) {
                if (!langPlaceholders.includes(ph)) {
                    placeholderErrors++;
                    errors.push(`[ERROR] [${lang}] Missing required placeholder {${ph}} in key "${key}"`);
                }
            }

            for (const ph of langPlaceholders) {
                if (!enPlaceholders.includes(ph)) {
                    placeholderErrors++;
                    errors.push(`[ERROR] [${lang}] Unexpected placeholder {${ph}} in key "${key}"`);
                }
            }
        }

        for (const key of Object.keys(langKeysMap)) {
            if (!(key in enKeysMap)) {
                obsoleteCount++;
            }
        }

        const foundCount = totalEnKeys - missingCount;
        const completionPctNum = (foundCount / totalEnKeys) * 100;
        const completionPct = completionPctNum.toFixed(1) + '%';
        const isEnabled = enabledLangCodes.includes(lang);
        const isStrictDeveloperLocale = ['en', 'de'].includes(lang);

        let status = isEnabled ? 'ENABLED (PROD)' : 'PENDING (DRAFT)';

        if (placeholderErrors > 0 || sortErrors.length > 0 || (isStrictDeveloperLocale && (missingCount > 0 || obsoleteCount > 0))) {
            hasErrors = true;
            if (placeholderErrors > 0) status += ' [PLACEHOLDER ERROR]';
            if (sortErrors.length > 0) status += ' [UNSORTED]';
            if (missingCount > 0) status += ' [MISSING KEYS]';
            if (obsoleteCount > 0) status += ' [OBSOLETE KEYS]';
        } else if (missingCount > 0 || obsoleteCount > 0) {
            if (missingCount > 0) status += ' [INCOMPLETE]';
            if (obsoleteCount > 0) status += ' [OBSOLETE KEYS]';
        }

        report.push({
            lang,
            file,
            total: totalEnKeys,
            missing: missingCount,
            obsolete: obsoleteCount,
            completion: completionPct,
            status,
            isStrictDeveloperLocale
        });
    }

    return { hasErrors, report, errors };
}

if (require.main === module) {
    runValidatorCli();
}

module.exports = {
    getAllKeys,
    extractPlaceholders,
    extractHtmlTags,
    checkAlphabeticalSort,
    findCodeFiles,
    validateTemplateLiteral,
    scanCodebaseKeys,
    validateDomainEnumerations,
    validateDictionaries,
    ALLOWED_DUPLICATE_KEYS,
    findDuplicateEnStrings,
    runValidatorCli
};
