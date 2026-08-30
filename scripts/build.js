const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { replaceInFile } = require('replace-in-file');

const { optimizeImages } = require('./build/imageOptimizer.js');
const { generateLocalizedHtml } = require('./build/htmlLocalizer.js');
const { generateSitemapXml } = require('./build/sitemapGenerator.js');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const verbose = process.argv.includes('--verbose') || process.env.VERBOSE === 'true';

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
            return processHtmlIncludes(content);
        } else {
            console.warn(`Warning: Include file not found: ${fullPath}`);
            return match;
        }
    });
}

/**
 * Resolves Git versioning metadata and commit list.
 *
 * @param {Object} packageJson - Package configuration object.
 * @returns {Promise<{ appVersion: string, commitsSinceTag: Array<{ hash: string, subject: string }> }>}
 */
async function resolveBuildMetadata(packageJson) {
    let gitHash = 'dev';
    let isTagged = false;
    let commitsSinceTag = [];
    let gitSuccess = false;

    try {
        gitHash = execSync('git rev-parse --short HEAD').toString().trim();

        if (process.env.TAG_NAME || process.env.STABLE === 'true') {
            isTagged = true;
        } else {
            try {
                const gitTag = execSync('git describe --tags --exact-match HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
                isTagged = !!gitTag;
            } catch (e) {}
        }

        let lastTag = '';
        try {
            const excludeTagOption = isTagged ? 'HEAD~1' : 'HEAD';
            lastTag = execSync(`git describe --tags --abbrev=0 ${excludeTagOption}`).toString().trim();
        } catch (e) {}

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
        console.log('[INFO] Local git metadata unavailable, querying GitHub API...');
    }

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
    return { appVersion, commitsSinceTag };
}

/**
 * Orchestrates the full production build pipeline.
 *
 * @returns {Promise<void>}
 */
async function build() {
    try {
        console.log('--- Cleaning dist directory ---');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        }
        fs.mkdirSync(distDir, { recursive: true });
        console.log('[OK] dist directory cleaned.');

        console.log('\n--- Copying and compiling files ---');

        let indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
        indexHtml = processHtmlIncludes(indexHtml);

        const packageJson = require('../package.json');
        const { appVersion, commitsSinceTag } = await resolveBuildMetadata(packageJson);
        const baseUrl = process.env.VITE_API_BASE_URL || 'https://api.orecalc.tech';
        const buildTime = process.env.BUILD_TIME || new Date().toISOString();

        indexHtml = indexHtml.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${baseUrl}", APP_VERSION: "${appVersion}", BUILD_TIME: "${buildTime}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);
        indexHtml = indexHtml.replace(/src="js\/app\.js(\?v=[^"]+)?"/g, `src="js/app.js?v=${encodeURIComponent(appVersion)}"`);
        indexHtml = indexHtml.replace(/href="js\/app\.js(\?v=[^"]+)?"/g, `href="js/app.js?v=${encodeURIComponent(appVersion)}"`);

        console.log(`[OK] Injected build parameters (v${appVersion}, commits: ${commitsSinceTag.length}) into index.html head.`);

        indexHtml = indexHtml.replace(/<link rel="modulepreload" href="js\/(?!app\.js)[^"]+">\s*/g, '');

        const copyEntries = [
            { src: 'assets', dest: 'assets' },
            { src: 'js/i18n', dest: 'js/i18n' },
            { src: 'js/data', dest: 'js/data' },
            { src: 'manifest.json', dest: 'manifest.json' },
            { src: 'sitemap.xml', dest: 'sitemap.xml' },
            { src: 'robots.txt', dest: 'robots.txt' },
            { src: 'llms.txt', dest: 'llms.txt' },
            { src: '404.html', dest: '404.html' },
            { src: 'legal/legal.js', dest: 'legal/legal.js' },
            { src: 'legal/licenses', dest: 'licenses' },
            { src: '.well-known', dest: '.well-known' },
            { src: '_redirects', dest: '_redirects' },
            { src: '_headers', dest: '_headers' }
        ];

        for (const entry of copyEntries) {
            const srcPath = path.join(projectRoot, entry.src);
            const destPath = path.join(distDir, entry.dest);
            if (fs.existsSync(srcPath)) {
                fs.cpSync(srcPath, destPath, { recursive: true, force: true });
                if (verbose) {
                    console.log(`Copied: ${srcPath} -> ${destPath}`);
                }
            }
        }

        const jsDestDir = path.join(distDir, 'js');
        if (!fs.existsSync(jsDestDir)) {
            fs.mkdirSync(jsDestDir, { recursive: true });
        }

        console.log('--- Bundling JS with esbuild ---');
        const esbuildBundleCmd = `npx esbuild "${path.join(projectRoot, 'js/app.js')}" "${path.join(projectRoot, 'js/heroJourneyApp.js')}" --bundle --outdir="${jsDestDir}" --format=esm --splitting --minify`;
        execSync(esbuildBundleCmd, { stdio: verbose ? 'inherit' : 'ignore' });

        const esbuildQrCmd = `npx esbuild "${path.join(projectRoot, 'js/qr-code-styling.js')}" --minify --outfile="${path.join(jsDestDir, 'qr-code-styling.js')}"`;
        execSync(esbuildQrCmd, { stdio: verbose ? 'inherit' : 'ignore' });

        const { getDynamicTranslationArgs } = await import('../js/i18n/i18nParams.js');

        let supportedLanguages = ['en', 'de', 'tr', 'zh'];
        try {
            const languagesDataFile = fs.readFileSync(path.join(projectRoot, 'js/data/languagesData.js'), 'utf8');
            const matches = [...languagesDataFile.matchAll(/code:\s*'([a-z0-9-]+)'[^}]*enabled:\s*true/g)].map(m => m[1]);
            if (matches.length > 0) {
                supportedLanguages = matches;
            }
        } catch (e) {
            console.warn('Could not parse languagesData.js dynamically, using fallback supported languages');
        }

        for (const lang of supportedLanguages) {
            if (lang === 'en') continue;
            const langDir = path.join(distDir, lang);
            if (!fs.existsSync(langDir)) {
                fs.mkdirSync(langDir, { recursive: true });
            }
            const localizedHtml = generateLocalizedHtml(indexHtml, lang, supportedLanguages, false, getDynamicTranslationArgs, projectRoot);
            fs.writeFileSync(path.join(langDir, 'index.html'), localizedHtml, 'utf8');
            console.log(`Generated localized route: dist/${lang}/index.html`);
        }

        const hjSrcPath = path.join(projectRoot, 'hero-journey.html');
        if (fs.existsSync(hjSrcPath)) {
            let hjHtml = fs.readFileSync(hjSrcPath, 'utf8');
            hjHtml = processHtmlIncludes(hjHtml);
            hjHtml = hjHtml.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${baseUrl}", APP_VERSION: "${appVersion}", BUILD_TIME: "${buildTime}", COMMITS_SINCE_TAG: ${JSON.stringify(commitsSinceTag)} };</script>`);
            hjHtml = hjHtml.replace(/src="\/?js\/heroJourneyApp\.js(\?v=[^"]+)?"/g, `src="/js/heroJourneyApp.js?v=${encodeURIComponent(appVersion)}"`);
            hjHtml = hjHtml.replace(/href="\/?css\/hero-journey(\.min)?\.css(\?v=[^"]+)?"/g, `href="/css/hero-journey.min.css?v=${encodeURIComponent(appVersion)}"`);
            hjHtml = hjHtml.replace(/href="\/?css\/main(\.min)?\.css(\?v=[^"]+)?"/g, `href="/css/main.min.css?v=${encodeURIComponent(appVersion)}"`);

            const hjDestDir = path.join(distDir, 'hero-journey');
            fs.mkdirSync(hjDestDir, { recursive: true });
            fs.writeFileSync(path.join(hjDestDir, 'index.html'), hjHtml, 'utf8');
            console.log('Generated root tool route: dist/hero-journey/index.html');

            for (const lang of supportedLanguages) {
                if (lang === 'en') continue;
                const langHjDir = path.join(distDir, lang, 'hero-journey');
                fs.mkdirSync(langHjDir, { recursive: true });
                const localizedHjHtml = generateLocalizedHtml(hjHtml, lang, supportedLanguages, false, getDynamicTranslationArgs, projectRoot, 'hero-journey');
                fs.writeFileSync(path.join(langHjDir, 'index.html'), localizedHjHtml, 'utf8');
                console.log(`Generated localized tool route: dist/${lang}/hero-journey/index.html`);
            }
        }

        const legalPages = [
            { name: 'privacy', srcEn: 'legal/privacy-en.html', srcDe: 'legal/privacy-de.html' },
            { name: 'terms', srcEn: 'legal/terms-en.html', srcDe: 'legal/terms-de.html' },
            { name: 'licenses', srcEn: 'legal/licenses.html', srcDe: null }
        ];

        for (const page of legalPages) {
            const srcPathEn = path.join(projectRoot, page.srcEn);
            if (fs.existsSync(srcPathEn)) {
                let htmlEn = fs.readFileSync(srcPathEn, 'utf8');
                const canonicalUrlEn = `https://orecalc.tech/${page.name}/`;
                if (htmlEn.includes('<link rel="canonical"')) {
                    htmlEn = htmlEn.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalUrlEn}">`);
                } else {
                    htmlEn = htmlEn.replace('</head>', `    <link rel="canonical" href="${canonicalUrlEn}">\n</head>`);
                }
                const pageDestDirEn = path.join(distDir, page.name);
                fs.mkdirSync(pageDestDirEn, { recursive: true });
                fs.writeFileSync(path.join(pageDestDirEn, 'index.html'), htmlEn, 'utf8');
                console.log(`Generated root legal page route: dist/${page.name}/index.html`);
            }

            if (page.srcDe) {
                const srcPathDe = path.join(projectRoot, page.srcDe);
                if (fs.existsSync(srcPathDe)) {
                    let htmlDe = fs.readFileSync(srcPathDe, 'utf8');
                    const canonicalUrlDe = `https://orecalc.tech/de/${page.name}/`;
                    if (htmlDe.includes('<link rel="canonical"')) {
                        htmlDe = htmlDe.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalUrlDe}">`);
                    } else {
                        htmlDe = htmlDe.replace('</head>', `    <link rel="canonical" href="${canonicalUrlDe}">\n</head>`);
                    }
                    const pageDestDirDe = path.join(distDir, 'de', page.name);
                    fs.mkdirSync(pageDestDirDe, { recursive: true });
                    fs.writeFileSync(path.join(pageDestDirDe, 'index.html'), htmlDe, 'utf8');
                    console.log(`Generated German legal page route: dist/de/${page.name}/index.html`);
                }
            }
        }

        const defaultHtml = generateLocalizedHtml(indexHtml, 'en', supportedLanguages, true, getDynamicTranslationArgs, projectRoot);
        fs.writeFileSync(path.join(distDir, 'index.html'), defaultHtml, 'utf8');
        console.log(`Compiled and bundled index.html for root and language routes.`);

        const sitemapXml = generateSitemapXml(supportedLanguages);
        fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
        console.log('Generated dynamic dist/sitemap.xml for enabled languages.');

        const libsDestDir = path.join(distDir, 'js');
        const libsSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
        const libsDest = path.join(libsDestDir, 'workbox-window.js');
        fs.copyFileSync(libsSource, libsDest);

        const mapSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js.map');
        const mapDest = path.join(libsDestDir, 'workbox-window.prod.umd.js.map');
        if (fs.existsSync(mapSource)) {
            fs.copyFileSync(mapSource, mapDest);
        }

        if (verbose) {
            console.log(`Copied: ${libsSource} -> ${libsDest}`);
        }
        console.log('File copying complete.');

        console.log('\n--- Optimizing images ---');
        await optimizeImages(distDir, verbose);

        console.log('\n--- Updating HTML for production ---');
        await replaceInFile({
            files: [path.join(distDir, 'index.html'), path.join(distDir, '**/index.html')],
            from: /css\/main\.css/g,
            to: 'css/main.min.css',
        });
        console.log('[OK] Production stylesheet references updated.');

        console.log('\n[SUCCESS] Production build completed successfully.\n');

    } catch (error) {
        console.error('\n[ERROR] Production build failed:');
        console.error(error);
        process.exit(1);
    }
}

build();
