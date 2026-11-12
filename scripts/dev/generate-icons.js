#!/usr/bin/env node

/**
 * scripts/dev/generate-icons.js
 *
 * Standalone generator for application and tool launcher icons (512x512 px) and favicons.
 * Renders 100% procedural icons from scratch on a transparent canvas using
 * individual source assets (equipment, spells, and heroes):
 * 1. assets/damage_calc_icon.png (Damage Calculator & ZapQuake tool icon)
 * 2. assets/hero_journey_icon.png (Hero's Journey milestone rewards tracker icon)
 * 3. assets/hero_journey_favicon.png (Hero's Journey 64x64 favicon)
 *
 * Decoupled from production build scripts; executed manually when icon assets refresh:
 *   pnpm run generate:icons
 *   node scripts/dev/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');

const ICON_SIZE = 512;
const FAVICON_SIZE = 64;

/**
 * Generates the dedicated assets/damage_calc_icon.png launcher icon.
 * Composites the 4 canonical DamageCalc assets in the approved order:
 * 1. Lightning spell (left)
 * 2. Dragon Duke Rocket Backpack (center-left)
 * 3. Archer Queen Giant Arrow (center-right)
 * 4. Earthquake spell (right)
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateDamageCalcIcon() {
    const lightning = await sharp(path.join(ASSETS_DIR, 'spells/lightning.png'))
        .resize(170, 170, { fit: 'inside' })
        .toBuffer();

    const earthquake = await sharp(path.join(ASSETS_DIR, 'spells/earthquake.png'))
        .resize(170, 170, { fit: 'inside' })
        .toBuffer();

    const rocketBackpack = await sharp(path.join(ASSETS_DIR, 'equipment/dragon_duke/DD_rocket_backpack.png'))
        .resize(215, 215, { fit: 'inside' })
        .toBuffer();

    const giantArrow = await sharp(path.join(ASSETS_DIR, 'equipment/archer_queen/AQ_giant_arrow.png'))
        .resize(215, 215, { fit: 'inside' })
        .toBuffer();

    const canvas = sharp({
        create: {
            width: ICON_SIZE,
            height: ICON_SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });

    return canvas
        .composite([
            { input: lightning, top: 170, left: 36 },
            { input: earthquake, top: 170, left: 331 },
            { input: rocketBackpack, top: 150, left: 146 },
            { input: giantArrow, top: 150, left: 261 }
        ])
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * Creates a soft Gaussian drop shadow for an RGBA image buffer.
 *
 * @param {Buffer} inputBuffer - Source PNG buffer.
 * @param {number} [sigma=6] - Gaussian blur radius.
 * @param {number} [opacity=0.45] - Shadow opacity factor (0.0 to 1.0).
 * @param {number} [offsetY=6] - Vertical downward shadow displacement.
 * @returns {Promise<{input: Buffer, offsetY: number}>} Shadow buffer and offset.
 */
async function createDropShadow(inputBuffer, sigma = 6, opacity = 0.45, offsetY = 6) {
    const raw = await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true });
    const { data, info } = raw;
    const shadowData = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i += 4) {
        shadowData[i] = 0;
        shadowData[i + 1] = 0;
        shadowData[i + 2] = 0;
        shadowData[i + 3] = Math.round(data[i + 3] * opacity);
    }

    const blurred = await sharp(shadowData, { raw: { width: info.width, height: info.height, channels: 4 } })
        .blur(sigma)
        .png()
        .toBuffer();

    return { input: blurred, offsetY };
}

