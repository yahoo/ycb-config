
/*jslint nomen:true, anon:true, node:true, esversion:6  */
'use strict';

class Entry {
    constructor (key, value, setAt, expiresAt, groupId) {
        this.next = null;
        this.prev = null;
        this.key = key;
        this.value = value;
        this.setAt = setAt;
        this.expiresAt = expiresAt;
        this.groupId = groupId;
    }
}

class ConfigCache {
    constructor(options) {
        options = options || {};
        this.max = options.max;
        if(!Number.isInteger(options.max) || options.max < 0) {
            console.log('WARNING: no valid cache capacity given, defaulting to 100. %s', JSON.stringify(options));
            this.max = 100;
        }
        if(this.max === 0) {
            this.get = this.set = this.getTimeAware = this.setTimeAware = function(){};
        }
        this.size = 0;
        this.map = new Map(); //key -> Entry
        this.youngest = null;
        this.oldest = null;
    }

    set(key, value, groupId) {
        var entry = this.map.get(key);
        if(entry !== undefined) {
            entry.value = value;
            entry.groupId = groupId;
            this._makeYoungest(entry);
            return;
        }
        if(this.size === this.max) {
            entry = this.oldest;
            this.map.delete(entry.key);
            entry.key = key;
            entry.value = value;
            entry.groupId = groupId;
            this.map.set(key, entry);
            this._makeYoungest(entry);
            return;
        }
        entry = new Entry(key, value, 0, 0, groupId);
        this.map.set(key, entry);
        if(this.size === 0) {
            this.youngest = entry;
            this.oldest = entry;
            this.size = 1;
            return;
        }
        entry.next = this.youngest;
        this.youngest.prev = entry;
        this.youngest = entry;
        this.size++;
    }

    setTimeAware(key, value, now, expiresAt, groupId) {
        var entry = this.map.get(key);
        if(entry !== undefined) {
            entry.value = value;
            entry.setAt = now;
            entry.expiresAt = expiresAt;
            entry.groupId = groupId;
            this._makeYoungest(entry);
            return;
        }
        if(this.size === this.max) {
            entry = this.oldest;
            this.map.delete(entry.key);
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
        if(this.size === 0) {
            this.youngest = entry;
            this.oldest = entry;
            this.size = 1;
            return;
        }
        entry.next = this.youngest;
        this.youngest.prev = entry;
        this.youngest = entry;
        this.size++;
    }

    get(key, groupId) {
        var entry = this.map.get(key);
        if(entry !== undefined) {
            if(groupId !== entry.groupId) {
                return undefined;
            }
            this._makeYoungest(entry);
            return entry.value;
        }
        return undefined;
    }

    getTimeAware(key, now, groupId) {
        var entry = this.map.get(key);
        if(entry !== undefined) {
            if(groupId !== entry.groupId || now < entry.setAt || now >= entry.expiresAt){
                return undefined;
            }
            this._makeYoungest(entry);
            return entry.value;
        }
        return undefined;
    }

    _makeYoungest(entry) {
        if(entry === this.youngest) {
            return;
        }
        var prev = entry.prev;
        if(entry === this.oldest) {
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
    }
}

module.exports = ConfigCache;