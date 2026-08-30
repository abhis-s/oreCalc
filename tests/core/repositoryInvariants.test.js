import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Recursively collect file paths matching a filter predicate.
 * @param {string} dir
 * @param {(filePath: string) => boolean} [filter]
 * @returns {string[]}
 */
function scanDir(dir, filter = () => true) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'cache' || entry.name === '.agents') {
                continue;
            }
            results = results.concat(scanDir(fullPath, filter));
        } else if (entry.isFile() && filter(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

describe('Repository Invariants & Code Hygiene Compliance', () => {
    const candidateFiles = scanDir(projectRoot, f => {
        const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
        const base = path.basename(f);
        if (base === '.DS_Store' || rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.startsWith('dist/') || rel.startsWith('scratch/') || rel.startsWith('.agents/')) {
            return false;
        }
        if (rel === '.env' || rel.endsWith('/.env')) {
            return false;
        }
        return /\.(js|mjs|cjs|ts|scss|css|html|json|yaml|yml|md|txt|editorconfig)$/.test(f) ||
            /^\.[a-zA-Z0-9_-]+/.test(base);
    });

    test('zero emoji characters across all production and test source files', () => {
        const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
        const violations = [];

        const sourceFiles = candidateFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            if (rel === 'js/data/languagesData.js') return false;
            if (rel.endsWith('.md')) return false;
            if (rel.startsWith('scratch/')) return false;
            return /\.(js|scss|html|json)$/.test(f);
        });

        for (const file of sourceFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, idx) => {
                if (emojiPattern.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> ${line.trim()}`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found emoji characters violating repository policy:\n${violations.join('\n')}`
        );
    });

    test('zero Unicode dingbats and raw symbols across production source files, templates, and dictionaries', () => {
        const prohibitedSymbols = /[\u2190-\u21FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2022]/u;
        const violations = [];

        const sourceFiles = candidateFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            if (rel.endsWith('.md')) return false;
            if (rel.startsWith('scratch/')) return false;
            if (rel === 'js/qr-code-styling.js') return false; // Vendor library
            return /\.(js|scss|html|json)$/.test(f);
        });

        for (const file of sourceFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, idx) => {
                if (prohibitedSymbols.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> ${line.trim()}`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found prohibited Unicode symbols/dingbats violating repository policy:\n${violations.join('\n')}`
        );
    });

    test('zero lines with trailing whitespace characters across all project files', () => {
        const trailingWhitespaceRegex = /[ \t]+$/;
        const violations = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((rawLine, idx) => {
                const line = rawLine.replace(/\r$/, '');
                if (trailingWhitespaceRegex.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> "${line}"`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found lines with trailing whitespace characters:\n${violations.join('\n')}`
        );
    });

    test('zero occurrences of more than 1 consecutive empty or whitespace-only lines across all project files', () => {
        const violations = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            let consecutiveEmptyCount = 0;

            lines.forEach((rawLine, idx) => {
                const line = rawLine.replace(/\r$/, '');
                if (line.trim() === '') {
                    consecutiveEmptyCount++;
                    if (consecutiveEmptyCount > 1) {
                        violations.push(`${relPath}:${idx + 1} (consecutive empty line #${consecutiveEmptyCount})`);
                    }
                } else {
                    consecutiveEmptyCount = 0;
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found more than 1 consecutive empty or whitespace-only lines:\n${violations.join('\n')}`
        );
    });

    test('every text file ends with exactly one newline character and no trailing empty lines', () => {
        const missingNewline = [];
        const multipleNewlines = [];

        for (const file of candidateFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');

            if (content.length === 0) continue;

            if (!content.endsWith('\n')) {
                missingNewline.push(relPath);
            } else if (content.endsWith('\n\n') || content.endsWith('\r\n\r\n')) {
                multipleNewlines.push(relPath);
            }
        }

        assert.equal(
            missingNewline.length,
            0,
            `Found text files missing trailing newline character (\\n) at EOF:\n${missingNewline.join('\n')}`
        );

        assert.equal(
            multipleNewlines.length,
            0,
            `Found text files ending with multiple trailing empty lines at EOF:\n${multipleNewlines.join('\n')}`
        );
    });

    test('all inline script tags inside HTML files have valid JavaScript syntax', async () => {
        const htmlFiles = candidateFiles.filter(f => f.endsWith('.html'));
        const syntaxErrors = [];
        const eslint = new ESLint();

        for (const file of htmlFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');
            const scriptRegex = /<script(?:\s+[^>]*?)?>([\s\S]*?)<\/script>/gi;
            let match;
            let scriptIndex = 1;

            while ((match = scriptRegex.exec(content)) !== null) {
                const scriptOpeningTag = match[0].split('>')[0];
                const scriptBody = match[1];

                if (/src\s*=/i.test(scriptOpeningTag)) continue;
                if (/type\s*=\s*['"]application\/(?:ld\+)?json['"]/i.test(scriptOpeningTag)) continue;
                if (!scriptBody.trim()) continue;

                const isModule = /type\s*=\s*['"]module['"]/i.test(scriptOpeningTag);
                const virtualFileName = isModule ? `${relPath}.inline_${scriptIndex}.mjs` : `${relPath}.inline_${scriptIndex}.js`;

                try {
                    const lintResults = await eslint.lintText(scriptBody, { filePath: virtualFileName });
                    if (lintResults && lintResults.length > 0) {
                        const fatalErrors = lintResults[0].messages.filter(m => m.fatal);
                        fatalErrors.forEach(m => {
                            syntaxErrors.push(`${relPath} (inline script #${scriptIndex}, line ${m.line}, col ${m.column}): ${m.message}`);
                        });
                    }
                } catch (err) {
                    syntaxErrors.push(`${relPath} (inline script #${scriptIndex}): ${err.message}`);
                }
                scriptIndex++;
            }
        }

        assert.equal(
            syntaxErrors.length,
            0,
            `Found inline script syntax errors in HTML files:\n${syntaxErrors.join('\n')}`
        );
    });

    test('zero raw <img> tags across HTML templates and JavaScript component modules', () => {
        const rawImgRegex = /<img[\s>]/i;
        const violations = [];

        const targetFiles = candidateFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            if (rel === 'js/utils/imageManager.js') return false;
            if (rel.startsWith('tests/') || rel.startsWith('scripts/')) return false;
            if (rel.endsWith('.md') || rel.endsWith('.json') || rel.endsWith('.scss') || rel.endsWith('.css')) return false;
            return rel.startsWith('partials/') || rel.startsWith('js/') || rel === 'index.html' || rel === 'hero-journey.html';
        });

        for (const file of targetFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, idx) => {
                if (rawImgRegex.test(line)) {
                    violations.push(`${relPath}:${idx + 1} -> ${line.trim()}`);
                }
            });
        }

        assert.equal(
            violations.length,
            0,
            `Found prohibited raw <img> tags. Use <orecalc-assets-image> custom element instead:\n${violations.join('\n')}`
        );
    });

    test('zero image assets placed outside assets/ directory (Rule 17 isolation)', () => {
        const imageExtensionRegex = /\.(png|jpg|jpeg|webp|avif|gif|ico)$/i;
        const allImageFiles = scanDir(projectRoot, f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            const base = path.basename(f);
            if (base === '.DS_Store' || rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.startsWith('dist/') || rel.startsWith('scratch/') || rel.startsWith('.agents/')) {
                return false;
            }
            return imageExtensionRegex.test(f);
        });

        const misplacedImages = allImageFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            return !rel.startsWith('assets/');
        });

        assert.equal(
            misplacedImages.length,
            0,
            `Found image files outside the assets/ directory violating Rule 17:\n${misplacedImages.map(f => path.relative(projectRoot, f)).join('\n')}`
        );
    });

    test('zero AI-generated, SynthID-watermarked, C2PA-manifested, or generative AI metadata in image assets (Rule 17)', () => {
        const assetsDir = path.join(projectRoot, 'assets');
        const assetFiles = scanDir(assetsDir, f => /\.(png|jpg|jpeg|webp|avif|gif|ico)$/i.test(f));
        const violations = [];

        const AI_KEYWORDS = [
            Buffer.from('synthid'), Buffer.from('synth_id'), Buffer.from('synth-id'),
            Buffer.from('c2pa'), Buffer.from('contentcredentials'), Buffer.from('jumbf'), Buffer.from('jumb'),
            Buffer.from('dall-e'), Buffer.from('dalle'), Buffer.from('midjourney'), Buffer.from('stable diffusion'),
            Buffer.from('stablediffusion'), Buffer.from('imagen'), Buffer.from('adobe firefly'), Buffer.from('firefly'),
            Buffer.from('generative ai'), Buffer.from('ai_generated'), Buffer.from('comfyui'), Buffer.from('automatic1111'),
            Buffer.from('novelai')
        ];

        for (const file of assetFiles) {
            const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
            const raw = fs.readFileSync(file);

            // 1. Binary PNG Chunk Parser
            if (raw.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
                let offset = 8;
                while (offset < raw.length - 12) {
                    const chunkLength = raw.readUInt32BE(offset);
                    const chunkType = raw.subarray(offset + 4, offset + 8).toString('ascii');
                    const chunkData = raw.subarray(offset + 8, offset + 8 + chunkLength);

                    // Flag C2PA / JUMBF chunks
                    if (['c2pa', 'caIP', 'JUMB', 'jumb', 'C2PA'].includes(chunkType)) {
                        violations.push(`${relPath}: Prohibited C2PA/JUMBF chunk detected [${chunkType}] (${chunkLength} bytes)`);
                    }

                    // Inspect text metadata chunks for AI generator signatures
                    if (['tEXt', 'zTXt', 'iTXt'].includes(chunkType)) {
                        const lowerData = Buffer.from(chunkData.toString('latin1').toLowerCase());
                        for (const kw of AI_KEYWORDS) {
                            if (lowerData.includes(kw)) {
                                violations.push(`${relPath}: Generative AI / SynthID keyword [${kw.toString()}] detected in ${chunkType} chunk`);
                            }
                        }
                    }

                    offset += 12 + chunkLength;
                }
            }

            // 2. Embedded XMP Packet Inspection
            const xmpStart = raw.indexOf(Buffer.from('<x:xmpmeta'));
            if (xmpStart !== -1) {
                const xmpEnd = raw.indexOf(Buffer.from('</x:xmpmeta>'), xmpStart);
                if (xmpEnd !== -1) {
                    const xmpBlock = raw.subarray(xmpStart, xmpEnd + 12).toString('latin1').toLowerCase();
                    for (const kw of AI_KEYWORDS) {
                        if (xmpBlock.includes(kw.toString())) {
                            violations.push(`${relPath}: Prohibited AI / SynthID tag [${kw.toString()}] found in embedded XMP metadata`);
                        }
                    }
                }
            }

            // 3. JUMBF Binary Signature Inspection
            if (raw.includes(Buffer.from('jumb\x00\x00\x00')) || raw.includes(Buffer.from('c2pa\x00\x00\x00'))) {
                violations.push(`${relPath}: Binary JUMBF/C2PA signature detected`);
            }
        }

        assert.equal(
            violations.length,
            0,
            `Found AI-generated, SynthID, or C2PA metadata violating Rule 17:\n${violations.join('\n')}`
        );
    });

    test('zero orphaned image assets in assets/ directory (Rule 17 reference check)', () => {
        const assetsDir = path.join(projectRoot, 'assets');
        const assetFiles = scanDir(assetsDir, f => /\.(png|jpg|jpeg|webp|avif|gif|ico)$/i.test(f));

        const sourceFiles = scanDir(projectRoot, f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            const base = path.basename(f);
            if (base === '.DS_Store' || rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.startsWith('dist/') || rel.startsWith('scratch/') || rel.startsWith('.agents/') || rel.startsWith('tests/')) {
                return false;
            }
            return /\.(js|mjs|cjs|ts|scss|css|html|json|xml|txt)$/.test(f);
        });

        const sourceContents = sourceFiles.map(f => ({
            rel: path.relative(projectRoot, f).replace(/\\/g, '/'),
            content: fs.readFileSync(f, 'utf8')
        }));

        const orphans = [];

        for (const file of assetFiles) {
            const filename = path.basename(file);
            const basename = path.parse(file).name;
            const relFromAssets = path.relative(assetsDir, file).replace(/\\/g, '/');
            const relFromRoot = path.relative(projectRoot, file).replace(/\\/g, '/');

            const isDynamicTH = filename.startsWith('th') && !isNaN(Number(filename.slice(2, -4)));

            const isReferenced = sourceContents.some(({ content }) => {
                if (content.includes(filename) || content.includes(relFromAssets) || content.includes(relFromRoot)) {
                    return true;
                }
                if (basename.length > 3 && content.includes(basename)) {
                    return true;
                }
                if (isDynamicTH && (content.includes('assets/th/th$') || content.includes('assets/th/th') || content.includes('assets/th/'))) {
                    return true;
                }
                return false;
            });

            if (!isReferenced) {
                orphans.push(relFromRoot);
            }
        }

        assert.equal(
            orphans.length,
            0,
            `Found orphaned image assets in assets/ without active consumers:\n${orphans.join('\n')}`
        );
    });

    test('all target="_blank" anchor elements across production HTML templates enforce secure rel attribute', () => {
        const htmlFiles = candidateFiles.filter(f => {
            const rel = path.relative(projectRoot, f).replace(/\\/g, '/');
            if (rel.startsWith('scratch/')) return false;
            return f.endsWith('.html');
        });

        const anchorRegex = /<a\s+[^>]*target=["']_blank["'][^>]*>/gi;
        const relRegex = /rel=["'][^"']*noopener[^"']*["']/i;
        const violations = [];

        for (const file of htmlFiles) {
            const relPath = path.relative(projectRoot, file);
            const content = fs.readFileSync(file, 'utf8');
            let match;
            while ((match = anchorRegex.exec(content)) !== null) {
                const tag = match[0];
                if (!relRegex.test(tag)) {
                    violations.push(`${relPath} -> ${tag}`);
                }
            }
        }

        assert.equal(
            violations.length,
            0,
            `Found target="_blank" links missing secure rel="noopener noreferrer" attribute:\n${violations.join('\n')}`
        );
    });
});
