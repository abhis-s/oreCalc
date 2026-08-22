#!/usr/bin/env node

/**
 * scripts/dev/normalize-png-canvas.js
 *
 * Utility for trimming extra transparent canvas from PNGs and centering them
 * onto a 1:1 square canvas.
 *
 * Features:
 * - Trimming extra transparent borders/margins (cutting)
 * - Centering onto a square canvas (auto-sized to max dimension or explicit --size)
 * - Modes: full normalize (cut + center), --cut-only, --center-only
 * - Input targeting: explicit files, directories (with recursive search)
 * - Exclusion: exclude specific files, filenames, or relative paths
 * - Safe processing: no content cropping (preserves 100% of visible pixels)
 * - Dry-run simulation mode
 * - Custom padding support
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Prints usage instructions and command-line options.
 */
function printHelp() {
    console.log(`
Usage: node scripts/dev/normalize-png-canvas.js [options] [files...]

Options:
  --dir, -d <path>         Target directory containing PNG images to process
  --file, -f <path...>     Specific PNG file(s) to process (can also pass positional args)
  --exclude, -e <name...>  Filenames, relative paths, or keywords to exclude from processing

  --cut-only, --trim-only  Only remove extra transparent canvas; do not center on square canvas
  --center-only            Only center onto square canvas; do not trim transparent margins first

  --size, -s <number>      Explicit square canvas size in pixels (e.g. 512).
                           If omitted, automatically uses max(width, height) to prevent rescaling.
  --padding, -p <number>   Inner padding in pixels to add around the image within the square canvas (default: 0)
  --threshold, -t <number> Trim alpha threshold (0-255, default: 10 for anti-aliasing edge noise)

  --out-dir, -o <path>     Output directory (default: modifies files in-place)
  --dry-run                Simulate operations and print dimensions without modifying files
  --no-recursive           Do not scan subdirectories when using --dir
  --help, -h               Show this help message

Examples:
  # 1. Normalize all PNGs in assets/ (trim extra canvas + center onto square):
  node scripts/dev/normalize-png-canvas.js --dir assets

  # 2. Normalize a specific equipment icon with an explicit 512x512 canvas:
  node scripts/dev/normalize-png-canvas.js --file assets/equipment/barbarian_king/BK_giant_gauntlet.png --size 512

  # 3. Only cut/trim transparent borders without creating a square canvas:
  node scripts/dev/normalize-png-canvas.js --dir assets/resources --cut-only

  # 4. Only center onto a 256x256 square canvas without trimming:
  node scripts/dev/normalize-png-canvas.js --file assets/crown.png --center-only --size 256

  # 5. Process a directory while excluding specific files:
  node scripts/dev/normalize-png-canvas.js --dir assets --exclude favicon.png app_icon_large.png app_icon_small.png

  # 6. Preview changes without writing to disk (dry-run):
  node scripts/dev/normalize-png-canvas.js --dir assets/heroes --dry-run
`);
}

/**
 * Parses command-line arguments into a structured options object.
 * @param {string[]} args
 * @returns {object}
 */
function parseCommandLineArgs(args) {
    const options = {
        files: [],
        dirs: [],
        excludes: [],
        cutOnly: false,
        centerOnly: false,
        size: null,
        padding: 0,
        threshold: 10,
        outDir: null,
        dryRun: false,
        recursive: true,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            return options;
        }

        if (arg === '--cut-only' || arg === '--trim-only') {
            options.cutOnly = true;
            continue;
        }

        if (arg === '--center-only') {
            options.centerOnly = true;
            continue;
        }

        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }

        if (arg === '--no-recursive') {
            options.recursive = false;
            continue;
        }

        if (arg === '--size' || arg === '-s' || arg === '--canvas-size') {
            const val = parseInt(args[++i], 10);
            if (isNaN(val) || val <= 0) {
                throw new Error(`[ERROR] Invalid --size value: "${args[i]}". Must be a positive integer.`);
            }
            options.size = val;
            continue;
        }

        if (arg === '--padding' || arg === '-p') {
            const val = parseInt(args[++i], 10);
            if (isNaN(val) || val < 0) {
                throw new Error(`[ERROR] Invalid --padding value: "${args[i]}". Must be a non-negative integer.`);
            }
            options.padding = val;
            continue;
        }

        if (arg === '--threshold' || arg === '-t') {
            const val = parseInt(args[++i], 10);
            if (isNaN(val) || val < 0 || val > 255) {
                throw new Error(`[ERROR] Invalid --threshold value: "${args[i]}". Must be between 0 and 255.`);
            }
            options.threshold = val;
            continue;
        }

        if (arg === '--out-dir' || arg === '-o') {
            options.outDir = path.resolve(args[++i]);
            continue;
        }

        if (arg === '--dir' || arg === '-d' || arg === '--directory') {
            options.dirs.push(path.resolve(args[++i]));
            continue;
        }

        if (arg === '--file' || arg === '-f') {
            while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                options.files.push(path.resolve(args[++i]));
            }
            continue;
        }

        if (arg === '--exclude' || arg === '-e') {
            while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                options.excludes.push(args[++i]);
            }
            continue;
        }

        // Positional arguments (treat as files or directories)
        if (!arg.startsWith('-')) {
            const resolved = path.resolve(arg);
            if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                options.dirs.push(resolved);
            } else {
                options.files.push(resolved);
            }
            continue;
        }

        throw new Error(`[ERROR] Unknown argument: "${arg}". Use --help for usage instructions.`);
    }

    if (options.cutOnly && options.centerOnly) {
        throw new Error('[ERROR] Cannot specify both --cut-only and --center-only simultaneously.');
    }

    return options;
}

