const cpx = require('cpx');
const path = require('path');

const source = path.join(__dirname, '../../service-worker.js');
const dest = path.join(__dirname, '../../dist');

cpx.copy(source, dest, (err) => {
    if (err) {
        console.error('Error copying service-worker.js:', err);
        process.exit(1);
    } else {
        console.log('Copied service-worker.js');
    }
});
