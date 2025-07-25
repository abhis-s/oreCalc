const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../../dist/assets');

async function optimizeImages() {
    console.log('Starting image optimization...');

    function processDirectory(currentDir) {
        const files = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);

            if (file.isDirectory()) {
                processDirectory(fullPath);
            } else if (file.isFile() && file.name.endsWith('.png')) {
                if (currentDir !== assetsDir) {
                    try {
                        sharp(fullPath)
                            .resize(200, 200)
                            .png({ compressionLevel: 9, quality: 100 })
                            .toFile(fullPath + '.optimized', (err, info) => {
                                if (err) {
                                    console.error(`Error optimizing ${fullPath}:`, err);
                                } else {
                                    fs.renameSync(fullPath + '.optimized', fullPath);
                                    // console.log(`Optimized: ${fullPath}`);
                                }
                            });
                    } catch (error) {
                        console.error(`Error processing ${fullPath}:`, error);
                    }
                } else {
                    console.log(`Skipping top-level PNG: ${fullPath}`);
                }
            }
        }
    }

    processDirectory(assetsDir);
    console.log('Image optimization complete.');
}

optimizeImages();
