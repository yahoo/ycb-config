/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */

'use strict';

var libfs = require('fs'),
    util = require('util'),
    libpath = require('path'),
    libycb = require('ycb'),
    libjson5 = require('json5'),
    libyaml = require('yamljs'),
    libcache = require('./cache'),
    deepFreeze = require('deep-freeze'),
    promisify = require('util').promisify,
    loadModule = require('./mod'),
    MESSAGES = require('./messages'),
    DEFAULT_CACHE_OPTIONS = {
        max: 250,
    };

function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function mix(target, source, overwrite) {
    var prop;
    for (prop in source) {
        if (source.hasOwnProperty(prop) && (overwrite || !target.hasOwnProperty(prop))) {
            target[prop] = source[prop];
        }
    }
    return target;
}

/**
 * A component for reading configuration files.
 * @module YcbConfig
 */

/**
 * Determines if a config is YCB or not.
 * @private
 * @static
 * @method contentsIsYCB
 * @param {mixed} contents The config contents.
 * @return {boolean} Whether the config is YCB or not.
 */
function contentsIsYCB(contents) {
    var s, section;
    // not sure what this is
    if ('object' !== typeof contents) {
        return false;
    }
    if (Array.isArray(contents) && contents.length) {
        for (s = 0; s < contents.length; s += 1) {
            section = contents[s];
            if (!section.settings) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Create the YCB object.
 * @private
 * @static
 * @method makeYCB
 * @param {Config} config The config object.
 * @param {object} dimensions The dimensions definitions.
 * @param {array} contents The contents of the YCB file.
 * @param {string} path The path of the YCB file.
 * @return {YCB} The YCB object.
 */
function makeYCB(config, dimensions, contents, path) {
    var ycbBundle, ycb;
    contents = contents || {};
    ycbBundle = [{ dimensions: dimensions }];
    ycbBundle = ycbBundle.concat(clone(contents));
    ycb = new libycb.Ycb(ycbBundle, { logContext: path });
    return ycb;
}

/**
 * Create an object that presents the same interface as a YCB object.
 * @private
 * @static
 * @method makeFakeYCB
 * @param {object} dimensions The dimensions definitions.
 * @param {array} contents The contents of the YCB file.
 * @return {YCB} The fake YCB object.
 */
function makeFakeYCB(dimensions, contents) {
    return {
        getDimensions: function () {
            return dimensions;
        },
        walkSettings: function (callback) {
            callback({}, contents);
        },
        read: function () {
            return contents;
        },
        readNoMerge: function () {
            return [contents];
        },
        readTimeAware: function () {
            return contents;
        },
        readNoMergeTimeAware: function () {
            return [contents];
        },
        getCacheKey: function () {
            return '';
        },
    };
}

/**
 * @class YcbConfig
 * @constructor
 * @param {object} [options] Options for how the configuration files are handled.
 *   @param {object}  [options.baseContext] Context to apply to all reads.
 *   @param {object}  [options.cache] The configuration options passed to the LRU cache.
 *     By default, it stores a maximum of 250 configurations.
 *   @param {boolean} [options.clone] Whether the returned YCB object should be cloned.
 *     Use this if you plan on modifying the configuration object later.
 *   @param {string}  [options.dimensionsBundle] Bundle in which to find the dimensions file.
 *     See `readDimensions()` for details.
 *
 * @param {string} [options.dimensionsPath] Full path to the dimensions file.
 * See `readDimensions()` for details.
 * The context passed to `read()` will override this on a key-by-key bases.
 */
function Config(options) {
    this._options = options || {};
    this._dimensionsPath = this._options.dimensionsPath;
    this._configPaths = {}; // bundle: config: fullpath
    this._configContents = {}; // fullpath: contents
    this._configYCBs = {}; // fullpath: YCB object
    if (promisify) {
        this.promises = {
            addConfig: promisify(Config.prototype.addConfig).bind(this),
            addConfigContents: promisify(Config.prototype.addConfigContents).bind(this),
            read: promisify(Config.prototype.read).bind(this),
            readNoMerge: promisify(Config.prototype.readNoMerge).bind(this),
            readDimensions: promisify(Config.prototype.readDimensions).bind(this),
        };
    }
    this._pathCount = {}; // fullpath: number of configs using this path
    this._configCache = {}; // unused object for compability
    //cache fields:
    this._configIdCounter = 0; //incrementing counter assigned to config bundles to uniquely identify them for cache invalidation.
    this._configIdMap = {}; //id = _configIdMap[bundleName][configName]
    this._cache = new libcache(this._options.cache || DEFAULT_CACHE_OPTIONS);
    //time fields:
    this.timeAware = false;
    this.timeDimension = 'time';
    this.expiresKey = libycb.expirationKey;
    if (this._options.timeAware) {
        this.timeAware = true;
    }
    if (this._options.timeDimension) {
        this.timeAware = true;
        this.timeDimension = this._options.timeDimension;
    }
}
Config.prototype = {
    /**
     * Registers a configuration file.
     * @method addConfig
     * @async
     * @param {string} bundleName Name of the bundle to which this config file belongs.
     * @param {string} configName Name of the config file.
     * @param {string} fullPath Full filesystem path to the config file.
     * @param {Function} [callback] Called once the config has been added to the helper.
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {Object} callback.contents The contents of the config file, as a
     *   JavaScript object.
     */
    addConfig: function (bundleName, configName, fullPath, callback) {
        var self = this;
        callback = callback || function () {};
        self._readConfigContents(fullPath, function (err, contents) {
            if (err) {
                return callback(err);
            }
            self.addConfigContents(bundleName, configName, fullPath, contents, callback);
        });
    },

    /**
     * Registers a configuration file and its contents.
     * @method addConfigContents
     * @param {string} bundleName Name of the bundle to which this config file belongs.
     * @param {string} configName Name of the config file.
     * @param {string} fullPath Full filesystem path to the config file.
     * @param {string|Object} contents The contents for the config file at the path.
     * This will be parsed into an object (via JSON or YAML depending on the file extension)
     * unless it is already an object.
     * @param {Function} [callback] Called once the config has been added to the helper.
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {Object} callback.contents The contents of the config file, as a
     *   JavaScript object.
     */
    addConfigContents: function (bundleName, configName, fullPath, contents, callback) {
        var self = this;

        this._parseConfigContents(fullPath, contents, function (err, contents) {
            if (err) {
                return callback(err);
            }

            // deregister old config (if any)
            self.deleteConfig(bundleName, configName, fullPath);

            // register so that _readConfigContents() will use
            self._configContents[fullPath] = contents;

            if (!self._configPaths[bundleName]) {
                self._configPaths[bundleName] = {};
            }
            self._configPaths[bundleName][configName] = fullPath;

            if (!self._pathCount[fullPath]) {
                self._pathCount[fullPath] = 0;
            }
            self._pathCount[fullPath]++;

            //assign new config bundle a unique id by incrementing counter
            if (!self._configIdMap[bundleName]) {
                self._configIdMap[bundleName] = {};
            }

            self._configIdCounter = (self._configIdCounter + 1) % Number.MAX_SAFE_INTEGER;
            self._configIdMap[bundleName][configName] = self._configIdCounter;

            // keep path to dimensions file up-to-date
            if ('dimensions' === configName && !self._options.dimensionsPath) {
                if (self._options.dimensionsBundle) {
                    if (bundleName === self._options.dimensionsBundle) {
                        self._dimensionsPath = fullPath;
                    }
                } else {
                    if (self._dimensionsPath) {
                        if (fullPath.length < self._dimensionsPath.length) {
                            self._dimensionsPath = fullPath;
                        }
                    } else {
                        self._dimensionsPath = fullPath;
                    }
                }
            }

            if (callback) {
                callback(null, contents);
            }
        });
    },

    /**
     * Deregisters a configuration file.
     * @method deleteConfig
     * @param {string} bundleName Name of the bundle to which this config file belongs.
     * @param {string} configName Name of the config file.
     * @return {undefined} Nothing appreciable is returned.
     */
    deleteConfig: function (bundleName, configName) {
        var bundleMap = this._configPaths[bundleName];
        if (bundleMap) {
            var path = bundleMap[configName];
            if (path) {
                this._pathCount[path]--;
                if (this._pathCount[path] === 0) {
                    delete this._configYCBs[path];
                    delete this._configContents[path];
                    delete this._pathCount[path];
                }
            }
            delete bundleMap[configName];
            delete this._configIdMap[bundleName][configName];
            if (Object.keys(bundleMap).length === 0) {
                delete this._configPaths[bundleName];
            }
            if (Object.keys(this._configIdMap[bundleName]).length === 0) {
                delete this._configIdMap[bundleName];
            }
        }
    },

    /**
     * Generates a cache key based on config and bundle names, a separator, and a context based key.
     * Distinct separators can be used to distinguish distinct types of keys, e.g., merged and unmerged reads.
     *
     * @param {string} bundleName Name of bundle.
     * @param {string} separator Separator string to join bundle and config names.
     * @param {string} configName Name of config.
     * @param {string} contextKey Key based on the context.
     * @returns {string} cache key
     * @private
     */
    _getCacheKey: function (bundleName, separator, configName, contextKey) {
        return bundleName + separator + configName + contextKey;
    },

    /**
     * Reads the contents of the named configuration file.
     * This will auto-detect if the configuration file is YCB and read it in a context-sensitive way if so.
     *
     * This can possibly return the configuration object that is stored in a cache, so the caller should
     * copy it if they intend to make a modifications.
     * @method read
     * @async
     * @param {string} bundleName The bundle in which to find the configuration file.
     * @param {string} configName Which configuration to read.
     * @param {object} [context] The runtime context.
     * @param {Function} callback
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {Object} callback.config The merged configuration object, based on the
     *   provided context.
     */
    read: function (bundleName, configName, context, callback) {
        var self = this;
        self._getYCB(bundleName, configName, function (err, groupId, ycb) {
            if (err) {
                callback(err);
                return;
            }
            if (self._options.baseContext) {
                context = self._mergeBaseContext(context);
            }
            var key, config;
            key = self._getCacheKey(bundleName, ':m:', configName, ycb.getCacheKey(context));
            if (self.timeAware) {
                var now = context[self.timeDimension];
                if (now === undefined) {
                    callback(
                        new Error(util.format(MESSAGES['missing time'], self.timeDimension, JSON.stringify(context)))
                    );
                    return;
                }
                config = self._cache.getTimeAware(key, now, groupId);
                if (config === undefined) {
                    config = ycb.readTimeAware(context, now, { cacheInfo: true });
                    var expiresAt = config[self.expiresKey];
                    if (expiresAt === undefined) {
                        expiresAt = Number.POSITIVE_INFINITY;
                    }
                    if (self._options.safeMode) {
                        config = deepFreeze(config);
                    }
                    self._cache.setTimeAware(key, config, now, expiresAt, groupId);
                }
            } else {
                config = self._cache.get(key, groupId);
                if (config === undefined) {
                    config = ycb.read(context, {});
                    if (self._options.safeMode) {
                        config = deepFreeze(config);
                    }
                    self._cache.set(key, config, groupId);
                }
            }
            callback(null, config);
        });
    },

    /**
     * Reads the contents of the named configuration file and returns the sections
     * appropriate to the context.  The sections are returned in priority order
     * (most important first).
     *
     * If the file is not context sensitive then the list will contain a single section.
     *
     * This can possibly return the configuration object that is stored in a cache, so the caller should
     * copy it if they intend to make a modifications.
     * @method readNoMerge
     * @async
     * @param {string} bundleName The bundle in which to find the configuration file.
     * @param {string} configName Which configuration to read.
     * @param {object} [context] The runtime context.
     * @return {Function} callback
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then the `err` will be null.
     *   @param {Object} callback.contents The object containing the prioritized sections
     *   of the configuration file appropriate to the provided context.
     */
    readNoMerge: function (bundleName, configName, context, callback) {
        var self = this;
        self._getYCB(bundleName, configName, function (err, groupId, ycb) {
            if (err) {
                callback(err);
                return;
            }
            if (self._options.baseContext) {
                context = self._mergeBaseContext(context);
            }
            var key, config;
            key = self._getCacheKey(bundleName, ':um:', configName, ycb.getCacheKey(context));
            if (self.timeAware) {
                var now = context[self.timeDimension];
                if (now === undefined) {
                    callback(
                        new Error(util.format(MESSAGES['missing time'], self.timeDimension, JSON.stringify(context)))
                    );
                    return;
                }
                config = self._cache.getTimeAware(key, now, groupId);
                if (config === undefined) {
                    config = config = ycb.readNoMergeTimeAware(context, now, { cacheInfo: true });
                    var expiresAt = config.length > 0 ? config[0][self.expiresKey] : undefined;
                    if (expiresAt === undefined) {
                        expiresAt = Number.POSITIVE_INFINITY;
                    }
                    if (self._options.safeMode) {
                        config = deepFreeze(config);
                    }
                    self._cache.setTimeAware(key, config, now, expiresAt, groupId);
                }
            } else {
                config = self._cache.get(key, groupId);
                if (config === undefined) {
                    config = ycb.readNoMerge(context, {});
                    if (self._options.safeMode) {
                        config = deepFreeze(config);
                    }
                    self._cache.set(key, config, groupId);
                }
            }
            callback(null, config);
        });
    },

    /**
     * Reads the dimensions file for the application.
     *
     * If `options.dimensionsPath` is given to the constructor that'll be used.
     * Otherwise, the dimensions file found in `options.dimensionsBundle` will be used.
     * Otherwise, the dimensions file with the shortest path will be used.
     *
     * The returned dimensions object is shared, so it should not be modified.
     * @method readDimensions
     * @param {Function} callback
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {array} callback.dimensions The returned dimensions array.
     */
    readDimensions: function (callback) {
        var self = this;
        if (!self._dimensionsPath) {
            return callback(new Error(MESSAGES['missing dimensions']));
        }
        if (self._cachedDimensions) {
            return callback(null, self._cachedDimensions);
        }

        self._readConfigContents(self._dimensionsPath, function (err, body) {
            if (err) {
                return callback(err);
            }
            self._cachedDimensions = body[0].dimensions;
            delete self._configContents[self._dimensionsPath]; // no longer need this copy of dimensions
            return callback(null, self._cachedDimensions);
        });
    },

    /**
     * Provides a YCB object for the configuration file.
     * This returns a YCB object even if the configuration file isn't a YCB file.
     * @private
     * @method _getYCB
     * @async
     * @param {string} bundleName The bundle in which to find the configuration file.
     * @param {string} configName Which configuration to read.
     * @param {object} [context] The runtime context.
     * @param {Function} callback
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {Object} callback.ycb The returned YCB object.
     */
    _getYCB: function (bundleName, configName, callback) {
        var self = this,
            path,
            dimensions,
            ycb,
            isYCB;

        if (!self._configPaths[bundleName]) {
            return callback(new Error(util.format(MESSAGES['unknown bundle'], bundleName)));
        }
        path = self._configPaths[bundleName][configName];
        if (!path) {
            return callback(new Error(util.format(MESSAGES['unknown config'], configName, bundleName)));
        }

        var groupId = self._configIdMap[bundleName][configName];
        if (self._configYCBs[path]) {
            return callback(null, groupId, self._configYCBs[path]);
        }

        self._readConfigContents(path, function (err, contents) {
            if (err) {
                return callback(err);
            }

            isYCB = contentsIsYCB(contents);

            if (isYCB) {
                self.readDimensions(function (err, data) {
                    if (err) {
                        return callback(err);
                    }

                    dimensions = data;
                    ycb = self._makeYCBFromDimensions(path, dimensions, contents);
                    self._cacheYCB(bundleName, configName, path, groupId, ycb);
                    callback(null, groupId, ycb);
                });
            } else {
                ycb = self._makeYCBFromDimensions(path, dimensions, contents);
                self._cacheYCB(bundleName, configName, path, groupId, ycb);
                callback(null, groupId, ycb);
            }
        });
    },

    /**
     * Determines whether to make a YCB or fake YCB object from
     * a dimensions object.
     * @private
     * @method _makeYCBFromDimensions
     */

    _makeYCBFromDimensions: function (path, dimensions, contents) {
        var ycb;

        if (dimensions) {
            ycb = makeYCB(this, dimensions, contents, path);
        } else {
            ycb = makeFakeYCB(dimensions, contents);
        }
        return ycb;
    },

    /**
     * Saves a YCB instance for reuse.
     * Checks the config-bundle tags so we don't set it with a stale YCB instance
     * @param {string} bundleName the bundleName corresponding to the ycb instance
     * @param {string} configName the configName corresponding to the ycb instance
     * @param {string} path full path corresponding to the ycb instance
     * @param {number} groupId the initial id value to check against current value
     * @param ycb the ycb instance to cache
     * @private
     */
    _cacheYCB: function (bundleName, configName, path, groupId, ycb) {
        if (this._configIdMap[bundleName] && this._configIdMap[bundleName][configName] === groupId) {
            this._configYCBs[path] = ycb;
            delete this._configContents[path]; // no longer need to keep a copy of the config
        }
    },

    /**
     * Reads the contents of a configuration file.
     * @private
     * @method _readConfigContents
     * @async
     * @param {string} path Full path to the file.
     * @param {Function} callback
     *   @param {Error|null} callback.err If an error occurred, then this parameter will
     *   contain the error. If the operation succeeded, then `err` will be null.
     *   @param {Object} callback.contents The returned contents of the configuration file.
     */
    _readConfigContents: function (path, callback) {
        var self = this,
            ext = libpath.extname(path);

        if (this._configContents[path]) {
            callback(null, this._configContents[path]);
            return;
        }

        // really try to do things async as much as possible
        if ('.json' === ext || '.json5' === ext || '.yaml' === ext || '.yml' === ext) {
            libfs.readFile(path, 'utf8', function (err, contents) {
                if (err) {
                    return callback(err);
                }
                self._parseConfigContents(path, contents, function (err, contents) {
                    return callback(err, contents);
                });
            });
        } else {
            return loadModule(path, callback);
        }
    },

    _parseConfigContents: function (path, contents, callback) {
        var ext, error;
        // Sometimes the contents are already parsed.
        if ('object' !== typeof contents) {
            ext = libpath.extname(path);
            try {
                if ('.json' === ext) {
                    contents = JSON.parse(contents);
                } else if ('.json5' === ext) {
                    contents = libjson5.parse(contents);
                } else if ('.mjs' === ext || '.js' === ext) {
                    return loadModule(path, callback);
                } else {
                    contents = libyaml.parse(contents);
                }
            } catch (e) {
                error = new Error(util.format(MESSAGES['parse error'], path, e.message));
                if (callback) {
                    return callback(error);
                } else {
                    return error;
                }
            }
        }

        return callback ? callback(null, contents) : contents;
    },

    /**
     * Merges the base context under the runtime context.
     * @private
     * @method _mergeBaseContext
     * @param {object} context The runtime context.
     * @return {object} A new object with the context expanded with the base merged under.
     */
    _mergeBaseContext: function (context) {
        context = context || {};
        return mix(clone(context), this._options.baseContext);
    },
};

module.exports = Config;

Config.test = {
    contentsIsYCB: contentsIsYCB,
    makeYCB: makeYCB,
    makeFakeYCB: makeFakeYCB,
};
