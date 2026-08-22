import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {};
}

if (typeof globalThis.customElements === 'undefined') {
    globalThis.customElements = {
        get: () => null,
        define: () => {}
    };
}

class MockClassList {
    constructor(initial = '') {
        this._classes = new Set(initial ? initial.split(/\s+/).filter(Boolean) : []);
    }
    add(...tokens) {
        tokens.forEach(t => { if (t) this._classes.add(t); });
    }
    remove(...tokens) {
        tokens.forEach(t => this._classes.delete(t));
    }
    contains(token) {
        return this._classes.has(token);
    }
    toggle(token, force) {
        if (typeof force === 'boolean') {
            if (force) this.add(token);
            else this.remove(token);
            return force;
        }
        if (this.contains(token)) {
            this.remove(token);
            return false;
        }
        this.add(token);
        return true;
    }
    get length() {
        return this._classes.size;
    }
    toString() {
        return Array.from(this._classes).join(' ');
    }
}

class MockDOMElement {
    constructor(tagName = 'div', id = '', className = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = className;
        this.classList = new MockClassList(className);
        this.children = [];
        this.dataset = {};
        this.attributes = new Map();
        this.eventListeners = new Map();
        this.textContent = '';
        this.value = '';
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }

    querySelector() { return null; }
    querySelectorAll() { return []; }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
}

const mockBody = new MockDOMElement('body');
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        body: mockBody,
        createElement: (tag) => new MockDOMElement(tag),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: { hostname: 'localhost', port: '8080', href: 'http://localhost:8080/' },
        matchMedia: () => ({
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
        }),
        __ENV__: { APP_VERSION: '2.1.0' },
        addEventListener: () => {},
        removeEventListener: () => {}
    };
} else {
    if (!globalThis.window.location) {
        globalThis.window.location = { hostname: 'localhost', port: '8080', href: 'http://localhost:8080/' };
    }
    if (!globalThis.window.matchMedia) {
        globalThis.window.matchMedia = () => ({
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
        });
    }
}

if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };
}

if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };
}

