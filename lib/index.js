/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
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
    MESSAGES = {
        'unknown bundle': 'Unknown bundle "{bundle}"',
        'unknown config': 'Unknown config "{config}" in bundle "{bundle}"',
        'missing dimensions': 'Failed to find a dimensions.json file',
        'parse error': 'Failed to parse "{path}"\n{message}'
    };


/**
 * Recursively merges properties of two objects.
 * @method merge
 * @param {object} from The source object.
 * @param {object} to The destination object.
 * @return {object} The destination object.
 */
function merge(from, to) {
    var key;
    for (key in from) {
        if (from.hasOwnProperty(key)) {
            if (to.hasOwnProperty(key)) {
                // Property in destination object set; update its value.
                if (to[key] && from[key] && from[key].constructor === Object) {
                    to[key] = merge(from[key], to[key]);
                } else {
                    to[key] = from[key];
                }
            } else {
                // Property in destination object not set; create it and set its value.
                to[key] = from[key];
            }
        }
    }
    return to;
}


/**
 * A component for reading configuration files.
 * @module ModownConfig
 */


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
    this._configContents = {};  // fullpath: file contents
    this._configYCBs = {};  // fullpath: YCB object
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
    return this._readConfigContents(fullPath).then(function (contents) {
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
    this._configContents[fullPath] = undefined;
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
    return this._getYCB(bundleName, configName).then(function (ycb) {
        return ycb.read(context, {});
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
            isYCB = self._isYCB(contents);
            if (isYCB) {
                return self.readDimensions();
            }
        }).then(function (dimensions) {
            var ycbBundle,
                ycb,
                originalRead,
                originalReadNoMerge;

            if (isYCB) {
                try {
                    ycbBundle = [{dimensions: dimensions}];
                    // need to copy contents, since YCB messes with it
                    ycbBundle = ycbBundle.concat(liboop.clone(contents, true));
                    ycb = new libycb.Ycb(ycbBundle);

                    // monkey-patch to apply baseContext
                    originalRead = ycb.read;
                    ycb.read = function (context, options) {
                        return originalRead.call(ycb, self._mergeBaseContext(context), options);
                    };
                    originalReadNoMerge = ycb.readNoMerge;
                    ycb.readNoMerge = function (context, options) {
                        return originalReadNoMerge.call(ycb, self._mergeBaseContext(context), options);
                    };

                    self._configYCBs[path] = ycb;
                    fulfill(ycb);
                } catch (err) {
                    reject(err);
                }
                return;
            }
            ycb = {
                getDimensions: function () {
                    return dimensions;
                },
                walkSettings: function (callback) {
                    callback({}, contents);
                },
                read: function (context, options) {
                    return contents;
                },
                readNoMerge: function (context, options) {
                    return [contents];
                }
            };
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
        if (self._configContents[path]) {
            fulfill(self._configContents[path]);
        } else {
            // really try to do things async as much as possible
            if ('.json' === ext) {
                libfs.readFile(path, 'utf8', function (err, contents) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    try {
                        contents = JSON.parse(contents);
                        self._configContents[path] = contents;
                        fulfill(contents);
                    } catch (e) {
                        reject(new Error(liblang.sub(MESSAGES['parse error'], {path: path, message: e.message})));
                    }
                });
            } else {
                try {
                    contents = require(path);
                    self._configContents[path] = contents;
                    fulfill(contents);
                } catch (e) {
                    reject(new Error(liblang.sub(MESSAGES['parse error'], {path: path, message: e.message})));
                }
            }
        }
    });
};


/**
 * Determines if a config is YCB or not.
 * @private
 * @method _isYCB
 * @param {mixed} contents The config contents.
 * @return {boolean} Whether the config is YCB or not.
 */
Config.prototype._isYCB = function (contents) {
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


// hooks for testing
module.exports.test = {
    merge: merge
};


