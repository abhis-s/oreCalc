export function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const r = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(r);
    } else {
        for (let i = 0; i < 16; i++) {
            r[i] = Math.random() * 256 | 0;
        }
    }
    // Version 4
    r[6] = (r[6] & 0x0f) | 0x40;
    // Variant RFC4122
    r[8] = (r[8] & 0x3f) | 0x80;
    
    let uuid = '';
    for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 6 || i === 8 || i === 10) {
            uuid += '-';
        }
        const val = r[i].toString(16);
        uuid += val.length === 1 ? '0' + val : val;
    }
    return uuid;
}

export function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
