const cpx = require('cpx');
const path = require('path');

const source = path.join(__dirname, '../../js/**/*.js');
const dest = path.join(__dirname, '../../dist/js');

cpx.copy(source, dest, (err) => {
    if (err) {
        console.error('Error copying JS files:', err);
        process.exit(1);
    } else {
        console.log('Copied JS files');
    }
});
