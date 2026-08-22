const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assetsDir = path.resolve(__dirname, '../../assets');

// Files that should not be resized (but can be optimized)
const skipResizeList = [
    'app_icon_small.png',
    'app_icon_large.png',
    'favicon.png',
    'screenshot_desktop.png',
    'screenshot_mobile.png'
];

function getFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else if (name.endsWith('.png')) {
            files.push(name);
        }
    }
    return files;
}

async function compressAll() {
    console.log('--- PNG Source Image Compressor ---');
    const files = getFiles(assetsDir);
    console.log(`[INFO] Found ${files.length} PNG files in assets directory.\n`);
    let savedTotal = 0;
    let optimizedCount = 0;

    for (const file of files) {
        const stats = fs.statSync(file);
        const originalSize = stats.size;
        const fileName = path.basename(file);

        try {
            const image = sharp(file);
            const metadata = await image.metadata();

            const shouldResize = !skipResizeList.includes(fileName);
            let pipeline = sharp(file);

            if (shouldResize && (metadata.width > 512 || metadata.height > 512)) {
                pipeline = pipeline.resize(512, 512, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            const tempFile = file + '.tmp';
            await pipeline
                .png({ compressionLevel: 9, quality: 80, palette: true })
                .toFile(tempFile);

            const compressedStats = fs.statSync(tempFile);
            const compressedSize = compressedStats.size;

            if (compressedSize < originalSize) {
                fs.renameSync(tempFile, file);
                const saved = originalSize - compressedSize;
                savedTotal += saved;
                optimizedCount++;
                console.log(`[OK] ${path.relative(assetsDir, file)}: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024).toFixed(2)}KB (saved ${(saved / 1024 / 1024).toFixed(2)}MB)`);
            } else {
                fs.unlinkSync(tempFile);
            }
        } catch (err) {
            console.error(`[ERROR] Failed to process ${path.relative(assetsDir, file)}:`, err.message);
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Optimized files:   ${optimizedCount}`);
    console.log(`Total space saved: ${(savedTotal / 1024 / 1024).toFixed(2)}MB\n`);
}

compressAll().catch(err => {
    console.error('[ERROR] Compression pipeline failed:', err);
});
