const cpx = require('cpx');
const path = require('path');

const source = path.join(__dirname, '../../js/i18n/**/*.json');
const dest = path.join(__dirname, '../../dist/js/i18n');

cpx.copy(source, dest, (err) => {
    if (err) {
        console.error('Error copying JSON files:', err);
        process.exit(1);
    } else {
        console.log('Copied JSON files');
    }
});
