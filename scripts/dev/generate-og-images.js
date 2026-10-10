#!/usr/bin/env node

/**
 * scripts/dev/generate-og-images.js
 *
 * Standalone generator for OpenGraph social preview images (1200x630 px).
 * Renders 100% procedural cards from scratch on a blank white canvas using
 * individual source assets (heroes, equipment, spells, and ores):
 * 1. assets/landing_og.png (Root Landing Portal)
 * 2. assets/ore_calc_og.png & assets/app_og.png (Ore & Equipment Calculator)
 * 3. assets/hero_journey_og.png (Hero's Journey Tracker)
 * 4. assets/damage_calc_og.png (Equipment Damage & ZapQuake Calculator)
 *
 * Decoupled from production build scripts; executed manually when card assets refresh:
 *   pnpm run generate:og
 *   node scripts/dev/generate-og-images.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets');

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/**
 * Clean system font stack matching application typography.
 */
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Renders an OpenGraph card on a blank canvas with procedural shadows and vector typography.
 *
 * @param {object} config - Card layout and typography configuration.
 * @param {string} config.shadowSvg - SVG string defining the soft Gaussian ground shadow.
 * @param {Array<{input: Buffer, top: number, left: number}>} config.elements - Visual elements to composite.
 * @param {string} config.pillText - Category text in top badge.
 * @param {number} config.pillW - Width of the top pill badge.
 * @param {string} config.title - Main card title.
 * @param {number} [config.titleSize=48] - Title font size.
 * @param {string} config.subtitle - Card descriptive subtitle.
 * @param {string} config.url - Canonical destination URL.
 * @param {string} config.urlColor - Color of the canonical destination URL.
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function renderCard(config) {
    const {
        shadowSvg,
        elements,
        pillText,
        pillW,
        title,
        titleSize = 48,
        subtitle,
        url,
        urlColor
    } = config;

    const canvas = sharp({
        create: {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    });

    const pillX = 600 - Math.round(pillW / 2);

    const textSvg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <!-- Top Pill Badge -->
      <rect x="${pillX}" y="47" width="${pillW}" height="38" rx="19" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
      <text x="600" y="71" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" font-weight="700" letter-spacing="1.5" fill="#475569">${pillText}</text>

      <!-- Title -->
      <text x="600" y="465" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${titleSize}" font-weight="800" fill="#0f172a">${title}</text>

      <!-- Subtitle -->
      <text x="600" y="515" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="20" font-weight="500" fill="#475569">${subtitle}</text>

      <!-- Canonical URL -->
      <text x="600" y="565" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="19" font-weight="700" fill="${urlColor}">${url}</text>
    </svg>
    `;

    return canvas
        .composite([
            { input: Buffer.from(shadowSvg), top: 0, left: 0 },
            ...elements,
            { input: Buffer.from(textSvg), top: 0, left: 0 }
        ])
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/**
 * Generates the dedicated assets/landing_og.png card representing the entire ClashCalc platform.
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateLandingCard() {
    const starry = await sharp(path.join(ASSETS_DIR, 'starry_ore.png')).resize(185, 185, { fit: 'inside' }).toBuffer();
    const glowy = await sharp(path.join(ASSETS_DIR, 'glowy_ore.png')).resize(170, 170, { fit: 'inside' }).toBuffer();
    const emblemKing = await sharp(path.join(ASSETS_DIR, 'heroes/emblemBarbarianKing.png')).resize(200, 200, { fit: 'inside' }).toBuffer();
    const lightning = await sharp(path.join(ASSETS_DIR, 'spells/lightning.png')).resize(150, 150, { fit: 'inside' }).toBuffer();
    const earthquake = await sharp(path.join(ASSETS_DIR, 'spells/earthquake.png')).resize(150, 150, { fit: 'inside' }).toBuffer();

    const shadowSvg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="landingShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.14"/>
          <stop offset="45%" stop-color="#0f172a" stop-opacity="0.06"/>
          <stop offset="80%" stop-color="#0f172a" stop-opacity="0.01"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="385" rx="340" ry="26" fill="url(#landingShadow)"/>
    </svg>
    `;

    return renderCard({
        shadowSvg,
        elements: [
            { input: starry, top: 185, left: 275 },
            { input: glowy, top: 175, left: 375 },
            { input: lightning, top: 175, left: 675 },
            { input: earthquake, top: 185, left: 775 },
            { input: emblemKing, top: 145, left: 500 }
        ],
        pillText: 'ALL-IN-ONE CLASH OF CLANS TOOLKIT',
        pillW: 384,
        title: 'ClashCalc',
        titleSize: 52,
        subtitle: 'Ore Planner · Hero\'s Journey · Damage &amp; ZapQuake Calculator',
        url: 'clashcalc.com',
        urlColor: '#2563eb'
    });
}

/**
 * Generates the dedicated assets/ore_calc_og.png card (and synchronized assets/app_og.png).
 * Uses the canonical ore_icon.png directly for a harmonized composition with Starry on left and Shiny on right.
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateOreCalcCard() {
    const oreIcon = await sharp(path.join(ASSETS_DIR, 'ore_icon.png'))
        .resize(480, 264, { fit: 'inside' })
        .toBuffer();

    const shadowSvg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="oreShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.15"/>
          <stop offset="45%" stop-color="#0f172a" stop-opacity="0.06"/>
          <stop offset="80%" stop-color="#0f172a" stop-opacity="0.01"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="385" rx="280" ry="24" fill="url(#oreShadow)"/>
    </svg>
    `;

    return renderCard({
        shadowSvg,
        elements: [
            { input: oreIcon, top: 135, left: 360 }
        ],
        pillText: 'ORE CALCULATOR · CLASH OF CLANS',
        pillW: 372,
        title: 'ORE CALCULATOR',
        subtitle: 'Ore Planner · Income Forecasting · Planner Calendar',
        url: 'clashcalc.com/ore-calculator',
        urlColor: '#2563eb'
    });
}

/**
 * Generates the dedicated assets/hero_journey_og.png card showcasing the progression track.
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateHeroJourneyCard() {
    const emblemKing = await sharp(path.join(ASSETS_DIR, 'heroes/emblemBarbarianKing.png')).resize(150, 150, { fit: 'inside' }).toBuffer();
    const chestOre = await sharp(path.join(ASSETS_DIR, 'heroJourney/chest_ore.png')).resize(175, 175, { fit: 'inside' }).toBuffer();
    const minionPrince = await sharp(path.join(ASSETS_DIR, 'heroes/minionPrince.png')).resize(230, 230, { fit: 'inside' }).toBuffer();
    const mirror = await sharp(path.join(ASSETS_DIR, 'equipment/archer_queen/AQ_magic_mirror.png')).resize(190, 190, { fit: 'inside' }).toBuffer();
    const emblemQueen = await sharp(path.join(ASSETS_DIR, 'heroes/emblemArcherQueen.png')).resize(150, 150, { fit: 'inside' }).toBuffer();

    const shadowSvg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hjShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.14"/>
          <stop offset="45%" stop-color="#0f172a" stop-opacity="0.06"/>
          <stop offset="80%" stop-color="#0f172a" stop-opacity="0.01"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="385" rx="350" ry="26" fill="url(#hjShadow)"/>
    </svg>
    `;

    return renderCard({
        shadowSvg,
        elements: [
            { input: emblemKing, top: 195, left: 250 },
            { input: chestOre, top: 180, left: 370 },
            { input: mirror, top: 175, left: 660 },
            { input: emblemQueen, top: 195, left: 810 },
            { input: minionPrince, top: 150, left: 485 }
        ],
        pillText: 'HERO\'S JOURNEY · CLASH OF CLANS',
        pillW: 368,
        title: 'HERO\'S JOURNEY',
        subtitle: 'Milestone Rewards · Equipment Track · Level Progression',
        url: 'clashcalc.com/hero-journey',
        urlColor: '#b45309'
    });
}

/**
 * Generates the dedicated assets/damage_calc_og.png card showcasing ZapQuake and high-damage gear.
 * Composites spells in the background so both sit cleanly behind the foreground equipment.
 *
 * @returns {Promise<Buffer>} Sharp-rendered PNG buffer.
 */
async function generateDamageCalcCard() {
    const lightning = await sharp(path.join(ASSETS_DIR, 'spells/lightning.png')).resize(160, 160, { fit: 'inside' }).toBuffer();
    const giantArrow = await sharp(path.join(ASSETS_DIR, 'equipment/archer_queen/AQ_giant_arrow.png')).resize(215, 215, { fit: 'inside' }).toBuffer();
    const rocketBackpack = await sharp(path.join(ASSETS_DIR, 'equipment/dragon_duke/DD_rocket_backpack.png')).resize(215, 215, { fit: 'inside' }).toBuffer();
    const earthquake = await sharp(path.join(ASSETS_DIR, 'spells/earthquake.png')).resize(160, 160, { fit: 'inside' }).toBuffer();

    const shadowSvg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="dmgShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.14"/>
          <stop offset="45%" stop-color="#0f172a" stop-opacity="0.06"/>
          <stop offset="80%" stop-color="#0f172a" stop-opacity="0.01"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="600" cy="385" rx="320" ry="26" fill="url(#dmgShadow)"/>
    </svg>
    `;

    return renderCard({
        shadowSvg,
        elements: [
            { input: lightning, top: 185, left: 290 },
            { input: earthquake, top: 185, left: 750 },
            { input: giantArrow, top: 160, left: 405 },
            { input: rocketBackpack, top: 160, left: 580 }
        ],
        pillText: 'DAMAGE CALCULATOR · CLASH OF CLANS',
        pillW: 410,
        title: 'DAMAGE CALCULATOR',
        subtitle: 'ZapQuake Solver · Hero Gear Synergies · Defense Breakpoints',
        url: 'clashcalc.com/damage-calculator',
        urlColor: '#7c3aed'
    });
}

/**
 * Main generator execution entry point.
 */
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');

    console.log('[INFO] Starting OpenGraph Social Card Generation (100% Procedural Canvas)...');
    console.log(`[INFO] Dimensions: ${CARD_WIDTH}x${CARD_HEIGHT}`);
    console.log(`[INFO] Output directory: ${ASSETS_DIR}`);
    if (isDryRun) {
        console.log('[INFO] Running in --dry-run mode (no files will be written)');
    }

    const landingOgPath = path.join(ASSETS_DIR, 'landing_og.png');
    const landingOgBuf = await generateLandingCard();
    if (!isDryRun) {
        fs.writeFileSync(landingOgPath, landingOgBuf);
    }
    console.log(`[OK] Generated assets/landing_og.png (${landingOgBuf.length} bytes)`);

    const oreCalcOgPath = path.join(ASSETS_DIR, 'ore_calc_og.png');
    const appOgPath = path.join(ASSETS_DIR, 'app_og.png');
    const oreCalcOgBuf = await generateOreCalcCard();
    if (!isDryRun) {
        fs.writeFileSync(oreCalcOgPath, oreCalcOgBuf);
        fs.writeFileSync(appOgPath, oreCalcOgBuf);
    }
    console.log(`[OK] Generated assets/ore_calc_og.png & assets/app_og.png (${oreCalcOgBuf.length} bytes)`);

    const heroJourneyOgPath = path.join(ASSETS_DIR, 'hero_journey_og.png');
    const heroJourneyOgBuf = await generateHeroJourneyCard();
    if (!isDryRun) {
        fs.writeFileSync(heroJourneyOgPath, heroJourneyOgBuf);
    }
    console.log(`[OK] Generated assets/hero_journey_og.png (${heroJourneyOgBuf.length} bytes)`);

    const damageCalcOgPath = path.join(ASSETS_DIR, 'damage_calc_og.png');
    const damageCalcOgBuf = await generateDamageCalcCard();
    if (!isDryRun) {
        fs.writeFileSync(damageCalcOgPath, damageCalcOgBuf);
    }
    console.log(`[OK] Generated assets/damage_calc_og.png (${damageCalcOgBuf.length} bytes)`);

    console.log('\n[OK] All 4 OpenGraph cards generated from scratch successfully.');
}

if (require.main === module) {
    main().catch(err => {
        console.error(`[FATAL] ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    generateLandingCard,
    generateOreCalcCard,
    generateHeroJourneyCard,
    generateDamageCalcCard
};
