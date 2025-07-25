const cpx = require('cpx');
const path = require('path');

const source = path.join(__dirname, '../../assets/**/*.*');
const dest = path.join(__dirname, '../../dist/assets');

cpx.copy(source, dest, (err) => {
    if (err) {
        console.error('Error copying assets:', err);
        process.exit(1);
    } else {
        console.log('Copied assets');
    }
});
