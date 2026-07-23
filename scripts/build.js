const fs = require('fs');
const path = require('path');
const cpx = require('cpx');
const sharp = require('sharp');
const { replaceInFile } = require('replace-in-file');
const { minify } = require('terser');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const verbose = process.argv.includes('--verbose') || process.env.VERBOSE === 'true';

/**
 * Helper utility that wraps `cpx.copy` inside a Promise to enable asynchronous
 * async/await control flow during build copy steps.
 *
 * @param {string} source - The source file glob pattern (e.g. 'assets/glob-patterns').
 * @param {string} dest - The destination folder path.
 * @returns {Promise<void>} Resolves when copy is complete, or rejects with an error.
 */
function copyWithPromise(source, dest) {
    return new Promise((resolve, reject) => {
        cpx.copy(source, dest, (err) => {
            if (err) {
                return reject(err);
            }
            if (verbose) {
                console.log(`Copied: ${source} -> ${dest}`);
            }
            resolve();
        });
    });
}

let includeCount = 0;

/**
 * Recursively parses HTML content to locate and resolve custom include directives.
 * Replaces comments of format `<!-- include: partials/file.html -->` with actual contents.
 *
 * @param {string} htmlContent - The raw HTML content containing potential include tags.
 * @returns {string} The fully compiled HTML content with all includes recursively injected.
 */
function processHtmlIncludes(htmlContent) {
    return htmlContent.replace(/<!--\s*include:\s*(.*?)\s*-->/g, (match, filePath) => {
        const fullPath = path.join(projectRoot, filePath.trim());
        if (fs.existsSync(fullPath)) {
            includeCount++;
            if (verbose) {
                console.log(`Including: ${fullPath}`);
            }
            let content = fs.readFileSync(fullPath, 'utf8');
            // Recursively process includes in the partials themselves (enables nested include structures)
            return processHtmlIncludes(content);
        } else {
            console.warn(`Warning: Include file not found: ${fullPath}`);
            return match;
        }
    });
}

/**
 * Recursively traverses a directory, minifying all .js files using Terser
 * and writing them to the destination directory.
 *
 * @param {string} srcDir - Source directory.
 * @param {string} destDir - Destination directory.
 * @returns {Promise<void>}
 */