function scanDir(dir, filter) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'scratch') continue;
            files.push(...scanDir(fullPath, filter));
        } else if (filter(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

const jsFiles = scanDir(path.join(projectRoot, 'js'), f => f.endsWith('.js'));

describe('JavaScript Architecture Quality & Platform Modernization Suite', () => {

    describe('1. Build Pipeline Modernization & cpx Pruning (Milestone 3)', () => {

        test('package.json does not declare cpx dependency in dependencies or devDependencies', () => {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            assert.equal(pkg.dependencies?.cpx, undefined);
            assert.equal(pkg.devDependencies?.cpx, undefined);
        });

        test('pnpm-lock.yaml does not contain cpx package dependencies', () => {
            const lockfilePath = path.join(projectRoot, 'pnpm-lock.yaml');
            const lockContent = fs.readFileSync(lockfilePath, 'utf8');

            assert.doesNotMatch(lockContent, /\bcpx@/, 'pnpm-lock.yaml must not contain cpx package entries');
        });

        test('scripts/build.js does not require cpx and adopts native fs.cpSync', () => {
            const buildScriptPath = path.join(projectRoot, 'scripts/build.js');
            const buildContent = fs.readFileSync(buildScriptPath, 'utf8');

            assert.doesNotMatch(buildContent, /require\(['"]cpx['"]\)/, 'scripts/build.js must not require cpx');
            assert.doesNotMatch(buildContent, /copyWithPromise/, 'scripts/build.js must not define or use copyWithPromise');
            assert.match(buildContent, /fs\.cpSync\(/, 'scripts/build.js must use native fs.cpSync');
        });
    });

    describe('2. Native Platform APIs & Zero Deprecations (Milestones 1 & 2)', () => {

        test('js/utils/uuidGenerator.js uses native crypto.randomUUID() without custom loops', async () => {
            const uuidFilePath = path.join(projectRoot, 'js/utils/uuidGenerator.js');
            const uuidContent = fs.readFileSync(uuidFilePath, 'utf8');

            assert.match(uuidContent, /crypto\.randomUUID\(\)/, 'uuidGenerator.js must adopt crypto.randomUUID()');
            assert.doesNotMatch(uuidContent, /Math\.random/, 'uuidGenerator.js must not use Math.random');

            const { generateUUID, isValidUUID } = await import('../../js/utils/uuidGenerator.js');
            const uuid = generateUUID();
            assert.equal(typeof uuid, 'string');
            assert.equal(isValidUUID(uuid), true, `Generated UUID '${uuid}' must be valid RFC4122 v4`);
            assert.equal(isValidUUID('invalid-uuid-format'), false);
        });

        test('native structuredClone is adopted and JSON.parse(JSON.stringify) is eliminated across js/', () => {
            const structuredCloneFiles = [
                path.join(projectRoot, 'js/services/serverResponseHandler.js'),
                path.join(projectRoot, 'js/components/appSettings/settingsSupportModals.js'),
                path.join(projectRoot, 'js/components/welcome/welcomeSettingsDisplay.js'),
                path.join(projectRoot, 'js/components/welcome/welcomeWizardState.js')
            ];

            for (const file of structuredCloneFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                assert.match(
                    content,
                    /structuredClone\(/,
                    `${relPath} must use native structuredClone()`
                );
            }

            const jsonCloneViolations = [];
            for (const file of jsFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                if (/JSON\.parse\(\s*JSON\.stringify\(/.test(content)) {
                    jsonCloneViolations.push(relPath);
                }
            }

            assert.equal(
                jsonCloneViolations.length,
                0,
                `Found JSON.parse(JSON.stringify()) usages that must use structuredClone():\n${jsonCloneViolations.join('\n')}`
            );
        });

        test('zero deprecated String.prototype.substr() occurrences across all js/ files', () => {
            const substrViolations = [];

            for (const file of jsFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                    if (/\.substr\(/.test(trimmed)) {
                        substrViolations.push(`${relPath}:${idx + 1} -> ${trimmed}`);
                    }
                });
            }

            assert.equal(
                substrViolations.length,
                0,
                `Found deprecated .substr() occurrences that should use .slice() or .substring():\n${substrViolations.join('\n')}`
            );
        });

        test('js/utils/modalHistoryManager.js uses parentElement and slice without .parent or .substr', () => {
            const modalHistoryPath = path.join(projectRoot, 'js/utils/modalHistoryManager.js');
            const content = fs.readFileSync(modalHistoryPath, 'utf8');

            assert.doesNotMatch(content, /\.parent\b(?!\w)/, 'modalHistoryManager.js must not reference non-standard .parent');
            assert.doesNotMatch(content, /\.substr\(/, 'modalHistoryManager.js must not use deprecated .substr()');
        });
    });

    describe('3. Module Pruning & Deduplication (Milestones 3 & 4)', () => {

        test('js/services/consentManager.js exports getConsentBannerTextKey and handles all 4 boolean combinations', async () => {
            const consentPath = path.join(projectRoot, 'js/services/consentManager.js');
            const content = fs.readFileSync(consentPath, 'utf8');

            assert.match(content, /export function getConsentBannerTextKey\(/, 'consentManager.js must export getConsentBannerTextKey');

            const { getConsentBannerTextKey } = await import('../../js/services/consentManager.js');

            assert.equal(getConsentBannerTextKey(false, false), 'legal.bannerTextBoth');
            assert.equal(getConsentBannerTextKey(true, false), 'legal.bannerTextTerms');
            assert.equal(getConsentBannerTextKey(false, true), 'legal.bannerTextPrivacy');
            assert.equal(getConsentBannerTextKey(true, true), 'legal.bannerTextBoth');
        });

        test('js/components/equipment/heroCard.js eliminates redundant heroNameMap in favor of canonical heroData', () => {
            const heroCardPath = path.join(projectRoot, 'js/components/equipment/heroCard.js');
            const content = fs.readFileSync(heroCardPath, 'utf8');

            assert.doesNotMatch(content, /const heroNameMap\b/, 'heroCard.js must not declare heroNameMap');
            assert.doesNotMatch(content, /\bheroNameMap\[/, 'heroCard.js must not reference heroNameMap');
            assert.match(content, /heroData\[/, 'heroCard.js must use canonical heroData dictionary');
        });

        test('js/components/appSettings/settingsModals.js removes dead privacy:close event dispatch', () => {
            const settingsModalsPath = path.join(projectRoot, 'js/components/appSettings/settingsModals.js');
            const content = fs.readFileSync(settingsModalsPath, 'utf8');

            assert.doesNotMatch(content, /['"]privacy:close['"]/, 'settingsModals.js must not dispatch privacy:close CustomEvent');

            const allSourceFiles = [
                ...jsFiles,
                ...scanDir(path.join(projectRoot, 'partials'), f => f.endsWith('.html')),
                ...scanDir(path.join(projectRoot, 'server'), f => f.endsWith('.js')),
                ...scanDir(path.join(projectRoot, 'scripts'), f => f.endsWith('.js'))
            ];

            for (const file of allSourceFiles) {
                const fileContent = fs.readFileSync(file, 'utf8');
                assert.doesNotMatch(
                    fileContent,
                    /['"]privacy:close['"]/,
                    `Found dead privacy:close reference in ${path.relative(projectRoot, file)}`
                );
            }
        });
    });

    describe('4. State Architecture, Selectors & Constant Freezing (Milestones 1 & 3)', () => {

        test('DEFAULT_CUSTOM_CHIP_SETTINGS is deeply frozen and contains valid chip defaults', async () => {
            const { DEFAULT_CUSTOM_CHIP_SETTINGS } = await import('../../js/core/state.js');

            assert.ok(DEFAULT_CUSTOM_CHIP_SETTINGS);
            assert.equal(Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS), true);

            const expectedKeys = [
                'custom',
                'starBonus',
                'shopOffers',
                'gemTrader',
                'raidMedalTrader',
                'eventTrader',
                'eventPass',
                'clanWar',
                'cwl',
                'supercellEvents',
                'prospector'
            ];

            for (const key of expectedKeys) {
                assert.ok(
                    DEFAULT_CUSTOM_CHIP_SETTINGS[key] !== undefined,
                    `DEFAULT_CUSTOM_CHIP_SETTINGS must contain property '${key}'`
                );
                assert.equal(
                    Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS[key]),
                    true,
                    `DEFAULT_CUSTOM_CHIP_SETTINGS.${key} must be frozen`
                );
            }
        });

        test('js/core/selectors.js exports pure zero-copy state selectors and ZERO_ORES singleton', async () => {
            const selectors = await import('../../js/core/selectors.js');

            const expectedSelectors = [
                'selectActivePlayerTag',
                'selectActivePlayer',
                'selectActiveHeroes',
                'selectStoredOres',
                'selectIncome',
                'selectPlanner',
                'selectPlayerProfile',
                'selectHeroJourney',
                'selectDerived',
                'selectDerivedSourceIncome',
                'selectUISettings'
            ];

            for (const name of expectedSelectors) {
                assert.equal(
                    typeof selectors[name],
                    'function',
                    `selectors.js must export function '${name}'`
                );
            }

            assert.deepEqual(selectors.ZERO_ORES, { shiny: 0, glowy: 0, starry: 0 });
            assert.equal(Object.isFrozen(selectors.ZERO_ORES), true);
        });

        test('js/core/calculator.js and modifierCalculator.js have zero dead imports', () => {
            const calcContent = fs.readFileSync(path.join(projectRoot, 'js/core/calculator.js'), 'utf8');
            assert.doesNotMatch(calcContent, /\bheroData\b/, 'calculator.js must not import heroData');
            assert.doesNotMatch(calcContent, /\bupgradeCosts\b/, 'calculator.js must not import upgradeCosts');

            const modifierContent = fs.readFileSync(path.join(projectRoot, 'js/domain/equipment/modifierCalculator.js'), 'utf8');
            assert.doesNotMatch(modifierContent, /\bUNRANKED_LEAGUE_ID\b/, 'modifierCalculator.js must not import UNRANKED_LEAGUE_ID');
        });

        test('js/core/constants.js does not export dormant SETTINGS or SAVED_TAGS keys', () => {
            const constantsContent = fs.readFileSync(path.join(projectRoot, 'js/core/constants.js'), 'utf8');
            assert.doesNotMatch(constantsContent, /\bSETTINGS\s*:/, 'constants.js must not define SETTINGS storage key');
            assert.doesNotMatch(constantsContent, /\bSAVED_TAGS\s*:/, 'constants.js must not define SAVED_TAGS storage key');
        });

        test('js/core/localStorageManager.js resetState uses localStorage.clear() directly', () => {
            const lsmContent = fs.readFileSync(path.join(projectRoot, 'js/core/localStorageManager.js'), 'utf8');
            assert.match(lsmContent, /localStorage\.clear\(\)/, 'resetState must invoke localStorage.clear()');
        });

        test('js/core/renderer.js calls updateHeroJourneyUpcomingBadges exactly once', () => {
            const rendererContent = fs.readFileSync(path.join(projectRoot, 'js/core/renderer.js'), 'utf8');
            const matches = rendererContent.match(/updateHeroJourneyUpcomingBadges\(/g) || [];
            assert.equal(
                matches.length,
                1,
                `updateHeroJourneyUpcomingBadges must be called exactly once in renderer.js, found ${matches.length}`
            );
        });
    });

    describe('5. Utility Functions & Dead Code Elimination (Milestone 2)', () => {

        test('js/utils/dateUtils.js has pruned dead isLeapYear function', () => {
            const dateUtilsContent = fs.readFileSync(path.join(projectRoot, 'js/utils/dateUtils.js'), 'utf8');
            assert.doesNotMatch(dateUtilsContent, /\bisLeapYear\b/, 'dateUtils.js must not define isLeapYear');
        });

        test('js/utils/numberFormatter.js does not export dead formatFloat function', () => {
            const numContent = fs.readFileSync(path.join(projectRoot, 'js/utils/numberFormatter.js'), 'utf8');
            assert.doesNotMatch(numContent, /export function formatFloat\b/, 'numberFormatter.js must not export formatFloat');
        });

        test('js/utils/inputValidator.js defines getNumericBounds and eliminates unused state import', () => {
            const inputValidatorContent = fs.readFileSync(path.join(projectRoot, 'js/utils/inputValidator.js'), 'utf8');
            assert.match(inputValidatorContent, /function getNumericBounds\(/, 'inputValidator.js must define getNumericBounds');
            assert.doesNotMatch(inputValidatorContent, /import\s*\{\s*state\s*\}\s*from/, 'inputValidator.js must not import unused state');
        });

        test('js/utils/inputValidator.js and formBindingUtils.js prevent number input scroll stepper trap on wheel events', () => {
            const inputValidatorContent = fs.readFileSync(path.join(projectRoot, 'js/utils/inputValidator.js'), 'utf8');
            assert.match(inputValidatorContent, /addEventListener\(['"]wheel['"],[\s\S]*?inputElement\.blur\(\)[\s\S]*?passive:\s*true\s*\}\)/, 'inputValidator.js must attach passive wheel blur listener');

            const formBindingContent = fs.readFileSync(path.join(projectRoot, 'js/components/common/formBindingUtils.js'), 'utf8');
            assert.match(formBindingContent, /addEventListener\(['"]wheel['"],[\s\S]*?inputElement\.blur\(\)[\s\S]*?passive:\s*true\s*\}\)/, 'formBindingUtils.js must attach passive wheel blur listener');
        });

        test('js/utils/autoPlaceChips.js defines shared reindexNonAutoChips helper', () => {
            const autoPlaceContent = fs.readFileSync(path.join(projectRoot, 'js/utils/autoPlaceChips.js'), 'utf8');
            assert.match(autoPlaceContent, /function reindexNonAutoChips\(/, 'autoPlaceChips.js must define reindexNonAutoChips helper');
        });
    });
});
