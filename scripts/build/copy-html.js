const cpx = require('cpx');
const path = require('path');

const source = path.join(__dirname, '../../index.html');
const dest = path.join(__dirname, '../../dist');

cpx.copy(source, dest, (err) => {
    if (err) {
        console.error('Error copying index.html:', err);
        process.exit(1);
    } else {
        console.log('Copied index.html');
    }
});
