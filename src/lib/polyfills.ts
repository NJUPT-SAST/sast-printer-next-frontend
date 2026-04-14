const ensureMapUpsertPolyfills = () => {
    if (typeof Map !== 'undefined') {
        if (typeof (Map.prototype as Map<unknown, unknown> & { getOrInsertComputed?: unknown }).getOrInsertComputed !== 'function') {
            Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
                configurable: true,
                writable: true,
                value(this: Map<unknown, unknown>, key: unknown, callbackfn: (key: unknown) => unknown) {
                    if (this.has(key)) {
                        return this.get(key);
                    }

                    const canonicalKey = key === 0 && 1 / (key as number) === -Infinity ? 0 : key;
                    const value = callbackfn(canonicalKey);
                    this.set(canonicalKey, value);
                    return value;
                },
            });
        }

        if (typeof (Map.prototype as Map<unknown, unknown> & { getOrInsert?: unknown }).getOrInsert !== 'function') {
            Object.defineProperty(Map.prototype, 'getOrInsert', {
                configurable: true,
                writable: true,
                value(this: Map<unknown, unknown>, key: unknown, value: unknown) {
                    if (this.has(key)) {
                        return this.get(key);
                    }

                    this.set(key, value);
                    return value;
                },
            });
        }
    }

    if (typeof WeakMap !== 'undefined') {
        if (typeof (WeakMap.prototype as WeakMap<object, unknown> & { getOrInsertComputed?: unknown }).getOrInsertComputed !== 'function') {
            Object.defineProperty(WeakMap.prototype, 'getOrInsertComputed', {
                configurable: true,
                writable: true,
                value(this: WeakMap<object, unknown>, key: object, callbackfn: (key: object) => unknown) {
                    if (typeof key !== 'object' || key === null) {
                        throw new TypeError('Invalid value used as weak map key');
                    }

                    if (this.has(key)) {
                        return this.get(key);
                    }

                    const value = callbackfn(key);
                    this.set(key, value);
                    return value;
                },
            });
        }

        if (typeof (WeakMap.prototype as WeakMap<object, unknown> & { getOrInsert?: unknown }).getOrInsert !== 'function') {
            Object.defineProperty(WeakMap.prototype, 'getOrInsert', {
                configurable: true,
                writable: true,
                value(this: WeakMap<object, unknown>, key: object, value: unknown) {
                    if (typeof key !== 'object' || key === null) {
                        throw new TypeError('Invalid value used as weak map key');
                    }

                    if (this.has(key)) {
                        return this.get(key);
                    }

                    this.set(key, value);
                    return value;
                },
            });
        }
    }
};

ensureMapUpsertPolyfills();
