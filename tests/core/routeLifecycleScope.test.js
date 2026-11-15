import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RouteLifecycleScope } from '../../js/core/routeLifecycleScope.js';

describe('RouteLifecycleScope', () => {
    test('aborts native EventTarget listeners and blocks invocation after dispose()', () => {
        const scope = new RouteLifecycleScope();
        const target = new EventTarget();
        let count = 0;

        scope.listen(target, 'app:test', () => {
            count += 1;
        });

        assert.equal(scope.active, true);
        assert.equal(scope.signal.aborted, false);

        target.dispatchEvent(new Event('app:test'));
        assert.equal(count, 1);

        scope.dispose();
        assert.equal(scope.active, false);
        assert.equal(scope.signal.aborted, true);

        target.dispatchEvent(new Event('app:test'));
        assert.equal(count, 1);
    });

    test('detaches synthetic EventTarget listeners lacking native AbortSignal support', () => {
        const scope = new RouteLifecycleScope();
        const listeners = new Set();
        const mockTarget = {
            addEventListener: (_type, fn) => listeners.add(fn),
            removeEventListener: (_type, fn) => listeners.delete(fn)
        };

        let calls = 0;
        scope.listen(mockTarget, 'resize', () => {
            calls += 1;
        });
        assert.equal(listeners.size, 1);

        for (const fn of listeners) fn({});
        assert.equal(calls, 1);

        scope.dispose();
        assert.equal(listeners.size, 0);
    });

    test('clears pending timers, disconnects observers, and keeps dispose() idempotent', () => {
        const origSetTimeout = globalThis.setTimeout;
        const origClearTimeout = globalThis.clearTimeout;
        const clearedIds = [];
        let nextTimerId = 100;

        globalThis.setTimeout = /** @type {any} */ (() => {
            nextTimerId += 1;
            return nextTimerId;
        });
        globalThis.clearTimeout = (id) => {
            clearedIds.push(id);
        };

        try {
            const scope = new RouteLifecycleScope();
            let disconnects = 0;
            let customCleanups = 0;

            const scheduledId = scope.setTimeout(() => {}, 15);
            scope.track({
                disconnect: () => {
                    disconnects += 1;
                }
            });
            scope.track(() => {
                customCleanups += 1;
            });

            scope.dispose();
            scope.dispose();

            assert.equal(disconnects, 1);
            assert.equal(customCleanups, 1);
            assert.deepEqual(clearedIds, [scheduledId]);
            assert.equal(scope.setTimeout(() => {}, 15), null);
        } finally {
            globalThis.setTimeout = origSetTimeout;
            globalThis.clearTimeout = origClearTimeout;
        }
    });
});
