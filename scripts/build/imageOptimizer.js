const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

/**
 * Optimizes all assets in distDir: generates WebP/AVIF, 100/200 responsive thumbnails,
 * and preserves required PWA PNG icons using a concurrency-controlled worker pool.
 *
 * @param {string} distDir - The destination build directory.
 * @param {boolean} verbose - Whether to log detailed diagnostic messages.
 * @returns {Promise<void>}
 */
async function optimizeImages(distDir, verbose = false) {
    sharp.cache(false);
    sharp.concurrency(1);
    const assetsDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDir)) return;

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

            if (fullPath.endsWith('.png') && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const isSubfolder = path.dirname(fullPath) !== assetsDir;
                const baseName = fullPath.substring(0, fullPath.lastIndexOf('.'));
                const targetDir = path.dirname(fullPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                const fileBuffer = fs.readFileSync(fullPath);

                if (isSubfolder) {
                    const webp100Buf = await sharp(fileBuffer).resize(100, 100).webp({ quality: 80 }).toBuffer();
                    fs.writeFileSync(`${baseName}-100.webp`, webp100Buf);
                    const avif100Buf = await sharp(fileBuffer).resize(100, 100).avif({ quality: 65, effort: 6 }).toBuffer();
                    fs.writeFileSync(`${baseName}-100.avif`, avif100Buf);

                    const webp200Buf = await sharp(fileBuffer).resize(200, 200).webp({ quality: 80 }).toBuffer();
                    fs.writeFileSync(`${baseName}-200.webp`, webp200Buf);
                    const avif200Buf = await sharp(fileBuffer).resize(200, 200).avif({ quality: 65, effort: 6 }).toBuffer();
                    fs.writeFileSync(`${baseName}-200.avif`, avif200Buf);

                    if (fs.existsSync(fullPath)) {
                        try {
                            fs.unlinkSync(fullPath);
                        } catch (e) {
                        }
                    }
                    resizedCount++;
                    if (verbose) {
                        console.log(`Converted & Resized: ${file}`);
                    }
                } else {
                    if (keepPngs.includes(fileName)) {
                        const webpBuf = await sharp(fileBuffer).webp({ quality: 80 }).toBuffer();
                        fs.writeFileSync(`${baseName}.webp`, webpBuf);
                        const avifBuf = await sharp(fileBuffer).avif({ quality: 65, effort: 6 }).toBuffer();
                        fs.writeFileSync(`${baseName}.avif`, avifBuf);
                        keepPngCount++;
                        if (verbose) {
                            console.log(`Generated AVIF/WebP copy and kept PNG: ${fileName}`);
                        }
                    } else {
                        const webpBuf = await sharp(fileBuffer).resize({ width: 150, height: 150, fit: 'inside' }).webp({ quality: 80 }).toBuffer();
                        fs.writeFileSync(`${baseName}.webp`, webpBuf);
                        const avifBuf = await sharp(fileBuffer).resize({ width: 150, height: 150, fit: 'inside' }).avif({ quality: 65, effort: 6 }).toBuffer();
                        fs.writeFileSync(`${baseName}.avif`, avifBuf);
                        if (fs.existsSync(fullPath)) {
                            try {
                                fs.unlinkSync(fullPath);
                            } catch (e) {
                            }
                        }
                        convertedCount++;
                        if (verbose) {
                            console.log(`Converted to AVIF/WebP, resized to max 150px & deleted PNG: ${fileName}`);
                        }
                    }
                }
            }
        });
    }

    const concurrencyLimit = Math.min(4, os.cpus().length || 4);
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
    console.log(`[OK] Image optimization complete: ${resizedCount} equipment/resources resized, ${convertedCount} converted to AVIF/WebP, ${keepPngCount} PWA icons preserved.`);
}

module.exports = {
    optimizeImages
};
