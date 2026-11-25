const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Standard IEEE 802.3 CRC-32 lookup table for reconstructing valid PNG chunk trailers
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(typeStr, data) {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const lenBuf = Buffer.allocUnsafe(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function buildSingleFramePng(ihdrTemplate, width, height, sharedAncillaryChunks, idatPayloads) {
    const ihdr = Buffer.from(ihdrTemplate);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    const chunks = [
        PNG_SIGNATURE,
        makePngChunk('IHDR', ihdr),
        ...sharedAncillaryChunks,
        ...idatPayloads.map(payload => makePngChunk('IDAT', payload)),
        makePngChunk('IEND', Buffer.alloc(0))
    ];
    return Buffer.concat(chunks);
}

/**
 * Checks whether a buffer represents an Animated PNG (APNG) by looking for the acTL chunk.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isApng(buffer) {
    if (!buffer || buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return false;
    }
    let offset = 8;
    while (offset < buffer.length - 8) {
        const len = buffer.readUInt32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        if (type === 'acTL') {
            return true;
        }
        if (type === 'IDAT' || type === 'IEND') {
            break;
        }
        offset += 12 + len;
    }
    return false;
}

/**
 * Extracts per-frame standalone PNGs, frame geometry, and timing from an APNG buffer.
 *
 * @param {Buffer} apngBuffer
 * @returns {Promise<{ width: number, height: number, loop: number, delays: number[], frames: Buffer[] }>}
 */
async function decodeApngToFramePngs(apngBuffer) {
    if (!apngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error('Invalid PNG signature');
    }

    let ihdrData = null;
    const sharedAncillary = [];
    let loopCount = 0;
    const framesMeta = [];
    let currentFrame = null;
    let sawFirstIdat = false;
    const defaultIdats = [];

    let offset = 8;
    while (offset < apngBuffer.length) {
        const len = apngBuffer.readUInt32BE(offset);
        const type = apngBuffer.subarray(offset + 4, offset + 8).toString('ascii');
        const data = apngBuffer.subarray(offset + 8, offset + 8 + len);

        if (type === 'IHDR') {
            ihdrData = Buffer.from(data);
        } else if (type === 'PLTE' || type === 'tRNS') {
            sharedAncillary.push(makePngChunk(type, data));
        } else if (type === 'acTL') {
            loopCount = data.readUInt32BE(4);
        } else if (type === 'fcTL') {
            currentFrame = {
                width: data.readUInt32BE(4),
                height: data.readUInt32BE(8),
                xOffset: data.readUInt32BE(12),
                yOffset: data.readUInt32BE(16),
                delayNum: data.readUInt16BE(20),
                delayDen: data.readUInt16BE(22) || 100,
                disposeOp: data.readUInt8(24),
                blendOp: data.readUInt8(25),
                idats: []
            };
            framesMeta.push(currentFrame);
        } else if (type === 'IDAT') {
            sawFirstIdat = true;
            if (currentFrame) {
                currentFrame.idats.push(data);
            } else {
                defaultIdats.push(data);
            }
        } else if (type === 'fdAT') {
            if (currentFrame) {
                currentFrame.idats.push(data.subarray(4));
            }
        } else if (type === 'IEND') {
            break;
        } else if (!sawFirstIdat && (type === 'gAMA' || type === 'cHRM' || type === 'sRGB')) {
            sharedAncillary.push(makePngChunk(type, data));
        }

        offset += 12 + len;
    }

    if (!ihdrData) {
        throw new Error('Missing IHDR chunk');
    }

    const canvasW = ihdrData.readUInt32BE(0);
    const canvasH = ihdrData.readUInt32BE(4);

    if (framesMeta.length === 0) {
        return {
            width: canvasW,
            height: canvasH,
            loop: 0,
            delays: [100],
            frames: [buildSingleFramePng(ihdrData, canvasW, canvasH, sharedAncillary, defaultIdats)]
        };
    }

    const isFullCanvasFastPath = framesMeta.every(
        f => f.width === canvasW && f.height === canvasH && f.xOffset === 0 && f.yOffset === 0 && f.blendOp === 0
    );

    const delays = framesMeta.map(f => Math.max(10, Math.round((f.delayNum * 1000) / f.delayDen)));

    if (isFullCanvasFastPath) {
        const frames = framesMeta.map(f =>
            buildSingleFramePng(ihdrData, canvasW, canvasH, sharedAncillary, f.idats)
        );
        return { width: canvasW, height: canvasH, loop: loopCount, delays, frames };
    }

    // General APNG sub-rect compositor fallback
    let canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);
    const outputFrames = [];

    for (const f of framesMeta) {
        const prevCanvasBeforeFrame = f.disposeOp === 2 ? Buffer.from(canvasBuf) : null;
        const patchPng = buildSingleFramePng(ihdrData, f.width, f.height, sharedAncillary, f.idats);
        const patchRaw = await sharp(patchPng).ensureAlpha().raw().toBuffer();

        if (f.blendOp === 0) {
            for (let row = 0; row < f.height; row++) {
                const srcStart = row * f.width * 4;
                const dstStart = ((f.yOffset + row) * canvasW + f.xOffset) * 4;
                patchRaw.copy(canvasBuf, dstStart, srcStart, srcStart + f.width * 4);
            }
        } else {
            canvasBuf = await sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
                .composite([{
                    input: patchRaw,
                    raw: { width: f.width, height: f.height, channels: 4 },
                    left: f.xOffset,
                    top: f.yOffset,
                    blend: 'over'
                }])
                .raw()
                .toBuffer();
        }

        const fullFramePng = await sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
            .png({ compressionLevel: 1 })
            .toBuffer();
        outputFrames.push(fullFramePng);

        if (f.disposeOp === 1) {
            for (let row = 0; row < f.height; row++) {
                const dstStart = ((f.yOffset + row) * canvasW + f.xOffset) * 4;
                canvasBuf.fill(0, dstStart, dstStart + f.width * 4);
            }
        } else if (f.disposeOp === 2 && prevCanvasBeforeFrame) {
            canvasBuf = prevCanvasBeforeFrame;
        }
    }

    return { width: canvasW, height: canvasH, loop: loopCount, delays, frames: outputFrames };
}

/**
 * Downsamples high-framerate (e.g. 60 FPS) frame sequences to ~30 FPS by pairing consecutive frames
 * and summing their delays, preserving exact total animation duration while cutting WebP size.
 *
 * @param {Buffer[]} frames
 * @param {number[]} delays
 * @returns {{ frames: Buffer[], delays: number[] }}
 */
function downsampleFrames(frames, delays) {
    if (frames.length <= 20) {
        return { frames, delays };
    }

    const totalMs = delays.reduce((sum, d) => sum + d, 0);
    const avgDelay = totalMs / frames.length;
    if (avgDelay >= 25) {
        return { frames, delays };
    }

    const outFrames = [];
    const outDelays = [];
    for (let i = 0; i < frames.length; i += 2) {
        const nextDelay = i + 1 < delays.length ? delays[i + 1] : 0;
        outFrames.push(frames[i]);
        outDelays.push(delays[i] + nextDelay);
    }
    return { frames: outFrames, delays: outDelays };
}

/**
 * Encodes an array of frame PNGs into an animated WebP buffer and a static hero WebP buffer.
 *
 * @param {Buffer[]} frames
 * @param {number[]} delays
 * @param {number} _loop
 * @param {number} targetSize
 * @param {number} [quality=80]
 * @returns {Promise<{ animBuf: Buffer, staticBuf: Buffer, heroFrameIndex: number }>}
 */
async function encodeAnimatedWebP(frames, delays, _loop, targetSize, quality = 80) {
    const sampled = downsampleFrames(frames, delays);
    const rawFrames = [];
    for (const framePng of sampled.frames) {
        const raw = await sharp(framePng)
            .resize(targetSize, targetSize)
            .ensureAlpha()
            .raw()
            .toBuffer();
        rawFrames.push(raw);
    }

    const animBuf = await sharp(Buffer.concat(rawFrames), {
        raw: {
            width: targetSize,
            height: targetSize * rawFrames.length,
            channels: 4,
            pageHeight: targetSize
        }
    })
        .webp({ quality, effort: 4, loop: 1, delay: sampled.delays })
        .toBuffer();

    // Pick hero keyframe: energy scoring inside active 20%-85% window
    const startIdx = rawFrames.length >= 5 ? Math.floor(rawFrames.length * 0.2) : 0;
    const endIdx = rawFrames.length >= 5 ? Math.ceil(rawFrames.length * 0.85) : rawFrames.length;
    let bestIdx = startIdx;
    let bestScore = -1;
    for (let i = startIdx; i < endIdx; i++) {
        const buf = rawFrames[i];
        let score = 0;
        for (let p = 0; p < buf.length; p += 4) {
            const a = buf[p + 3];
            if (a > 0) {
                score += (buf[p] + buf[p + 1] + buf[p + 2] + 32) * a;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }

    const staticBuf = await sharp(rawFrames[bestIdx], {
        raw: { width: targetSize, height: targetSize, channels: 4 }
    })
        .webp({ quality })
        .toBuffer();

    return { animBuf, staticBuf, heroFrameIndex: bestIdx };
}

/**
 * Optimizes an APNG buffer by generating responsive animated WebP and static poster WebP files.
 *
 * @param {Buffer} apngBuffer - Source APNG file buffer.
 * @param {string} baseName - Base output path without extension (e.g. ".../aq_ranked_bonus").
 * @param {number[]} [sizes=[200, 100]] - Array of pixel dimensions to generate.
 * @param {boolean} [verbose=false] - Whether to log conversion progress.
 * @param {Buffer|null} [staticBuffer=null] - Optional official static master PNG buffer.
 * @returns {Promise<void>}
 */
async function optimizeApng(apngBuffer, baseName, sizes = [200, 100], verbose = false, staticBuffer = null) {
    const { loop, delays, frames } = await decodeApngToFramePngs(apngBuffer);
    const dir = path.dirname(baseName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    for (const size of sizes) {
        const { animBuf, staticBuf: fallbackStaticBuf } = await encodeAnimatedWebP(frames, delays, loop, size, 80);
        let staticBuf;
        if (staticBuffer) {
            staticBuf = await sharp(staticBuffer)
                .resize(size, size)
                .webp({ quality: 80 })
                .toBuffer();
        } else {
            staticBuf = fallbackStaticBuf;
        }

        fs.writeFileSync(`${baseName}-${size}.webp`, animBuf);
        fs.writeFileSync(`${baseName}-${size}-static.webp`, staticBuf);
        if (verbose) {
            console.log(`[APNG Optimizer] Generated ${baseName}-${size}.webp (${animBuf.length} B) and ${baseName}-${size}-static.webp (${staticBuf.length} B)`);
        }
    }
}

module.exports = {
    isApng,
    optimizeApng
};