async function minifyJSDirectory(srcDir, destDir) {
    const files = fs.readdirSync(srcDir, { recursive: true });
    let minifiedCount = 0;
    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
        } else if (file.endsWith('.js')) {
            const code = fs.readFileSync(srcPath, 'utf8');
            try {
                const minified = await minify(code, {
                    mangle: true,
                    compress: {
                        dead_code: true,
                        conditionals: true,
                        evaluate: true,
                        booleans: true,
                        loops: true,
                        unused: true,
                        hoist_funs: true,
                        keep_fargs: false,
                        pure_getters: true
                    }
                });
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.writeFileSync(destPath, minified.code, 'utf8');
                minifiedCount++;
            } catch (err) {
                console.error(`Error minifying ${file}:`, err);
                // Fallback to copying as-is if minification fails
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
    if (verbose) {
        console.log(`Minified ${minifiedCount} JS files in: ${srcDir} -> ${destDir}`);
    }
}

/**
 * Orchestrates the full production build pipeline.
 * It performs the following sequential actions:
 * 1. Cleans and recreates the `dist` directory.
 * 2. Compiles `index.html` by recursively applying HTML includes and injecting backend ENV configuration.
 * 3. Copies all assets, scripts, translations, manifest/sitemap, and third-party vendor libraries (e.g. Workbox).
 * 4. Optimizes and generates modern formats (AVIF, WebP) for static assets.
 * 5. Rewrites script/link tags (e.g. mapping main.css to main.min.css) for production.
 *
 * @returns {Promise<void>}
 */
async function build() {
    try {
        // 1. Clean
        console.log('--- Cleaning dist directory ---');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(distDir, { recursive: true });
        console.log('Cleaning complete.');

        // 3. Copy and Compile files
        console.log('\n--- Copying and compiling files ---');
        
        // Load and process index.html
        let indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
        indexHtml = processHtmlIncludes(indexHtml);
        
        const packageJson = require('../package.json');
        let gitHash = 'dev';
        let isTagged = false;
        let commitsSinceTag = [];
        let gitSuccess = false;

        // 1. Try local Git first
        try {
            const { execSync } = require('child_process');
            gitHash = execSync('git rev-parse --short HEAD').toString().trim();
            
            if (process.env.TAG_NAME || process.env.STABLE === 'true') {
                isTagged = true;
            } else {
                try {
                    const gitTag = execSync('git describe --tags --exact-match HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
                    isTagged = !!gitTag;
                } catch (e) {
                    // not exactly tagged
                }
            }

            let lastTag = '';
            try {
                const excludeTagOption = isTagged ? 'HEAD~1' : 'HEAD';
                lastTag = execSync(`git describe --tags --abbrev=0 ${excludeTagOption}`).toString().trim();
            } catch (e) {
                // No tag exists
            }

            const range = lastTag ? `${lastTag}..HEAD` : '';
            const logCmd = range 
                ? `git log ${range} --pretty=format:"%h|%at|%s"` 
                : `git log -n 10 --pretty=format:"%h|%at|%s"`;
            const logOutput = execSync(logCmd).toString().trim();

            if (logOutput) {
                const lines = logOutput.split('\n');
                const commits = lines.map(line => {
                    const parts = line.split('|');
                    const hash = parts[0];
                    const timestamp = parseInt(parts[1], 10) * 1000;
                    const subject = parts.slice(2).join('|');
                    return { hash, timestamp, subject };
                });

                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const commitsInLastWeek = commits.filter(c => c.timestamp >= oneWeekAgo);
                
                let selectedCommits = [];
                if (commitsInLastWeek.length >= 3) {
                    selectedCommits = commitsInLastWeek;
                } else {
                    selectedCommits = commits.slice(0, Math.min(3, commits.length));
                }
                commitsSinceTag = selectedCommits.map(c => ({ hash: c.hash, subject: c.subject }));
            }
            gitSuccess = true;
        } catch (localGitError) {
            console.log('Local git commands failed or .git folder not present. Falling back to GitHub API lookup...');
        }

        // 2. Fallback to GitHub API
        if (!gitSuccess) {
            try {
                const commitsResponse = await fetch('https://api.github.com/repos/abhis-s/oreCalc/commits?per_page=10', {
                    headers: { 'User-Agent': 'oreCalc-build-script' }
                });

                if (commitsResponse.ok) {
                    const ghCommits = await commitsResponse.json();
                    if (ghCommits && ghCommits.length > 0) {
                        gitHash = ghCommits[0].sha.substring(0, 7);
                        
                        const parsedCommits = ghCommits.map(c => ({
                            hash: c.sha.substring(0, 7),
                            timestamp: new Date(c.commit.committer.date).getTime(),
                            subject: c.commit.message.split('\n')[0]
                        }));

                        let latestTagSha = '';
                        try {
                            const tagsResponse = await fetch('https://api.github.com/repos/abhis-s/oreCalc/tags', {
                                headers: { 'User-Agent': 'oreCalc-build-script' }
                            });
                            if (tagsResponse.ok) {
                                const tags = await tagsResponse.json();
                                if (tags && tags.length > 0) {
                                    latestTagSha = tags[0].commit.sha;
                                }
                            }
                        } catch (tagError) {
                            console.warn('Failed to fetch tags from GitHub API:', tagError);
                        }

                        let selectedCommits = [];
                        if (latestTagSha) {
                            const tagIndex = parsedCommits.findIndex(c => c.hash === latestTagSha.substring(0, 7));
                            if (tagIndex !== -1) {
                                selectedCommits = parsedCommits.slice(0, tagIndex);
                            }
                        }

                        if (selectedCommits.length === 0) {
                            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                            const commitsInLastWeek = parsedCommits.filter(c => c.timestamp >= oneWeekAgo);
                            if (commitsInLastWeek.length >= 3) {
                                selectedCommits = commitsInLastWeek;
                            } else {
                                selectedCommits = parsedCommits.slice(0, Math.min(3, parsedCommits.length));
                            }
                        }

                        commitsSinceTag = selectedCommits.map(c => ({ hash: c.hash, subject: c.subject }));
                    }
                } else {
                    console.warn(`GitHub API request failed with status: ${commitsResponse.status}`);
                }
            } catch (apiError) {
                console.warn('Failed to fetch versioning and commit data from GitHub API:', apiError);
            }
        }

        if (process.env.TAG_NAME || process.env.STABLE === 'true') {
            isTagged = true;
        }
        const appVersion = isTagged ? packageJson.version : `${packageJson.version}+${gitHash}`;
        const baseUrl = process.env.VITE_API_BASE_URL || 'https://api.orecalc.tech';

        indexHtml = indexHtml.replace('<head>', `<head>\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${baseUrl}", APP_VERSION: "${appVersion}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);
        console.log(`Injected VITE_API_BASE_URL (${baseUrl}), APP_VERSION (${appVersion}), and COMMITS_SINCE_TAG (${commitsSinceTag.length} commits) into index.html head.`);
        
        // Strip other module preloads to avoid 404s for files that are now bundled inside chunk files
        indexHtml = indexHtml.replace(/<link rel="modulepreload" href="js\/(?!app\.js)[^"]+">\s*/g, '');

        await Promise.all([
            copyWithPromise(path.join(projectRoot, 'assets/**/*.*'), path.join(distDir, 'assets')),
            copyWithPromise(path.join(projectRoot, 'js/i18n/**/*.json'), path.join(distDir, 'js/i18n')),
            copyWithPromise(path.join(projectRoot, 'js/data/licensesData.js'), path.join(distDir, 'js/data')),
            copyWithPromise(path.join(projectRoot, 'manifest.json'), distDir),
            copyWithPromise(path.join(projectRoot, 'sitemap.xml'), distDir),
            copyWithPromise(path.join(projectRoot, 'robots.txt'), distDir),
            copyWithPromise(path.join(projectRoot, 'llms.txt'), distDir),
            copyWithPromise(path.join(projectRoot, 'terms.html'), distDir),
            copyWithPromise(path.join(projectRoot, 'privacy.html'), distDir),
            copyWithPromise(path.join(projectRoot, 'licenses.html'), distDir),
            copyWithPromise(path.join(projectRoot, '404.html'), distDir),
            copyWithPromise(path.join(projectRoot, 'terms/**/*.html'), path.join(distDir, 'terms')),
            copyWithPromise(path.join(projectRoot, 'privacy/**/*.html'), path.join(distDir, 'privacy')),
            copyWithPromise(path.join(projectRoot, 'licenses/**/*.txt'), path.join(distDir, 'licenses')),
            copyWithPromise(path.join(projectRoot, '.well-known/*'), path.join(distDir, '.well-known'))
        ]);
        
        const jsDestDir = path.join(distDir, 'js');
        if (!fs.existsSync(jsDestDir)) {
            fs.mkdirSync(jsDestDir, { recursive: true });
        }

        // Bundling JS with esbuild
        const { execSync } = require('child_process');
        console.log('--- Bundling JS with esbuild ---');
        
        // Bundle main app entry point
        const esbuildAppCmd = `npx esbuild "${path.join(projectRoot, 'js/app.js')}" --bundle --outdir="${jsDestDir}" --format=esm --splitting --minify`;
        execSync(esbuildAppCmd, { stdio: verbose ? 'inherit' : 'ignore' });
        
        // Minify and copy qr-code-styling.js
        const esbuildQrCmd = `npx esbuild "${path.join(projectRoot, 'js/qr-code-styling.js')}" --minify --outfile="${path.join(jsDestDir, 'qr-code-styling.js')}"`;
        execSync(esbuildQrCmd, { stdio: verbose ? 'inherit' : 'ignore' });
        
        // Write index.html for root and each supported language route (/en/, /de/, /tr/)
        const localesMap = { en: 'en_US', de: 'de_DE', tr: 'tr_TR' };
        function getNestedValue(obj, keyPath) {
            return keyPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
        }
        function generateLocalizedHtml(baseHtml, lang) {
            const i18nFilePath = path.join(projectRoot, `js/i18n/${lang}.json`);
            if (!fs.existsSync(i18nFilePath)) {
                return baseHtml;
            }
            const translations = JSON.parse(fs.readFileSync(i18nFilePath, 'utf8'));
            const title = translations.app?.title || 'Clash of Clans Ore Calculator & Equipment Planner | OreCalc';
            const description = translations.app?.description || '';
            const locale = localesMap[lang] || `${lang}_${lang.toUpperCase()}`;
            const url = `https://orecalc.tech/${lang}/`;

            let html = baseHtml;
            html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`);
            html = html.replace(/<title[^>]*>.*?<\/title>/s, `<title data-i18n="app.title">${title}</title>`);
            html = html.replace(/<meta name="description"\s+content="[^"]*">/s, `<meta name="description" content="${description}">`);
            html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
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
            html = html.replace(/<([a-z1-6]+)([^>]*?)\s+data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tagName, attrsBefore, key, attrsAfter, innerContent) => {
                let val = getNestedValue(translations, key);
                if (typeof val === 'string' && val.trim()) {
                    if (key === 'settings.bugReportInfo') {
                        val = val.replace('{link}', '<a href="https://github.com/abhis-s/oreCalc/issues" target="_blank" rel="noopener noreferrer" class="theme-link">GitHub Issues</a>');
                    } else if (key === 'settings.bugReportPrivacyInfo') {
                        const privacyText = getNestedValue(translations, 'settings.privacyPolicyText') || 'Privacy Policy';
                        val = val.replace('{link}', `<a href="#" id="bug-report-privacy-link" class="theme-link">${privacyText}</a>`);
                    }
                    return `<${tagName}${attrsBefore} data-i18n="${key}"${attrsAfter}>${val}</${tagName}>`;
                }
                return match;
            });

            return html;
        }

        const supportedLanguages = ['en', 'de', 'tr'];
        for (const lang of supportedLanguages) {
            const langDir = path.join(distDir, lang);
            if (!fs.existsSync(langDir)) {
                fs.mkdirSync(langDir, { recursive: true });
            }
            const localizedHtml = generateLocalizedHtml(indexHtml, lang);
            fs.writeFileSync(path.join(langDir, 'index.html'), localizedHtml, 'utf8');
            console.log(`Generated localized route: dist/${lang}/index.html`);
        }

        // Build legal pages with uniform language subdirectories (/en/, /de/, /tr/)
        const legalPages = [
            { name: 'privacy', srcEn: 'privacy.html', srcDe: 'privacy/de/index.html' },
            { name: 'terms', srcEn: 'terms.html', srcDe: 'terms/de/index.html' },
            { name: 'licenses', srcEn: 'licenses.html', srcDe: 'licenses.html' }
        ];

        for (const page of legalPages) {
            for (const lang of supportedLanguages) {
                let srcFile = page.srcEn;
                let canonicalUrl = `https://orecalc.tech/${lang}/${page.name}`;
                
                if (lang === 'de' && page.srcDe) {
                    srcFile = page.srcDe;
                } else if (lang === 'tr') {
                    // Turkish uses English legal document with canonical link pointing to /en/page
                    srcFile = page.srcEn;
                    canonicalUrl = `https://orecalc.tech/en/${page.name}`;
                }

                const srcPath = path.join(projectRoot, srcFile);
                if (!fs.existsSync(srcPath)) continue;

                let html = fs.readFileSync(srcPath, 'utf8');

                if (html.includes('<link rel="canonical"')) {
                    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalUrl}">`);
                } else {
                    html = html.replace('</head>', `    <link rel="canonical" href="${canonicalUrl}">\n</head>`);
                }

                const pageDestDir = path.join(distDir, lang, page.name);
                fs.mkdirSync(pageDestDir, { recursive: true });
                fs.writeFileSync(path.join(pageDestDir, 'index.html'), html, 'utf8');
                console.log(`Generated legal page route: dist/${lang}/${page.name}/index.html`);
            }
        }

        const defaultHtml = generateLocalizedHtml(indexHtml, 'en');
        fs.writeFileSync(path.join(distDir, 'index.html'), defaultHtml, 'utf8');
        console.log(`Compiled and bundled index.html for root and language routes.`);
        
        const libsDestDir = path.join(distDir, 'js');
        const libsSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
        const libsDest = path.join(libsDestDir, 'workbox-window.js');
        fs.copyFileSync(libsSource, libsDest);

        // Also copy the source map to prevent 404 console warnings in devtools
        const mapSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js.map');
        const mapDest = path.join(libsDestDir, 'workbox-window.prod.umd.js.map');
        if (fs.existsSync(mapSource)) {
            fs.copyFileSync(mapSource, mapDest);
        }

        if (verbose) {
            console.log(`Copied: ${libsSource} -> ${libsDest}`);
        }
        console.log('File copying complete.');

        // 4. Optimize Images
        console.log('\n--- Optimizing images ---');
        const assetsDir = path.join(distDir, 'assets');
        const imageFiles = fs.readdirSync(assetsDir, { recursive: true });
        
        // PNGs to keep for PWA/manifest support (needs standard formats for OS compatibility)
        const keepPngs = [
            'app_icon_small.png',
            'app_icon_large.png',
            'favicon.png',
            'screenshot_desktop.png',
            'screenshot_mobile.png'
        ];

        let resizedCount = 0;
        let keepPngCount = 0;
        let convertedCount = 0;

        const tasks = [];
        for (const file of imageFiles) {
            tasks.push(async () => {
                const fullPath = path.join(assetsDir, file.toString());
                const fileName = path.basename(fullPath);

                if (fullPath.endsWith('.png') && fs.statSync(fullPath).isFile()) {
                     const isSubfolder = path.dirname(fullPath) !== assetsDir;
                     const baseName = fullPath.substring(0, fullPath.lastIndexOf('.'));

                     if (isSubfolder) {
                         // Generate 100px and 200px sizes
                         // WebP Thumbnail (100px)
                         await sharp(fullPath).resize(100, 100).webp({ quality: 80 }).toFile(`${baseName}-100.webp`);
                         // AVIF Thumbnail (100px)
                         await sharp(fullPath).resize(100, 100).avif({ quality: 65, effort: 6 }).toFile(`${baseName}-100.avif`);

                         // WebP Standard (200px)
                         await sharp(fullPath).resize(200, 200).webp({ quality: 80 }).toFile(`${baseName}-200.webp`);
                         // AVIF Standard (200px)
                         await sharp(fullPath).resize(200, 200).avif({ quality: 65, effort: 6 }).toFile(`${baseName}-200.avif`);

                         // Delete original PNG
                         fs.unlinkSync(fullPath);
                         resizedCount++;
                         if (verbose) {
                             console.log(`Converted & Resized: ${file}`);
                         }
                     } else {
                         // Top level PNG (like shiny_ore.png)
                         if (keepPngs.includes(fileName)) {
                             // Keep manifest icons, but optimize their PNG size and also generate webp/avif copies
                             await sharp(fullPath).webp({ quality: 80 }).toFile(`${baseName}.webp`);
                             await sharp(fullPath).avif({ quality: 65, effort: 6 }).toFile(`${baseName}.avif`);
                             keepPngCount++;
                             if (verbose) {
                                 console.log(`Generated AVIF/WebP copy and kept PNG: ${fileName}`);
                             }
                         } else {
                             // Convert and delete original PNG
                             await sharp(fullPath).resize({ width: 150, height: 150, fit: 'inside' }).webp({ quality: 80 }).toFile(`${baseName}.webp`);
                             await sharp(fullPath).resize({ width: 150, height: 150, fit: 'inside' }).avif({ quality: 65, effort: 6 }).toFile(`${baseName}.avif`);
                             fs.unlinkSync(fullPath);
                             convertedCount++;
                             if (verbose) {
                                 console.log(`Converted to AVIF/WebP, resized to max 150px & deleted PNG: ${fileName}`);
                             }
                         }
                     }
                }
            });
        }

        // Concurrency-controlled execution pool (concurrency limit = 8)
        // Helps avoid overwhelming memory/CPU usage during massive concurrent image resizing/conversion.
        // It maintains a running Set of active promises, using Promise.race to block iteration until at least
        // one running task resolves when the limit is hit.
        const concurrencyLimit = 8;
        const executing = new Set();
        for (const task of tasks) {
            const p = Promise.resolve().then(() => task());
            executing.add(p);
            const clean = () => executing.delete(p);
            p.then(clean, clean);
            if (executing.size >= concurrencyLimit) {
                await Promise.race(executing);
            }
        }
        await Promise.all(executing);
        console.log(`Image optimization complete: Resized ${resizedCount} equipment/resource items, converted ${convertedCount} top-level images, and generated alternative formats for ${keepPngCount} PWA icons.`);

        // 5. Replace CSS path in HTML
        console.log('\n--- Updating HTML for production ---');
        await replaceInFile({
            files: [path.join(distDir, 'index.html'), path.join(distDir, '**/index.html')],
            from: /css\/main\.css/g,
            to: 'css/main.min.css',
        });
        console.log('HTML updated.');

        console.log('\n--- Build process completed successfully! ---');

    } catch (error) {
        console.error('\n--- Build process failed! ---');
        console.error(error);
        process.exit(1);
    }
}

build();