/**
 * Recursively or flatly discovers PNG files within a directory.
 * @param {string} dir
 * @param {boolean} recursive
 * @param {string[]} fileList
 * @returns {string[]}
 */
function collectPngsFromDirectory(dir, recursive, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recursive) {
                collectPngsFromDirectory(fullPath, recursive, fileList);
            }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
            fileList.push(fullPath);
        }
    }

    return fileList;
}

/**
 * Checks if a file path matches any exclusion rule.
 * @param {string} filePath
 * @param {string[]} excludes
 * @returns {boolean}
 */
function isExcluded(filePath, excludes) {
    if (!excludes || excludes.length === 0) return false;
    const fileName = path.basename(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const exclude of excludes) {
        const normExclude = exclude.replace(/\\/g, '/');
        if (fileName === exclude || fileName.toLowerCase() === exclude.toLowerCase()) {
            return true;
        }
        if (normalizedPath.includes(normExclude)) {
            return true;
        }
    }
    return false;
}

/**
 * Processes a single PNG image: trims transparent margins and/or centers onto a square canvas.
 * @param {string} inputFilePath
 * @param {string} outputFilePath
 * @param {object} options
 * @returns {Promise<{ changed: boolean, originalDimensions: string, finalDimensions: string }>}
 */
async function processImage(inputFilePath, outputFilePath, options) {
    const image = sharp(inputFilePath);
    const metadata = await image.metadata();
    const origWidth = metadata.width;
    const origHeight = metadata.height;

    let pipeline = sharp(inputFilePath);
    let currentBuffer;
    let currentWidth = origWidth;
    let currentHeight = origHeight;

    // Phase 1: Cutting / Trimming transparent canvas (unless --center-only)
    if (!options.centerOnly) {
        try {
            const trimResult = await pipeline
                .trim({ threshold: options.threshold })
                .toBuffer({ resolveWithObject: true });

            currentBuffer = trimResult.data;
            currentWidth = trimResult.info.width;
            currentHeight = trimResult.info.height;
        } catch (trimErr) {
            // sharp throws if an image is completely transparent; keep original buffer
            currentBuffer = await sharp(inputFilePath).toBuffer();
        }
    } else {
        currentBuffer = await sharp(inputFilePath).toBuffer();
    }

    // Phase 2: Centering onto a square canvas (unless --cut-only)
    if (!options.cutOnly) {
        // Determine target square canvas size
        let targetSize;
        if (options.size) {
            targetSize = options.size;
        } else {
            // Auto-size to the largest dimension + optional padding
            const maxDim = Math.max(currentWidth, currentHeight);
            targetSize = maxDim + (options.padding * 2);
        }

        // Available inner area for the image after applying padding
        const innerMax = Math.max(1, targetSize - (options.padding * 2));

        // If the trimmed image exceeds available inner area, scale down proportionally to fit (NO CROPPING)
        let renderWidth = currentWidth;
        let renderHeight = currentHeight;

        if (currentWidth > innerMax || currentHeight > innerMax) {
            const scale = Math.min(innerMax / currentWidth, innerMax / currentHeight);
            renderWidth = Math.round(currentWidth * scale);
            renderHeight = Math.round(currentHeight * scale);

            currentBuffer = await sharp(currentBuffer)
                .resize(renderWidth, renderHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();
        }

        // Calculate centering offsets onto the target square canvas
        const leftPadding = Math.floor((targetSize - renderWidth) / 2);
        const rightPadding = targetSize - renderWidth - leftPadding;
        const topPadding = Math.floor((targetSize - renderHeight) / 2);
        const bottomPadding = targetSize - renderHeight - topPadding;

        // Extend canvas with transparent background
        currentBuffer = await sharp(currentBuffer)
            .extend({
                top: Math.max(0, topPadding),
                bottom: Math.max(0, bottomPadding),
                left: Math.max(0, leftPadding),
                right: Math.max(0, rightPadding),
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({ compressionLevel: 9 })
            .toBuffer();

        currentWidth = targetSize;
        currentHeight = targetSize;
    } else {
        // Cut-only mode: finalize buffer as PNG
        currentBuffer = await sharp(currentBuffer)
            .png({ compressionLevel: 9 })
            .toBuffer();
    }

    const originalDimensions = `${origWidth}x${origHeight}`;
    const finalDimensions = `${currentWidth}x${currentHeight}`;
    const changed = (origWidth !== currentWidth || origHeight !== currentHeight);

    if (!options.dryRun) {
        const destDir = path.dirname(outputFilePath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.writeFileSync(outputFilePath, currentBuffer);
    }

    return {
        changed,
        originalDimensions,
        finalDimensions
    };
}

/**
 * Main execution entry point.
 */
async function main() {
    const rawArgs = process.argv.slice(2);
    let options;

    try {
        options = parseCommandLineArgs(rawArgs);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    if (options.help || (options.files.length === 0 && options.dirs.length === 0)) {
        printHelp();
        process.exit(options.help ? 0 : 1);
    }

    // Collect all candidate files
    const allFiles = new Set();

    for (const filePath of options.files) {
        if (fs.existsSync(filePath)) {
            allFiles.add(path.resolve(filePath));
        } else {
            console.warn(`[WARN] File not found: ${filePath}`);
        }
    }

    for (const dirPath of options.dirs) {
        if (fs.existsSync(dirPath)) {
            const pngs = collectPngsFromDirectory(dirPath, options.recursive);
            for (const p of pngs) {
                allFiles.add(p);
            }
        } else {
            console.warn(`[WARN] Directory not found: ${dirPath}`);
        }
    }

    const candidateList = Array.from(allFiles);
    const toProcess = [];
    const skipped = [];

    for (const file of candidateList) {
        if (isExcluded(file, options.excludes)) {
            skipped.push(file);
        } else {
            toProcess.push(file);
        }
    }

    console.log(`\n--- PNG Canvas Normalizer ---`);
    console.log(`Mode:       ${options.cutOnly ? 'Cut / Trim Only' : options.centerOnly ? 'Center Only' : 'Cut (Trim) + Center 1:1 Square'}`);
    console.log(`Canvas:     ${options.size ? `${options.size}x${options.size} (explicit)` : 'Auto max(width, height)'}`);
    console.log(`Padding:    ${options.padding}px`);
    console.log(`Threshold:  ${options.threshold}`);
    console.log(`Dry Run:    ${options.dryRun ? 'YES (No files will be modified)' : 'NO (Files will be updated in-place/output)'}`);
    console.log(`Found:      ${candidateList.length} PNGs (${toProcess.length} to process, ${skipped.length} excluded)\n`);

    if (toProcess.length === 0) {
        console.log('[INFO] No PNG files to process.');
        return;
    }

    let processedCount = 0;
    let modifiedCount = 0;
    let errorCount = 0;

    for (const inputPath of toProcess) {
        const relPath = path.relative(process.cwd(), inputPath);
        let outputPath = inputPath;

        if (options.outDir) {
            const baseName = path.basename(inputPath);
            outputPath = path.join(options.outDir, baseName);
        }

        try {
            const result = await processImage(inputPath, outputPath, options);
            processedCount++;

            if (result.changed) {
                modifiedCount++;
                console.log(`[OK] ${relPath}: ${result.originalDimensions} -> ${result.finalDimensions}`);
            } else {
                console.log(`[UNCHANGED] ${relPath}: already ${result.finalDimensions}`);
            }
        } catch (err) {
            errorCount++;
            console.error(`[ERROR] Failed to process ${relPath}: ${err.message}`);
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total processed: ${processedCount}`);
    console.log(`Modified:        ${modifiedCount}`);
    console.log(`Excluded:        ${skipped.length}`);
    console.log(`Errors:          ${errorCount}`);
    if (options.dryRun) {
        console.log(`[NOTE] Dry run complete. No files were written to disk.`);
    }
}

// Module export for programmatic testing or execution
module.exports = {
    parseCommandLineArgs,
    processImage,
    collectPngsFromDirectory,
    isExcluded
};

// Execute if invoked directly from CLI
if (require.main === module) {
    main().catch(err => {
        console.error(`[FATAL] ${err.message}`);
        process.exit(1);
    });
}
