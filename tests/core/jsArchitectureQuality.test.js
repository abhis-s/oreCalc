import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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

    describe('Native Platform APIs & Zero Deprecations', () => {

        test('js/utils/uuidGenerator.js generates unique valid RFC4122 v4 UUIDs', async () => {
            const { generateUUID, isValidUUID } = await import('../../js/utils/uuidGenerator.js');
            const uuidA = generateUUID();
            const uuidB = generateUUID();
            assert.equal(typeof uuidA, 'string');
            assert.notEqual(uuidA, uuidB, 'Sequential UUIDs must be unique');
            assert.equal(isValidUUID(uuidA), true, `Generated UUID '${uuidA}' must be valid RFC4122 v4`);
            assert.equal(isValidUUID(uuidB), true, `Generated UUID '${uuidB}' must be valid RFC4122 v4`);
            assert.equal(isValidUUID('invalid-uuid-format'), false);
        });

        test('JSON.parse(JSON.stringify) is eliminated across js/', () => {
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
    });

    describe('State Architecture, Selectors & Constant Freezing', () => {

        test('DEFAULT_CUSTOM_CHIP_SETTINGS is deeply frozen and contains valid chip defaults', async () => {
            const { DEFAULT_CUSTOM_CHIP_SETTINGS } = await import('../../js/core/state.js');

            assert.equal(typeof DEFAULT_CUSTOM_CHIP_SETTINGS, 'object');
            assert.equal(Object.isFrozen(DEFAULT_CUSTOM_CHIP_SETTINGS), true);

            const expectedKeys = [
                'custom',
                'starBonus',
                'shopOffers',
                'gemTrader',
                'raidMedalTrader',
                'eventPass',
                'eventTrader',
                'craftPass',
                'craftPassTrader',
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
    });

    describe('HTML [hidden] vs. Inline style.display Consistency', () => {
        test('HTML elements declared with hidden attribute are not shown solely via style.display without clearing .hidden', () => {
            const htmlFiles = scanDir(projectRoot, f => f.endsWith('.html'))
                .filter(file => !path.relative(projectRoot, file).startsWith(`tests${path.sep}`));

            const hiddenElementIds = [];
            const tagRe = /<([\w-]+)\b([^>]*\s+hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?:\s+[^>]*)?)>/gi;
            for (const file of htmlFiles) {
                const content = fs.readFileSync(file, 'utf8');
                let match;
                while ((match = tagRe.exec(content)) !== null) {
                    const attrs = match[2];
                    if (!/(?:^|\s)hidden(?:\s|=|$)/i.test(attrs)) continue;
                    const idMatch = attrs.match(/\bid\s*=\s*"([^"]+)"/i);
                    if (idMatch?.[1]) {
                        hiddenElementIds.push({
                            id: idMatch[1],
                            htmlPath: path.relative(projectRoot, file)
                        });
                    }
                }
            }

            assert.ok(hiddenElementIds.length > 0, 'Expected HTML templates to declare hidden elements');

            const violations = [];
            for (const file of jsFiles) {
                const jsContent = fs.readFileSync(file, 'utf8');
                const relPath = path.relative(projectRoot, file);
                const lines = jsContent.split('\n');

                for (const { id, htmlPath } of hiddenElementIds) {
                    lines.forEach((line, idx) => {
                        if (!line.includes(`'${id}'`) && !line.includes(`"${id}"`)) return;
                        const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
                        if (!varMatch?.[1]) return;
                        const varName = varMatch[1];
                        const showViaStyleRe = new RegExp(`\\b${varName}\\b[^;\\n]*\\.style\\.display\\s*=\\s*([^;\\n]+)`, 'g');
                        const clearHiddenRe = new RegExp(`\\b${varName}\\b[^\\n]*(\\.hidden\\s*=\\s*(?!true\\b)|removeAttribute\\(['"]hidden['"])`, 'g');
                        const hasNonNoneDisplayShow = Array.from(jsContent.matchAll(showViaStyleRe))
                            .some((m) => !/^['"]none['"]$/i.test(m[1].trim()));
                        if (hasNonNoneDisplayShow && !clearHiddenRe.test(jsContent)) {
                            violations.push(`${relPath}:${idx + 1} (${varName} -> #${id} in ${htmlPath})`);
                        }
                    });
                }
            }

            assert.equal(
                violations.length,
                0,
                `Found JS controllers revealing HTML [hidden] elements via style.display without clearing .hidden:\n${violations.join('\n')}`
            );
        });
    });
});
