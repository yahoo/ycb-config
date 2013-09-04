/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, anon:true, node:true */
"use strict";


var libfs       = require('fs'),
    liblang     = require('yui').YUI().Lang,
    liboop      = require('yui/oop'),
    libpath     = require('path'),
    libpromise  = require('yui/promise'),
    libycb      = require('ycb'),
    libjson5    = require('json5'),
    libyaml     = require('yamljs'),
    WeakMap     = require('weakmap'),
    MESSAGES = {
        'unknown bundle': 'Unknown bundle "{bundle}"',
        'unknown config': 'Unknown config "{config}" in bundle "{bundle}"',
        'missing dimensions': 'Failed to find a dimensions.json file',
        'parse error': 'Failed to parse "{path}"\n{message}'
    };


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

    ycbBundle = [{dimensions: dimensions}];
    // need to copy contents, since YCB messes with it
    ycbBundle = ycbBundle.concat(liboop.clone(contents, true));
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
 * @param {object} [options.baseContext] Context to apply to all reads.
 * @param {string} [options.dimensionsBundle] Bundle in which to find the dimensions file.
 * See `readDimensions()` for details.
 * @param {string} [options.dimensionsPath] Full path to the dimensions file.
 * See `readDimensions()` for details.
 * The context passed to `read()` will override this on a key-by-key bases.
 */
function Config(options) {
    this._options = options || {};
    this._dimensionsPath = this._options.dimensionsPath;
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
 * @return {Promise/A+} A promise that will be fulfilled once the config file is fully registered.
 */
Config.prototype.addConfig = function (bundleName, configName, fullPath) {
    var self = this;
    return this._readConfigContents(fullPath).then(function () {
        // clear old contents (if any)
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
 * @return {Promise/A+} A promise that will be fulfilled with the contents of the configuration file.
 */
Config.prototype.read = function (bundleName, configName, context) {
    var self = this,
        bundleCache,
        configCache,
        config;
    
    return this._getConfigCache(bundleName, configName, context).then(null, function () {
        return self._getYCB(bundleName, configName).then(function (ycb) {
            return ycb.read(context, {});
        }).then(function (config) {
            return self._setConfigCache(bundleName, configName, context, config);
        });
    });
};

Config.prototype._getConfigCache = function (bundleName, configName, context) {
    var self = this,
        bundlePath,
        configPath,
        config;

    return new libpromise.Promise(function (fulfill, reject) {
        bundlePath = self._configCache[bundleName];
        if (!bundlePath) {
           reject(new Error(liblang.sub(MESSAGES['unknown bundle'], {bundle: bundleName})));
            return;
        }

        configPath = bundlePath[configName];
        if (!configPath) {
            reject(new Error(liblang.sub(MESSAGES['unknown config'], {bundle: bundleName, config: configName})));
            return;
        }

        config = configPath.get(context);
        if (config) {
            fulfill(config);
        }
    });
};

Config.prototype._setConfigCache = function (bundleName, configName, context, config) {
    var self = this,
        bundlePath,
        configPath,
        configCache = self._configCache;

    return new libpromise.Promise(function (fulfill, reject) {
        bundlePath = configCache[bundleName] = (configCache[bundleName] || {});
        configPath = bundlePath[configName] = (bundlePath[configName] || new WeakMap());

        configPath.set(context, config);
        
        fulfill(config);
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
 * @return {Promise/A+} A promise that will be fulfilled with a prioritized list of sections of the configuration file.
 */
Config.prototype.readNoMerge = function (bundleName, configName, context) {
    return this._getYCB(bundleName, configName).then(function (ycb) {
        return ycb.readNoMerge(context, {});
    });
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
 * @return {Promise/A+} A promise that will be fulfilled with the dimensions.
 */
Config.prototype.readDimensions = function () {
    var self = this;
    return new libpromise.Promise(function (fulfill, reject) {
        if (!self._dimensionsPath) {
            reject(new Error(MESSAGES['missing dimensions']));
            return;
        }
        if (self._cachedDimensions) {
            fulfill(self._cachedDimensions);
        } else {
            self._readConfigContents(self._dimensionsPath).then(function (body) {
                self._cachedDimensions = body[0].dimensions;
                fulfill(self._cachedDimensions);
            });
        }
    });
};


/**
 * Promises a YCB object for the configuration file.
 * This returns a YCB object even if the configuration file isn't a YCB file.
 * @private
 * @method _getYCB
 * @async
 * @param {string} bundleName The bundle in which to find the configuration file.
 * @param {string} configName Which configuration to read.
 * @param {object} [context] The runtime context.
 * @return {Promise/A+} A promise that will be fulfilled with the YCB object.
 */
Config.prototype._getYCB = function (bundleName, configName) {
    var self = this;
    return new libpromise.Promise(function (fulfill, reject) {
        var path,
            contents,
            isYCB;

        if (!self._configPaths[bundleName]) {
            reject(new Error(liblang.sub(MESSAGES['unknown bundle'], {bundle: bundleName})));
            return;
        }
        path = self._configPaths[bundleName][configName];
        if (!path) {
            reject(new Error(liblang.sub(MESSAGES['unknown config'], {bundle: bundleName, config: configName})));
            return;
        }

        if (self._configYCBs[path]) {
            fulfill(self._configYCBs[path]);
            return;
        }

        return self._readConfigContents(path).then(function (c) {
            contents = c;
            isYCB = contentsIsYCB(contents);
            if (isYCB) {
                return self.readDimensions();
            }
        }).then(function (dimensions) {
            var ycb;
            if (isYCB) {
                try {
                    ycb = makeYCB(self, dimensions, contents);
                } catch (err) {
                    reject(err);
                    return;
                }
            } else {
                ycb = makeFakeYCB(dimensions, contents);
            }
            self._configYCBs[path] = ycb;
            fulfill(ycb);
        }, reject);
    });
};


/**
 * Reads the contents of a configuration file.
 * @private
 * @method _readConfigContents
 * @async
 * @param {string} path Full path to the file.
 * @return {Promise/A+} A promise that will be fulfilled with the contents of the file.
 */
Config.prototype._readConfigContents = function (path) {
    var self = this;
    return new libpromise.Promise(function (fulfill, reject) {
        var ext = libpath.extname(path),
            contents;
        // really try to do things async as much as possible
        if ('.json' === ext || '.json5' === ext || '.yaml' === ext || '.yml' === ext) {
            libfs.readFile(path, 'utf8', function (err, contents) {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    if ('.json' === ext) {
                        contents = JSON.parse(contents);
                    } else if ('.json5' === ext) {
                        contents = libjson5.parse(contents);
                    } else {
                        contents = libyaml.parse(contents);
                    }
                    fulfill(contents);
                } catch (e) {
                    reject(new Error(liblang.sub(MESSAGES['parse error'], {path: path, message: e.message})));
                }
            });
        } else {
            try {
                contents = require(path);
                fulfill(contents);
            } catch (e) {
                reject(new Error(liblang.sub(MESSAGES['parse error'], {path: path, message: e.message})));
            }
        }
    });
};


/**
 * Merges the base context under the runtime context.
 * @private
 * @method _mergeBaseContext
 * @param {object} context The runtime context.
 * @return {object} A new object with the context expanded with the base merged under.
 */
Config.prototype._mergeBaseContext = function (context) {
    var out = liboop.clone(context, true);
    liboop.mix(out, this._options.baseContext, false, null, 0, false);
    return out;
};


module.exports = Config;


Config.test = {
    contentsIsYCB: contentsIsYCB,
    makeYCB: makeYCB,
    makeFakeYCB: makeFakeYCB
};


