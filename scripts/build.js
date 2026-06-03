const fs = require('fs');
const path = require('path');
const cpx = require('cpx');
const sharp = require('sharp');
const { replaceInFile } = require('replace-in-file');

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
        
        const baseUrl = process.env.VITE_API_BASE_URL;
        if (baseUrl) {
            indexHtml = indexHtml.replace('<head>', `<head>\n    <script>window.__ENV__ = { VITE_API_BASE_URL: "${baseUrl}" };</script>`);
            console.log(`Injected VITE_API_BASE_URL (${baseUrl}) into index.html head.`);
        }
        
        fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf8');
        console.log(`Compiled index.html with ${includeCount} HTML partial includes.`);

        await Promise.all([
            copyWithPromise(path.join(projectRoot, 'assets/**/*.*'), path.join(distDir, 'assets')),
            copyWithPromise(path.join(projectRoot, 'js/**/*.js'), path.join(distDir, 'js')),
            copyWithPromise(path.join(projectRoot, 'js/i18n/**/*.json'), path.join(distDir, 'js/i18n')),
            copyWithPromise(path.join(projectRoot, 'manifest.json'), distDir),
            copyWithPromise(path.join(projectRoot, 'sitemap.xml'), distDir),
            copyWithPromise(path.join(projectRoot, 'terms.html'), distDir),
            copyWithPromise(path.join(projectRoot, 'privacy.html'), distDir),
            copyWithPromise(path.join(projectRoot, 'terms/**/*.html'), path.join(distDir, 'terms')),
            copyWithPromise(path.join(projectRoot, 'privacy/**/*.html'), path.join(distDir, 'privacy')),
            copyWithPromise(path.join(projectRoot, '.well-known/*'), path.join(distDir, '.well-known'))
        ]);
        
        const libsDestDir = path.join(distDir, 'js');
        const libsSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
        const libsDest = path.join(libsDestDir, 'workbox-window.js');
        fs.copyFileSync(libsSource, libsDest);
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
                         // Generate 72px and 200px sizes
                         // WebP Thumbnail (72px)
                         await sharp(fullPath).resize(72, 72).webp({ quality: 80 }).toFile(`${baseName}-72.webp`);
                         // AVIF Thumbnail (72px)
                         await sharp(fullPath).resize(72, 72).avif({ quality: 65, effort: 6 }).toFile(`${baseName}-72.avif`);

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
                             await sharp(fullPath).webp({ quality: 80 }).toFile(`${baseName}.webp`);
                             await sharp(fullPath).avif({ quality: 65, effort: 6 }).toFile(`${baseName}.avif`);
                             fs.unlinkSync(fullPath);
                             convertedCount++;
                             if (verbose) {
                                 console.log(`Converted to AVIF/WebP & deleted PNG: ${fileName}`);
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
            files: path.join(distDir, 'index.html'),
            from: 'css/main.css',
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