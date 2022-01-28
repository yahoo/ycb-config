'use strict';

var expect = require('chai').expect,
    LRU = require('../../lib/cache');

function assertEqual(a, b) {
    expect(a).to.equal(b);
}

var p = [91, 7, 20, 50];
//public domain http://pracrand.sourceforge.net/license.txt
function prng() {
    for (var i = 0; i < 4; i++) {
        p[i] >>>= 0;
    }
    var x = (p[0] + p[1]) | 0;
    p[0] = p[1] ^ (p[1] >>> 9);
    p[1] = (p[2] + 8 * p[2]) | 0;
    p[2] = (p[2] * 2097152) | (p[2] >>> 11);
    p[3]++;
    p[3] |= 0;
    x += p[3];
    x |= 0;
    p[2] += x;
    p[2] |= 0;
    return (x >>> 0) / 4294967296;
}

function getRandomInt(max) {
    return Math.floor(prng() * max);
}

//verify internal structure of the cache
function validateCacheStructure(cache) {
    var i;
    var refs = new Map();
    var current = cache.youngest;
    assertEqual(cache.size >= 0, true);
    assertEqual(cache.size <= cache.max, true);
    assertEqual(cache.size === cache.map.size, true);
    if (cache.size === 0) {
        assertEqual(cache.youngest, null);
        assertEqual(cache.oldest, null);
        return;
    }
    refs.set(current, 1);
    for (i = 0; i < cache.size - 1; i++) {
        current = current.next;
        refs.set(current, 1);
    }
    assertEqual(current.next, null);
    assertEqual(current, cache.oldest);
    for (i = 0; i < cache.size - 1; i++) {
        refs.set(current, refs.get(current) + 1);
        current = current.prev;
    }
    refs.set(current, refs.get(current) + 1);
    assertEqual(current.prev, null);
    assertEqual(current, cache.youngest);
    assertEqual(refs.size, cache.map.size);
    refs.forEach(function (value, key) {
        assertEqual(value, 2);
        assertEqual(cache.map.has(key.key), true);
    });
}

