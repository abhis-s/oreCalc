/**
 * Scoped Lifecycle Ownership Container for Route Controllers.
 * Coordinates AbortSignal-backed listeners, timers, animation frames, observers,
 * and teardown hooks so exiting a soft-navigated route disposes cleanly.
 * Tier 3: Core Lifecycle Engine.
 */

/**
 * Manages cancellable asynchronous resources and DOM listeners for a single mounted route.
 */
export class RouteLifecycleScope {
    /** @type {AbortController} */
    #controller = new AbortController();

    /** @type {boolean} */
    #active = true;

    /** @type {Set<ReturnType<typeof setTimeout>>} */
    #timers = new Set();

    /** @type {Set<number>} */
    #rafs = new Set();

    /** @type {Array<() => void>} */
    #cleanups = [];

    /**
     * Exposed AbortSignal aborted when this scope is disposed.
     *
     * @returns {AbortSignal}
     */
    get signal() {
        return this.#controller.signal;
    }

    /**
     * Indicates whether the lifecycle scope is currently active.
     *
     * @returns {boolean}
     */
    get active() {
        return this.#active;
    }

    /**
     * Registers a scoped event listener on a DOM or EventTarget object.
     * Automatically detaches on dispose() via both AbortSignal and explicit removal fallback.
     *
     * @param {EventTarget | { addEventListener?: Function, removeEventListener?: Function } | null | undefined} target
     * @param {string} type
     * @param {EventListener | ((event: any) => void)} handler
     * @param {boolean | AddEventListenerOptions} [options]
     * @returns {() => void}
     */
    listen(target, type, handler, options) {
        if (!this.#active || !target || typeof target.addEventListener !== 'function' || typeof handler !== 'function') {
            return () => {};
        }

        const normalizedOpts = typeof options === 'boolean'
            ? { capture: options }
            : (options ? { ...options } : {});

        const scopedHandler = (event) => {
            if (!this.#active) return;
            handler(event);
        };

        const listenerOptions = { ...normalizedOpts, signal: this.#controller.signal };
        target.addEventListener(type, scopedHandler, listenerOptions);

        const cleanup = () => {
            if (typeof target.removeEventListener === 'function') {
                try {
                    target.removeEventListener(type, scopedHandler, normalizedOpts);
                } catch (_) {}
            }
        };

        this.#cleanups.push(cleanup);
        return cleanup;
    }

    /**
     * Schedules a timeout that automatically clears if the scope disposes before firing.
     *
     * @param {() => void} callback
     * @param {number} [delayMs=0]
     * @returns {ReturnType<typeof setTimeout> | null}
     */
    setTimeout(callback, delayMs = 0) {
        if (!this.#active || typeof callback !== 'function') return null;
        const timerId = globalThis.setTimeout(() => {
            this.#timers.delete(timerId);
            if (this.#active) callback();
        }, delayMs);
        this.#timers.add(timerId);
        return timerId;
    }

    /**
     * Schedules a requestAnimationFrame callback that cancels if the scope disposes early.
     *
     * @param {(timestamp: number) => void} callback
     * @returns {number | null}
     */
    requestAnimationFrame(callback) {
        if (!this.#active || typeof globalThis.requestAnimationFrame !== 'function' || typeof callback !== 'function') {
            return null;
        }
        const rafId = globalThis.requestAnimationFrame((timestamp) => {
            this.#rafs.delete(rafId);
            if (this.#active) callback(timestamp);
        });
        this.#rafs.add(rafId);
        return rafId;
    }

    /**
     * Registers a cleanup function or disposable resource (observer, controller, handle).
     *
     * @template T
     * @param {T} resource
     * @returns {T}
     */
    track(resource) {
        if (!this.#active || !resource) return resource;

        if (typeof resource === 'function') {
            this.#cleanups.push(/** @type {() => void} */ (resource));
        } else if (typeof (/** @type {any} */ (resource)).dispose === 'function') {
            this.#cleanups.push(() => (/** @type {any} */ (resource)).dispose());
        } else if (typeof (/** @type {any} */ (resource)).destroy === 'function') {
            this.#cleanups.push(() => (/** @type {any} */ (resource)).destroy());
        } else if (typeof (/** @type {any} */ (resource)).disconnect === 'function') {
            this.#cleanups.push(() => (/** @type {any} */ (resource)).disconnect());
        }

        return resource;
    }

    /**
     * Atomically aborts listeners, cancels pending timers/frames, and runs tracked cleanups.
     * Safe to call multiple times cleanly.
     */
    dispose() {
        if (!this.#active) return;
        this.#active = false;

        try {
            this.#controller.abort();
        } catch (_) {}

        for (const timerId of this.#timers) {
            globalThis.clearTimeout(timerId);
        }
        this.#timers.clear();

        if (typeof globalThis.cancelAnimationFrame === 'function') {
            for (const rafId of this.#rafs) {
                globalThis.cancelAnimationFrame(rafId);
            }
        }
        this.#rafs.clear();

        const pendingCleanups = this.#cleanups.splice(0).reverse();
        for (const cleanup of pendingCleanups) {
            try {
                cleanup();
            } catch (_) {}
        }
    }
}
