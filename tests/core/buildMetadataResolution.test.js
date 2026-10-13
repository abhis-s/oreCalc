import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveBuildMetadata } = require('../../scripts/build.js');

describe('Build Metadata Resolution Feature Suite', () => {
    test('resolveBuildMetadata exports a function', () => {
        assert.equal(typeof resolveBuildMetadata, 'function');
    });

    test('resolveBuildMetadata resolves local git metadata when repository is available', async () => {
        const pkg = { version: '3.0.0' };
        const result = await resolveBuildMetadata(pkg);

        assert.ok(result, 'result should be defined');
        assert.ok(typeof result.appVersion === 'string', 'appVersion should be a string');
        assert.ok(result.appVersion.startsWith('3.0.0'), 'appVersion should start with package version');
        assert.ok(Array.isArray(result.commitsSinceTag), 'commitsSinceTag should be an array');
    });

    test('resolveBuildMetadata queries clashcalc branch when local git is unavailable', async () => {
        const originalFetch = globalThis.fetch;
        const previousEnv = process.env.SIMULATE_NO_GIT;
        process.env.SIMULATE_NO_GIT = 'true';

        const requestedUrls = [];

        try {
            globalThis.fetch = async (url) => {
                const urlStr = String(url);
                requestedUrls.push(urlStr);

                if (urlStr.includes('sha=clashcalc')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => [
                            {
                                sha: 'a1780549edec80bee953ee4d106ca72660a048b9',
                                commit: {
                                    committer: { date: new Date().toISOString() },
                                    message: 'fix(player): resolve touch add player modal trigger'
                                }
                            }
                        ]
                    };
                }

                if (urlStr.includes('/tags')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => []
                    };
                }

                return { ok: false, status: 500 };
            };

            const pkg = { version: '3.0.0' };
            const result = await resolveBuildMetadata(pkg);

            assert.equal(result.appVersion, '3.0.0+a178054');
            assert.equal(result.commitsSinceTag.length, 1);
            assert.equal(result.commitsSinceTag[0].hash, 'a178054');
            assert.ok(requestedUrls.some(u => u.includes('sha=clashcalc')));
            assert.ok(!requestedUrls.some(u => u.includes('sha=main')));
        } finally {
            globalThis.fetch = originalFetch;
            if (previousEnv === undefined) {
                delete process.env.SIMULATE_NO_GIT;
            } else {
                process.env.SIMULATE_NO_GIT = previousEnv;
            }
        }
    });

    test('resolveBuildMetadata falls back to main branch when clashcalc branch returns 404', async () => {
        const originalFetch = globalThis.fetch;
        const previousEnv = process.env.SIMULATE_NO_GIT;
        process.env.SIMULATE_NO_GIT = 'true';

        const requestedUrls = [];

        try {
            globalThis.fetch = async (url) => {
                const urlStr = String(url);
                requestedUrls.push(urlStr);

                if (urlStr.includes('sha=clashcalc')) {
                    return {
                        ok: false,
                        status: 404,
                        json: async () => ({ message: 'Not Found' })
                    };
                }

                if (urlStr.includes('sha=main')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => [
                            {
                                sha: '8d8e7def9d984da618b654fc170f39d365fadef3',
                                commit: {
                                    committer: { date: new Date().toISOString() },
                                    message: 'fix(migration): resolve bootstrap error'
                                }
                            }
                        ]
                    };
                }

                if (urlStr.includes('/tags')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => []
                    };
                }

                return { ok: false, status: 500 };
            };

            const pkg = { version: '3.0.0' };
            const result = await resolveBuildMetadata(pkg);

            assert.equal(result.appVersion, '3.0.0+8d8e7de');
            assert.equal(result.commitsSinceTag.length, 1);
            assert.equal(result.commitsSinceTag[0].hash, '8d8e7de');
            assert.ok(requestedUrls.some(u => u.includes('sha=clashcalc')));
            assert.ok(requestedUrls.some(u => u.includes('sha=main')));
        } finally {
            globalThis.fetch = originalFetch;
            if (previousEnv === undefined) {
                delete process.env.SIMULATE_NO_GIT;
            } else {
                process.env.SIMULATE_NO_GIT = previousEnv;
            }
        }
    });

    test('resolveBuildMetadata handles malformed payloads gracefully', async () => {
        const originalFetch = globalThis.fetch;
        const previousEnv = process.env.SIMULATE_NO_GIT;
        process.env.SIMULATE_NO_GIT = 'true';

        try {
            globalThis.fetch = async () => {
                return {
                    ok: true,
                    status: 200,
                    json: async () => {
                        throw new Error('Malformed JSON');
                    }
                };
            };

            const pkg = { version: '3.0.0' };
            const result = await resolveBuildMetadata(pkg);

            assert.equal(result.appVersion, '3.0.0+dev');
            assert.deepEqual(result.commitsSinceTag, []);
        } finally {
            globalThis.fetch = originalFetch;
            if (previousEnv === undefined) {
                delete process.env.SIMULATE_NO_GIT;
            } else {
                process.env.SIMULATE_NO_GIT = previousEnv;
            }
        }
    });
});
