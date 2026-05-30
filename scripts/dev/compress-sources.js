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
    console.log(`Searching for PNG files in: ${assetsDir}`);
    const files = getFiles(assetsDir);
    console.log(`Found ${files.length} PNG files in assets.`);
    let savedTotal = 0;
    
    for (const file of files) {
        const stats = fs.statSync(file);
        const originalSize = stats.size;
        const fileName = path.basename(file);
        
        try {
            // Read metadata
            const image = sharp(file);
            const metadata = await image.metadata();
            
            // Determine if we should resize
            const shouldResize = !skipResizeList.includes(fileName);
            let pipeline = sharp(file);
            
            if (shouldResize && (metadata.width > 512 || metadata.height > 512)) {
                pipeline = pipeline.resize(512, 512, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }
            
            // Compress PNG using sharp
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
                console.log(`Optimized ${path.relative(assetsDir, file)}: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024).toFixed(2)}KB (saved ${(saved / 1024 / 1024).toFixed(2)}MB)`);
            } else {
                fs.unlinkSync(tempFile);
                console.log(`Skipped ${path.relative(assetsDir, file)} (no size reduction)`);
            }
        } catch (err) {
            console.error(`Error processing ${path.relative(assetsDir, file)}:`, err.message);
        }
    }
    
    console.log(`Total saved space: ${(savedTotal / 1024 / 1024).toFixed(2)}MB`);
}

compressAll().catch(err => {
    console.error('Compression failed:', err);
});