describe('cache', function () {
    describe('init', function () {
        it('should start empty', function () {
            var cache = new LRU({ max: 10 });
            assertEqual(cache.size, 0);
            assertEqual(cache.max, 10);
        });
        it('should default to 100 capacity', function () {
            var cache = new LRU();
            assertEqual(cache.max, 100);
            cache = new LRU({ max: 'foo' });
            assertEqual(cache.max, 100);
        });
        it('should handle zero capacity', function () {
            var cache = new LRU({ max: 0 });
            cache.get('key', 1);
            cache.set('key', 'val', 1);
            assertEqual(cache.get('key', 1), undefined);
            assertEqual(cache.size, 0);
        });
    });

    describe('set', function () {
        it('should store capacity number of unique entries', function () {
            var cache = new LRU({ max: 20 });
            for (var i = 0; i < 30; i++) {
                assertEqual(cache.size, i < 20 ? i : 20);
                cache.set(i, null, 0);
            }
        });
        it('should store same entry once', function () {
            var cache = new LRU({ max: 20 });
            for (var i = 0; i < 10; i++) {
                cache.set('key', null, i);
                assertEqual(cache.size, 1);
            }
        });
    });

    describe('get', function () {
        it('should get a stored key', function () {
            var cache = new LRU({ max: 20 });
            cache.set('foo', 'bar', 1);
            assertEqual(cache.get('foo', 1), 'bar');
        });
        it('should return undefined for missing key', function () {
            var cache = new LRU({ max: 20 });
            assertEqual(cache.get('foo', 1), undefined);
        });
        it('should return undefined for group mismatch', function () {
            var cache = new LRU({ max: 20 });
            cache.set('foo', 'bar', 1);
            assertEqual(cache.get('foo', 0), undefined);
        });
    });

    describe('least recently used', function () {
        it('evict oldest entry', function () {
            var cache = new LRU({ max: 2 });
            cache.set('a', 'A', 1);
            cache.set('b', 'B', 2);
            cache.set('c', 'C', 3);
            assertEqual(cache.get('c', 3), 'C');
            assertEqual(cache.get('b', 2), 'B');
            assertEqual(cache.get('a', 1), undefined);
        });
        it('get should update entry age', function () {
            var cache = new LRU({ max: 2 });
            cache.set('a', 'A', 1);
            cache.set('b', 'B', 1);
            cache.get('a', 1);
            cache.set('c', 'C', 1);
            assertEqual(cache.get('c', 1), 'C');
            assertEqual(cache.get('b', 1), undefined);
            assertEqual(cache.get('a', 1), 'A');
        });
        it('should be valid even if not filled to capacity', function () {
            var counter = 0;
            var cache = new LRU({ max: 500 });
            for (var i = 0; i < 200; i++) {
                cache.set(getRandomInt(150), counter++, 1);
                var current = cache.youngest;
                while (current.next !== null) {
                    assertEqual(current.value > current.next.value, true);
                    current = current.next;
                }
                validateCacheStructure(cache);
            }
        });
        it('entries should be ordered by age of set', function () {
            var counter = 0;
            var cache = new LRU({ max: 40 });
            for (var i = 0; i < 1000; i++) {
                cache.set(getRandomInt(150), counter++, 1);
                var current = cache.youngest;
                while (current.next !== null) {
                    assertEqual(current.value > current.next.value, true);
                    current = current.next;
                }
                validateCacheStructure(cache);
            }
        });
        it('entries should be ordered by age of set and get', function () {
            var counter = 0;
            var cache = new LRU({ max: 40 });
            for (var i = 0; i < 1000; i++) {
                var key = getRandomInt(150);
                if (prng() > 0.5) {
                    if (cache.get(key, 1) !== undefined) {
                        cache.map.get(key).value = counter++; //manually update entries age value
                    }
                } else {
                    cache.set(key, counter++, 1);
                }
                if (cache.size > 0) {
                    var current = cache.youngest;
                    while (current.next !== null) {
                        assertEqual(current.value > current.next.value, true);
                        current = current.next;
                    }
                }
                validateCacheStructure(cache);
            }
        });
    });

    describe('staleness', function () {
        it('should not return mismatched groups', function () {
            var cache = new LRU({ max: 20 });
            cache.set('foo', 'bar', 1);
            assertEqual(cache.get('foo', 2), undefined);
        });
        it('should not return mismatched groups time aware', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 500, 2), undefined);
        });
        it('should not return expired keys', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 2000, 1), undefined);
        });
        it('should not return keys that expire at same time', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 1000, 1), undefined);
        });
        it('should not return keys set in the future', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 5, 1), undefined);
        });
        it('should return keys set at same time', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 10, 1), 'bar');
        });
        it('should return keys expiring in one tick', function () {
            var cache = new LRU({ max: 20 });
            cache.setTimeAware('foo', 'bar', 10, 1000, 1);
            assertEqual(cache.getTimeAware('foo', 999, 1), 'bar');
        });
    });

    describe('time', function () {
        it('expire entries', function () {
            var cache = new LRU({ max: 40 });
            var maxTime = 2000;
            for (var i = 0; i < 1000; i++) {
                var key = getRandomInt(150);
                var now = getRandomInt(maxTime);
                if (prng() > 0.5) {
                    var val = cache.getTimeAware(key, now, 1);
                    if (val !== undefined) {
                        assertEqual(val.set <= now, true);
                        assertEqual(val.expires > now, true);
                    }
                } else {
                    var expiresAt = now + getRandomInt(maxTime - now);
                    cache.setTimeAware(key, { set: now, expires: expiresAt }, now, expiresAt, 1);
                }
                validateCacheStructure(cache);
            }
        });
        it('expire entries with realistic times', function () {
            var cache = new LRU({ max: 40 });
            var maxTime = 1567586543000;
            for (var i = 0; i < 1000; i++) {
                var key = getRandomInt(150);
                var now = getRandomInt(maxTime) + 1566586543000;
                if (prng() > 0.5) {
                    var val = cache.getTimeAware(key, now, 1);
                    if (val !== undefined) {
                        assertEqual(val.set <= now, true);
                        assertEqual(val.expires > now, true);
                    }
                } else {
                    var expiresAt = now + getRandomInt(maxTime - now);
                    cache.setTimeAware(key, { set: now, expires: expiresAt }, now, expiresAt, 1);
                }
                validateCacheStructure(cache);
            }
        });
    });

    describe('internal structure', function () {
        it('should be a mapped doubly linked list', function () {
            var n = 10;
            var cache = new LRU({ max: n });
            for (var i = 0; i < n + 5; i++) {
                validateCacheStructure(cache);
                cache.set(i, 'val-' + i, 1);
            }
            validateCacheStructure(cache);
        });
    });
});
