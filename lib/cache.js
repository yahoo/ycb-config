/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */

'use strict';

/**
 * Entry class used as map values and intrusive linked list nodes.
 */
function Entry(key, value, setAt, expiresAt, groupId) {
    this.next = null;
    this.prev = null;
    this.key = key;
    this.value = value;
    this.setAt = setAt;
    this.expiresAt = expiresAt;
    this.groupId = groupId;
}

/**
 * LRU cache.
 * Supported options are {max: int} which will set the max capacity of the cache.
 */
function ConfigCache(options) {
    options = options || {};
    this.max = options.max;
    if (!Number.isInteger(options.max) || options.max < 0) {
        console.log('WARNING: no valid cache capacity given, defaulting to 100. %s', JSON.stringify(options));
        this.max = 100;
    }
    if (this.max === 0) {
        this.get = this.set = this.getTimeAware = this.setTimeAware = function () {};
    }
    this.size = 0;
    this.map = new Map(); //key -> Entry
    this.youngest = null;
    this.oldest = null;
}

ConfigCache.prototype = {
    /**
     * Set a cache entry.
     * @param {string} key Key mapping to this value.
     * @param {*} value Value to be cached.
     * @param {number} groupId Id of the entry's group, used to lazily invalidate subsets of the cache.
     */
    set(key, value, groupId) {
        this.setTimeAware(key, value, 0, 0, groupId);
    },

    /**
     * Set a time aware cache entry.
     * @param {string} key Key mapping to this value.
     * @param {*} value Value to be cached.
     * @param {number} now  Current time.
     * @param {number} expiresAt Time at which entry will become stale.
     * @param {number} groupId Id of the entry's group, used to lazily invalidate subsets of the cache.
     */
    setTimeAware(key, value, now, expiresAt, groupId) {
        var entry = this.map.get(key);
        if (entry !== undefined) {
            entry.value = value;
            entry.setAt = now;
            entry.expiresAt = expiresAt;
            entry.groupId = groupId;
            this._makeYoungest(entry);
            return;
        }
        if (this.size === this.max) {
            entry = this.oldest;
            this.map['delete'](entry.key);
            entry.key = key;
            entry.value = value;
            entry.setAt = now;
            entry.expiresAt = expiresAt;
            entry.groupId = groupId;
            this.map.set(key, entry);
            this._makeYoungest(entry);
            return;
        }
        entry = new Entry(key, value, now, expiresAt, groupId);
        this.map.set(key, entry);
        if (this.size === 0) {
            this.youngest = entry;
            this.oldest = entry;
            this.size = 1;
            return;
        }
        entry.next = this.youngest;
        this.youngest.prev = entry;
        this.youngest = entry;
        this.size++;
    },

    /**
     * Get value from the cache. Will return undefined if entry is not in cache or is stale.
     * @param {string} key Key to look up in cache.
     * @param {number} groupId Group id to check if value is stale.
     * @returns {*}
     */
    get(key, groupId) {
        var entry = this.map.get(key);
        if (entry !== undefined) {
            if (groupId !== entry.groupId) {
                return undefined; //do not clean up stale entry as we know client code will set this key
            }
            this._makeYoungest(entry);
            return entry.value;
        }
        return undefined;
    },

    /**
     * Get value from the cache with time awareness. Will return undefined if entry is not in cache or is stale.
     * @param {string} key Key to look up in cache.
     * @param {number} now Current time to check if value is stale.
     * @param {number} groupId Group id to check if value is stale.
     * @returns {*}
     */
    getTimeAware(key, now, groupId) {
        var entry = this.map.get(key);
        if (entry !== undefined) {
            if (groupId !== entry.groupId || now < entry.setAt || now >= entry.expiresAt) {
                return undefined; //do not clean up stale entry as we know client code will set this key
            }
            this._makeYoungest(entry);
            return entry.value;
        }
        return undefined;
    },

    /**
     * Move entry to the head of the list and set as youngest.
     * @param {Entry} entry
     * @private
     */
    _makeYoungest(entry) {
        if (entry === this.youngest) {
            return;
        }
        var prev = entry.prev;
        if (entry === this.oldest) {
            prev.next = null;
            this.oldest = prev;
        } else {
            prev.next = entry.next;
            entry.next.prev = prev;
        }
        entry.prev = null;
        this.youngest.prev = entry;
        entry.next = this.youngest;
        this.youngest = entry;
    },
};

module.exports = ConfigCache;
