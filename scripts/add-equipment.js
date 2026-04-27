const fs = require('fs');
const path = require('path');
const https = require('https');

const HERO_PREFIXES = {
    barbarian_king: 'BK',
    archer_queen: 'AQ',
    minion_prince: 'MP',
    grand_warden: 'GW',
    royal_champion: 'RC',
    dragon_duke: 'DD'
};

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

function snakeCase(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '_');
}

async function run() {
    const [,, heroId, equipName, type, imageUrl, deName] = process.argv;

    if (!heroId || !equipName || !type || !imageUrl) {
        console.error('Usage: node add-equipment.js <heroId> <equipName> <type> <imageUrl> [deName]');
        process.exit(1);
    }

    const equipKey = snakeCase(equipName);
    const prefix = HERO_PREFIXES[heroId] || 'EQ';
    const fileName = `${prefix}_${equipKey}.png`;
    const imagePath = `assets/equipment/${heroId}/${fileName}`;
    const absoluteImagePath = path.join(process.cwd(), imagePath);

    // 1. Download Image
    const dir = path.dirname(absoluteImagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await downloadImage(imageUrl, absoluteImagePath);

    // 2. Update js/data/heroData.js (Smart Placement)
    const heroDataPath = path.join(process.cwd(), 'js/data/heroData.js');
    let heroDataContent = fs.readFileSync(heroDataPath, 'utf8');
    const newEntry = `{ name: "${equipName}", type: "${type}", image: "${imagePath}" }`;
    
    const heroSectionRegex = new RegExp(`(${heroId}:\\s*{[\\s\\S]*?equipment:\\s*\\[)([\\s\\S]*?)(\\s*\\],)`, 'm');
    const match = heroDataContent.match(heroSectionRegex);

    if (match) {
        let equipmentArrayContent = match[2];
        const placeholderRegex = new RegExp(`\\{\\s*name:\\s*"Coming Soon"\\s*,\\s*type:\\s*"${type}"[\\s\\S]*?\\}`, 'm');
        
        if (placeholderRegex.test(equipmentArrayContent)) {
            equipmentArrayContent = equipmentArrayContent.replace(placeholderRegex, newEntry);
            console.log(`✓ Replaced ${type} "Coming Soon" placeholder.`);
        } else {
            const lines = equipmentArrayContent.split('\n');
            let lastMatchingTypeIndex = -1;

            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].includes(`type: "${type}"`)) {
                    lastMatchingTypeIndex = i;
                    break;
                }
            }

            if (lastMatchingTypeIndex !== -1) {
                lines.splice(lastMatchingTypeIndex + 1, 0, `            ${newEntry},`);
            } else {
                type === 'common' ? lines.unshift(`            ${newEntry},`) : lines.push(`            ${newEntry},`);
            }
            equipmentArrayContent = lines.join('\n');
            console.log(`✓ Inserted into ${type} category.`);
        }
        heroDataContent = heroDataContent.replace(heroSectionRegex, `$1${equipmentArrayContent}$3`);
        fs.writeFileSync(heroDataPath, heroDataContent);
    }

    // 3. Update i18n files (Ordered Placement)
    const updateI18n = (lang, translation) => {
        const i18nPath = path.join(process.cwd(), `js/i18n/${lang}.json`);
        let content = fs.readFileSync(i18nPath, 'utf8');
        const json = JSON.parse(content);
        if (json[equipKey]) return; // Skip if already exists

        // Find preceding key for ordering
        const updatedHeroData = fs.readFileSync(heroDataPath, 'utf8');
        const heroMatch = updatedHeroData.match(new RegExp(`${heroId}:\\s*{[\\s\\S]*?equipment:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
        if (heroMatch) {
            const keysInOrder = [...heroMatch[1].matchAll(/name:\s*"([^"]+)"/g)].map(m => snakeCase(m[1]));
            const currentIndex = keysInOrder.indexOf(equipKey);
            if (currentIndex > 0) {
                const prevKey = keysInOrder[currentIndex - 1];
                const lines = content.split('\n');
                const idx = lines.findIndex(l => l.includes(`"${prevKey}":`));
                if (idx !== -1) {
                    lines.splice(idx + 1, 0, `    "${equipKey}": "${translation}",`);
                    fs.writeFileSync(i18nPath, lines.join('\n'));
                    return;
                }
            }
        }
        // Fallback: append
        const lines = content.split('\n');
        lines.splice(lines.length - 2, 0, `    "${equipKey}": "${translation}",`);
        fs.writeFileSync(i18nPath, lines.join('\n'));
    };

    updateI18n('en', equipName);
    updateI18n('de', deName || equipName);
    console.log(`Successfully added ${equipName} to ${heroId}`);
}

run().catch(console.error);