/**
 * Generates the dedicated assets/hero_journey_icon.png launcher icon.
 * Composites the 6 canonical Clash of Clans hero emblems in an elliptical crest arc:
 * 1. Royal Champion (outer left, -22 deg)
 * 2. Dragon Duke (outer right, +22 deg)
 * 3. Minion Prince (mid-left, -14 deg)
 * 4. Grand Warden (mid-right, +14 deg)
 * 5. Archer Queen (center-right, +4 deg)
 * 6. Barbarian King (center-left foreground, -5.5 deg)
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateHeroJourneyIcon() {
    const layers = [
        { file: 'emblemRoyalChampion.png', size: 106, angle: -22, left: -8, top: 230 },
        { file: 'emblemDragonDuke.png', size: 106, angle: 22, left: 382, top: 230 },
        { file: 'emblemMinionPrince.png', size: 130, angle: -14, left: 60, top: 176 },
        { file: 'emblemGrandWarden.png', size: 130, angle: 14, left: 295, top: 176 },
        { file: 'emblemArcherQueen.png', size: 150, angle: 4, left: 216, top: 154 },
        { file: 'emblemBarbarianKing.png', size: 150, angle: -5.5, left: 136, top: 152 }
    ];

    const composites = [];

    for (const layer of layers) {
        const emblemBuf = await sharp(path.join(ASSETS_DIR, 'heroes', layer.file))
            .resize(layer.size, layer.size, { fit: 'inside' })
            .rotate(layer.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();

        const shadow = await createDropShadow(emblemBuf, 6, 0.45, 6);

        composites.push({
            input: shadow.input,
            left: layer.left,
            top: layer.top + shadow.offsetY
        });
        composites.push({
            input: emblemBuf,
            left: layer.left,
            top: layer.top
        });
    }

    const canvas = sharp({
        create: {
            width: ICON_SIZE,
            height: ICON_SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });

    return canvas
        .composite(composites)
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * Generates the assets/hero_journey_favicon.png favicon (64x64 px) from a 512px icon buffer.
 *
 * @param {Buffer} iconBuf - 512x512 Hero's Journey icon PNG buffer.
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateHeroJourneyFavicon(iconBuf) {
    return sharp(iconBuf)
        .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * Main generator execution entry point.
 */
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');

    console.log('[INFO] Starting Tool Icon Generation (100% Procedural Canvas)...');
    console.log(`[INFO] Canvas dimensions: ${ICON_SIZE}x${ICON_SIZE}`);
    console.log(`[INFO] Output directory: ${ASSETS_DIR}`);
    if (isDryRun) {
        console.log('[INFO] Running in --dry-run mode (no files will be written)');
    }

    // 1. DamageCalc Launcher Icon
    const damageCalcIconPath = path.join(ASSETS_DIR, 'damage_calc_icon.png');
    const damageCalcIconBuf = await generateDamageCalcIcon();
    if (!isDryRun) {
        fs.writeFileSync(damageCalcIconPath, damageCalcIconBuf);
    }
    console.log(`[OK] Generated assets/damage_calc_icon.png (${damageCalcIconBuf.length} bytes)`);

    // 2. Hero's Journey Launcher Icon
    const heroJourneyIconPath = path.join(ASSETS_DIR, 'hero_journey_icon.png');
    const heroJourneyIconBuf = await generateHeroJourneyIcon();
    if (!isDryRun) {
        fs.writeFileSync(heroJourneyIconPath, heroJourneyIconBuf);
    }
    console.log(`[OK] Generated assets/hero_journey_icon.png (${heroJourneyIconBuf.length} bytes)`);

    // 3. Hero's Journey Favicon
    const heroJourneyFaviconPath = path.join(ASSETS_DIR, 'hero_journey_favicon.png');
    const heroJourneyFaviconBuf = await generateHeroJourneyFavicon(heroJourneyIconBuf);
    if (!isDryRun) {
        fs.writeFileSync(heroJourneyFaviconPath, heroJourneyFaviconBuf);
    }
    console.log(`[OK] Generated assets/hero_journey_favicon.png (${heroJourneyFaviconBuf.length} bytes)`);

    console.log('\n[OK] All tool icons generated successfully.');
}

if (require.main === module) {
    main().catch(err => {
        console.error(`[FATAL] ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    generateDamageCalcIcon,
    generateHeroJourneyIcon,
    generateHeroJourneyFavicon
};
