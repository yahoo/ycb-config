/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, anon:true, node:true, forin:true */
"use strict";

var libfs       = require('fs'),
    util        = require('util'),
    libpath     = require('path'),
    libycb      = require('ycb'),
    libjson5    = require('json5'),
    libyaml     = require('yamljs'),
    libcache    = require('lru-cache'),
    deepFreeze  = require('deep-freeze'),

    MESSAGES = {
        'unknown bundle': 'Unknown bundle "%s"',
        'unknown config': 'Unknown config "%s" in bundle "%s"',
        'unknown cache data': 'Unknown cache data with config "%s" in bundle "%s"',
        'missing dimensions': 'Failed to find a dimensions.json file',
        'parse error': 'Failed to parse "%s"\n%s'
    },
    DEFAULT_CACHE_OPTIONS = {
        max: 250
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
 * @module ModownConfig
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
    var s,
        section;
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
            if (!Array.isArray(section.settings)) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Creates a cache key that will be one-to-one for each context object,
 * based on their contents.  JSON.stringify does not guarantee order for
 * two objects that have the same contents, so we need to have this.
 * @private
 * @static
 * @method getCacheKey
 * @param {mixed} context The context object.
 * @return {string} A JSON-parseable string that will be the same for all equivalent context objects.
 */

function getCacheKey(context) {
    var a = [],
        KV_START   = '"',
        KV_END     = '"',
        JSON_START = '{',
        JSON_END   = '}',
        key;

    for (key in context) {
        a.push([KV_START + key + KV_END,
                KV_START + context[key] + KV_END].join(':'));
    }

    a.sort();
    return JSON_START + a.toString() + JSON_END;
}

/**
 * Create the YCB object.
 * @private
 * @static
 * @method makeYCB
 * @param {Config} config The config object.
 * @param {object} dimensions The dimensions definitions.
 * @param {array} contents The contents of the YCB file.
 * @return {YCB} The YCB object.
 */
function makeYCB(config, dimensions, contents) {
    var ycbBundle,
        ycb,
        originalRead,
        originalReadNoMerge;

    contents = contents || {};
    ycbBundle = [{dimensions: dimensions}];
    // need to copy contents, since YCB messes with it
    ycbBundle = ycbBundle.concat(clone(contents));
    ycb = new libycb.Ycb(ycbBundle);

    // monkey-patch to apply baseContext
    originalRead = ycb.read;
    ycb.read = function (context, options) {
        return originalRead.call(ycb, config._mergeBaseContext(context), options);
    };
    originalReadNoMerge = ycb.readNoMerge;
    ycb.readNoMerge = function (context, options) {
        return originalReadNoMerge.call(ycb, config._mergeBaseContext(context), options);
    };
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
        }
    };
}


/**
 * @class ModownConfig
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
    this._configContents = {};  // fullpath: contents
    this._configPaths = {};     // bundle: config: fullpath
    // cached data:
    this._configYCBs = {};  // fullpath: YCB object
    this._configCache = {}; // bundle: config: context: config
}
Config.prototype = {};


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
Config.prototype.addConfig = function (bundleName, configName, fullPath, callback) {
    var self = this;
    callback = callback || function() {};
    self._readConfigContents(fullPath, function (err, contents) {
        if (err) {
            return callback(err);
        }
        self.addConfigContents(bundleName, configName, fullPath, contents, callback);
    });
};


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
Config.prototype.addConfigContents = function (bundleName, configName, fullPath, contents, callback) {
    var self = this;
    callback = callback || function() {};
    this._parseConfigContents(fullPath, contents, function(err, contents) {
        if (err) {
            return callback(err);
        }

        // register so that _readConfigContents() will use
        self._configContents[fullPath] = contents;

        // deregister old config (if any)
        self.deleteConfig(bundleName, configName, fullPath);

        if (!self._configPaths[bundleName]) {
            self._configPaths[bundleName] = {};
        }
        self._configPaths[bundleName][configName] = fullPath;

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

        callback(null, contents);
    });
};


/**
 * Deregisters a configuration file.
 * @method deleteConfig
 * @param {string} bundleName Name of the bundle to which this config file belongs.
 * @param {string} configName Name of the config file.
 * @param {string} fullPath Full filesystem path to the config file.
 * @return {undefined} Nothing appreciable is returned.
 */
Config.prototype.deleteConfig = function (bundleName, configName, fullPath) {
    if (this._configPaths[bundleName]) {
        this._configPaths[bundleName][configName] = undefined;
    }
};


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
Config.prototype.read = function (bundleName, configName, context, callback) {
    var self = this;
    self._getConfigCache(bundleName, configName, context, true, function (err, config) {
        if (err) {
            self._getYCB(bundleName, configName, function (err, ycb) {
                if (err) {
                    callback(err);
                    return;
                }

                config = ycb.read(context, {});
                return self._setConfigCache(bundleName, configName, context, config, true, callback);
            });
        } else {
            return callback(null, config);
        }
    });
};

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
Config.prototype.readNoMerge = function (bundleName, configName, context, callback) {
    var self = this;
    self._getConfigCache(bundleName, configName, context, false, function (err, config) {
        if (err) {
            self._getYCB(bundleName, configName, function (err, ycb) {
                if (err) {
                    return callback(err);
                }

                config = ycb.readNoMerge(context, {});
                return self._setConfigCache(bundleName, configName, context, config, false, callback);
            });
        } else {
            return callback(null, config);
        }
    });
};

