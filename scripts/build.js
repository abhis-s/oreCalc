const fs = require('fs');
const path = require('path');
const cpx = require('cpx');
const sharp = require('sharp');
const { replaceInFile } = require('replace-in-file');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

// Helper to wrap cpx in a promise
function copyWithPromise(source, dest) {
    return new Promise((resolve, reject) => {
        cpx.copy(source, dest, (err) => {
            if (err) {
                return reject(err);
            }
            console.log(`Copied: ${source} -> ${dest}`);
            resolve();
        });
    });
}

async function build() {
    try {
        // 1. Clean
        console.log('--- Cleaning dist directory ---');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(distDir, { recursive: true });
        console.log('Cleaning complete.');

        // 2. Inject Environment Variables
        console.log('\n--- Injecting environment variables ---');
        const baseUrl = process.env.VITE_API_BASE_URL;
        if (!baseUrl) {
            console.error('Error: VITE_API_BASE_URL environment variable is not set.');
            process.exit(1);
        }
        const apiServicePath = path.join(projectRoot, 'js/services/apiService.js');
        let apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');
        apiServiceContent = apiServiceContent.replace('__VITE_API_BASE_URL__', baseUrl);
        fs.writeFileSync(apiServicePath, apiServiceContent, 'utf8');
        console.log(`Injected VITE_API_BASE_URL into ${apiServicePath}`);

        // 3. Copy files
        console.log('\n--- Copying files ---');
        await copyWithPromise(path.join(projectRoot, 'index.html'), distDir);
        await copyWithPromise(path.join(projectRoot, 'assets/**/*.*'), path.join(distDir, 'assets'));
        await copyWithPromise(path.join(projectRoot, 'js/**/*.js'), path.join(distDir, 'js'));
        await copyWithPromise(path.join(projectRoot, 'js/i18n/**/*.json'), path.join(distDir, 'js/i18n'));
        await copyWithPromise(path.join(projectRoot, 'manifest.json'), distDir);
        await copyWithPromise(path.join(projectRoot, '.well-known/*'), path.join(distDir, '.well-known'));
        
        const libsDestDir = path.join(distDir, 'js');
        const libsSource = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
        const libsDest = path.join(libsDestDir, 'workbox-window.js');
        fs.copyFileSync(libsSource, libsDest);
        console.log(`Copied: ${libsSource} -> ${libsDest}`);
        console.log('File copying complete.');

        // 4. Optimize Images
        console.log('\n--- Optimizing images ---');
        const assetsDir = path.join(distDir, 'assets');
        const imageFiles = fs.readdirSync(assetsDir, { recursive: true });
        for (const file of imageFiles) {
            const fullPath = path.join(assetsDir, file.toString());
            if (fullPath.endsWith('.png') && fs.statSync(fullPath).isFile()) {
                 if (path.dirname(fullPath) !== assetsDir) { // Skip top-level PNGs
                    await sharp(fullPath)
                        .resize(200, 200)
                        .png({ compressionLevel: 9, quality: 100 })
                        .toBuffer()
                        .then(buffer => fs.writeFileSync(fullPath, buffer));
                    console.log(`Optimized: ${fullPath}`);
                 } else {
                    console.log(`Skipping top-level PNG: ${fullPath}`);
                 }
            }
        }
        console.log('Image optimization complete.');

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