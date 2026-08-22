import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deepFreeze } from '../../js/utils/objectUtils.js';

describe('deepFreeze Utility Test Suite', () => {

    describe('1. Primitive Value Handling', () => {
        test('Returns primitives unmodified without throwing errors', () => {
            assert.equal(deepFreeze(null), null);
            assert.equal(deepFreeze(undefined), undefined);
            assert.equal(deepFreeze(42), 42);
            assert.equal(deepFreeze('clash'), 'clash');
            assert.equal(deepFreeze(true), true);
            assert.equal(deepFreeze(false), false);

            const sym = Symbol('test');
            assert.equal(deepFreeze(sym), sym);

            const big = BigInt(123456);
            assert.equal(deepFreeze(big), big);
        });
    });

    describe('2. Shallow Object Immutability', () => {
        test('Freezes flat objects and prevents modifications', () => {
            const obj = { shiny: 100, glowy: 50 };
            const frozen = deepFreeze(obj);

            assert.strictEqual(frozen, obj);
            assert.ok(Object.isFrozen(frozen));

            assert.throws(() => {
                frozen.shiny = 200;
            }, TypeError);

            assert.throws(() => {
                delete frozen.glowy;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                frozen.starry = 10;
            }, TypeError);
        });
    });

    describe('3. Deep Nested Object Immutability', () => {
        test('Recursively freezes deeply nested objects down to leaf nodes', () => {
            const complexData = {
                level1: {
                    level2: {
                        level3: {
                            leafValue: 'immutable',
                            count: 99
                        }
                    }
                }
            };

            const frozen = deepFreeze(complexData);

            assert.ok(Object.isFrozen(frozen));
            assert.ok(Object.isFrozen(frozen.level1));
            assert.ok(Object.isFrozen(frozen.level1.level2));
            assert.ok(Object.isFrozen(frozen.level1.level2.level3));

            assert.throws(() => {
                frozen.level1.level2.level3.leafValue = 'mutated';
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                frozen.level1.level2.newBranch = {};
            }, TypeError);
        });
    });

    describe('4. Array & Nested Collection Immutability', () => {
        test('Freezes arrays and all contained object elements', () => {
            const list = [
                { id: 'item1', value: 10 },
                { id: 'item2', value: 20 },
                { id: 'item3', value: 30 }
            ];

            const frozen = deepFreeze(list);

            assert.ok(Object.isFrozen(frozen));
            for (const item of frozen) {
                assert.ok(Object.isFrozen(item));
            }

            assert.throws(() => {
                frozen[0].value = 999;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                frozen.push({ id: 'item4', value: 40 });
            }, TypeError);

            assert.throws(() => {
                frozen.pop();
            }, TypeError);

            assert.throws(() => {
                frozen.splice(0, 1);
            }, TypeError);

            assert.throws(() => {
                frozen.shift();
            }, TypeError);

            assert.throws(() => {
                frozen.reverse();
            }, TypeError);

            assert.throws(() => {
                frozen.sort();
            }, TypeError);
        });

        test('Freezes objects containing nested arrays with nested objects', () => {
            const catalogue = {
                category: 'ores',
                tiers: [
                    { name: 'Common', caps: [9, 12, 15, 18] },
                    { name: 'Epic', caps: [12, 15, 18, 21, 24, 27] }
                ]
            };

            const frozen = deepFreeze(catalogue);

            assert.ok(Object.isFrozen(frozen));
            assert.ok(Object.isFrozen(frozen.tiers));
            assert.ok(Object.isFrozen(frozen.tiers[0]));
            assert.ok(Object.isFrozen(frozen.tiers[0].caps));
            assert.ok(Object.isFrozen(frozen.tiers[1]));
            assert.ok(Object.isFrozen(frozen.tiers[1].caps));

            assert.throws(() => {
                frozen.tiers[0].caps[0] = 99;
            }, TypeError);

            assert.throws(() => {
                // @ts-ignore
                frozen.tiers[1].caps.push(30);
            }, TypeError);
        });
    });

    describe('5. Idempotency & Safety', () => {
        test('Handles already frozen objects idempotently without error', () => {
            const obj = { a: 1 };
            Object.freeze(obj);

            const frozen = deepFreeze(obj);
            assert.strictEqual(frozen, obj);
            assert.ok(Object.isFrozen(frozen));

            const doubleFrozen = deepFreeze(frozen);
            assert.strictEqual(doubleFrozen, frozen);
        });
    });
});