/**
 * Provides a method that should get and return a cached configuration object,
 * given the bundle name, configuration name, context object, and whether or
 * not the configuration was merged.
 *
 * The default implementation uses the LRU cache from `node-lru-cache`, and options
 * to the cache can be passed through the Config constructor.
 *
 * This can be overridden if a custom caching method is provided.
 * @method _getConfigCache
 * @async
 * @private
 * @param {string} bundleName The bundle in which to find the configuration file.
 * @param {string} configName Which configuration to read.
 * @param {object} context The runtime context.
 * @param {boolean} hasMerge Whether or not the configuration data will be merged.
 * @param {Function} callback
 *   @param {Error|null} callback.err If an error occurred, then this parameter will
 *   contain the error. If the operation succeeded, then `err` will be null.
 *   @param {Object} callback.config The merged or unmerged cached configuration data.
 */
Config.prototype._getConfigCache = function (bundleName, configName, context, hasMerge, callback) {
    var self = this,
        bundlePath,
        configPath,
        mergePath,
        mergeName = hasMerge ? 'merge' : 'no-merge',
        config;

    bundlePath = self._configCache[bundleName];
    if (!bundlePath) {
        return callback(new Error(util.format(MESSAGES['unknown bundle'], bundleName)));
    }

    configPath = bundlePath[configName];
    if (!configPath) {
        return callback(new Error(util.format(MESSAGES['unknown config'], configName, bundleName)));
    }

    mergePath = configPath[mergeName];
    if (!mergePath) {
        return callback(new Error(util.format(MESSAGES['unknown cache data'], configName, bundleName)));
    }

    config = mergePath.get(getCacheKey(context));
    if (config) {
        return callback(null, config);
    } else {
        return callback(new Error(util.format(MESSAGES['unknown cache data'], configName, bundleName)));
    }
};

/**
 * Provides a method that should set and return a cached configuration object,
 * given the bundle name, configuration name, context object, configuration,
 * and whether or not it was merged.
 *
 * The default implementation uses the LRU cache from `node-lru-cache`, and options
 * to the cache can be passed through the Config constructor.
 *
 * This can be overridden if a custom caching method is provided.
 * @method _setConfigCache
 * @async
 * @private
 * @param {string} bundleName The bundle in which to find the configuration file.
 * @param {string} configName Which configuration to read.
 * @param {object} context The runtime context.
 * @param {object} config The configuration data.
 * @param {boolean} hasMerge Whether or not the configuration data will be merged.
 * @param {Function} callback
 *   @param {Error|null} callback.err If an error occurred, then this parameter will
 *   contain the error. If the operation succeeded, then `err` will be null.
 *   @param {Object} callback.config The merged or unmerged cached configuration data.
 */
Config.prototype._setConfigCache = function (bundleName, configName, context, config, hasMerge, callback) {
    var self = this,
        LRU  = libcache,
        mergeName = hasMerge ? 'merge' : 'no-merge',
        cacheOptions = self._options.cache || DEFAULT_CACHE_OPTIONS,
        bundlePath,
        configPath,
        cache,
        configClone,
        configCache = self._configCache;

    bundlePath = configCache[bundleName] = (configCache[bundleName] || {});
    configPath = bundlePath[configName] = (bundlePath[configName] || {});
    cache      = configPath[mergeName] = (configPath[mergeName] || new LRU(cacheOptions));

    config = this._options.safeMode ? deepFreeze(config) : config;

    cache.set(getCacheKey(context), config);

    return callback(null, config);
};

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
Config.prototype.readDimensions = function (callback) {
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
        return callback(null, self._cachedDimensions);
    });
};


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
Config.prototype._getYCB = function (bundleName, configName, callback) {
    var self = this,
        path,
        contents,
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

    if (self._configYCBs[path]) {
        return callback(null, self._configYCBs[path]);
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
                callback(null, ycb);
            });
        } else {
            ycb = self._makeYCBFromDimensions(path, dimensions, contents);
            callback(null, ycb);
        }
    });
};

/**
 * Determines whether to make a YCB or fake YCB object from
 * a dimensions object.
 * @private
 * @method _makeYCBFromDimensions
 */

 Config.prototype._makeYCBFromDimensions = function (path, dimensions, contents) {
    var ycb;

    if (dimensions) {
        ycb = makeYCB(this, dimensions, contents);
    } else {
        ycb = makeFakeYCB(dimensions, contents);
    }
    this._configYCBs[path] = ycb;

    return ycb;
 };

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
Config.prototype._readConfigContents = function (path, callback) {
    var self = this,
        ext = libpath.extname(path),
        contents;

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
            self._parseConfigContents(path, contents, function(err, contents) {
                // TODO -- cache in _configContents?
                return callback(err, contents);
            });
        });
    } else {
        try {
            contents = require(path);
            // TODO -- cache in _configContents?
            return callback(null, contents);
        } catch (e) {
            return callback(new Error(util.format(MESSAGES['parse error'], path, e.message)));
        }
    }
};


Config.prototype._parseConfigContents = function (path, contents, callback) {
    var ext;
    // Sometimes the contents are already parsed.
    if ('object' !== typeof contents) {
        ext = libpath.extname(path);
        try {
            if ('.json' === ext) {
                contents = JSON.parse(contents);
            } else if ('.json5' === ext) {
                contents = libjson5.parse(contents);
            } else {
                contents = libyaml.parse(contents);
            }
        } catch (e) {
            return callback(new Error(util.format(MESSAGES['parse error'], path, e.message)));
        }
    }
    callback(null, contents);
};


/**
 * Merges the base context under the runtime context.
 * @private
 * @method _mergeBaseContext
 * @param {object} context The runtime context.
 * @return {object} A new object with the context expanded with the base merged under.
 */
Config.prototype._mergeBaseContext = function (context) {
    context = context || {};
    return mix(clone(context), this._options.baseContext);
};


module.exports = Config;


Config.test = {
    contentsIsYCB: contentsIsYCB,
    makeYCB: makeYCB,
    makeFakeYCB: makeFakeYCB
};
