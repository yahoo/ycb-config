/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, anon:true, node:true */
"use strict";


var NAME = 'ModownConfig',
    libpath = require('path'),
    libfs = require('fs'),
    libycb = require('ycb'),
    libyaml = require('js-yaml'),
    Promise = require('yui/promise').Promise,
    FALLBACK_SELECTOR = '{}',
    SUFFIXES = [ '.yaml', '.yml', '.json' ],
    MESSAGES = {
        'unknown bundle': 'Unknown bundle "{name}"',
        'unknown ext': 'Unknown file extension for configuration file "{file}"',
        'repeat bundle': 'Found repeated bundle "{name}"\nrepeat: {repeat}\n using: {using}',
        'missing dimensions': 'Failed to find a dimensions.json file'
    };


function message(name, parts) {
    var msg = MESSAGES[name] || 'INTERNAL ERROR: unknown message: ' + name;
    Object.keys(parts).forEach(function(key) {
        msg = msg.replace('{' + key + '}', parts[key], 'g');
    });
    return msg;
}


/**
 * A manager for configuration files.
 * @module ModownConfig
 */


/**
 * @class ModownConfig
 * @constructor
 * @param {object} options Options for how the configuration files are handled.
 * @param {function} options.logger Function used for logging.
 * The default just logs to the console.
 * @param {string} options.logger.msg The message to log.
 * @param {string} options.logger.lvl The log level.
 * @param {string} options.logger.src The log source, in this case "ModownConfig".
 * @param {string} options.dimensionsPath Full path to the dimensions file.
 * If not given, it defaults to a dimensions.json config file found in the shallowest bundle.
 */
function Config(options) {
    options = options || {};
    this._logger = options.logger || function(msg, lvl) {
        console.log(lvl + ': ' + msg);
    };
    this._dimensionsPath = options.dimensionsPath;
    this._bundles = {};
    this._cachedDimensions = undefined;
}
Config.prototype = {};


/**
 * Adds a bundle from the locator.  If the bundle has child bundles, those will
 * be added too (recursively).
 * @method addBundle
 * @param {object} bundle The bundle to add.
 * @return {nothing}
 */
Config.prototype.addBundle = function(bundle) {
    var b;
    if (!this._dimensionsPath) {
        if (bundle.resources &&
                bundle.resources[FALLBACK_SELECTOR] &&
                bundle.resources[FALLBACK_SELECTOR].configs &&
                bundle.resources[FALLBACK_SELECTOR].configs['dimensions.json']) {
            this._dimensionsPath = libpath.resolve(bundle.baseDirectory, bundle.resources[FALLBACK_SELECTOR].configs['dimensions.json']);
        }
    }
    if (this._bundles[bundle.name]) {
        this._logger(message('repeat bundle', {
            name:   bundle.name,
            repeat: bundle.baseDirectory,
            using:  this._bundles[bundle.name].baseDirectory
        }), 'info', NAME);
    } else {
        this._bundles[bundle.name] = bundle;
        if (bundle.bundles) {
            for (b in bundle.bundles) {
                if (bundle.bundles.hasOwnProperty(b)) {
                    this.addBundle(bundle.bundles[b]);
                }
            }
        }
    }
};


/**
 * Optimize internal operations for the specified contexts.
 * @method optimize
 * @async
 * @param {array} contexts Array of runtime contexts which are expected to be the most used.
 * Partial contexts can be passed as well.
 * @return {Promise} A promise that will be fulfilled once this object is optimized.
 */
Config.prototype.optimize = function(contexts) {
    // TODO
    // * readSimple() all config files in all bundles
};


/**
 * Reads the contents of the named configuration file.
 * @method readSimple
 * @async
 * @param {string} bundle The bundle in which to find the configuration file.
 * @param {string} name Which configuration file to read.
 * @return {Promise} A promise that will be fulfilled with the contents of the configuration file.
 */
Config.prototype.readSimple = function(bundle, name) {
    var self = this,
        configs,
        path,
        ext,
        basename,
        i;
    // TODO -- add file content caching
    return new Promise(function(fulfill, reject) {
        if (!self._bundles[bundle]) {
            reject(new Error(message('unknown bundle', { name: bundle })));
            return;
        }
        bundle = self._bundles[bundle];

        configs = bundle.resources[FALLBACK_SELECTOR].configs;
        ext = libpath.extname(name);
        path = configs[name];
        if (!path) {
            // hunt for other suffixes
            basename = name.substr(0, name.length - ext.length);
            for (i = 0; i < SUFFIXES.length; i += 1) {
                ext = SUFFIXES[i];
                path = configs[basename + ext];
                if (path) {
                    break;
                }
            }
        }
        path = libpath.resolve(bundle.baseDirectory, path);

        if ('.json' === ext) {
            self._readFileJSON(path).then(fulfill, reject);
        } else if ('.yaml' === ext || '.yml' === ext) {
            self._readFileYAML(path).then(fulfill, reject);
        } else {
            reject(new Error(message('unknown ext', { file: path })));
            return;
        }
    });
};


/**
 * Reads the dimensions file for the application.
 * The dimensions file will be autodetected, or can be passed to this object's constructor.
 * (See constructor documentation for details.)
 * The returned dimensions object is shared, so it should not be modified.
 * @method readDimensions
 * @return {Promise} A promise that will be fulfilled with the dimensions.
 */
Config.prototype.readDimensions = function() {
    var self = this;
    return new Promise(function(fulfill, reject) {
        if (!self._dimensionsPath) {
            reject(new Error(message('missing dimensions', {})));
            return;
        }
        if (self._cachedDimensions) {
            fulfill(self._cachedDimensions);
        } else {
            self._readFileJSON(self._dimensionsPath).then(function(body) {
                self._cachedDimensions = body[0].dimensions;
                fulfill(self._cachedDimensions);
            });
        }
    });
};


/**
 * Reads the contents of the named context-sensitive configuration file.
 * @method readYCB
 * @async
 * @param {string} bundle The bundle in which to find the configuration file.
 * @param {string} name Which configuration file to read.
 * @param {object} context The runtime context.
 * @return {nothing}
 * @return {Promise} A promise that will be fulfilled with the contents of the configuration file.
 */
Config.prototype.readYCB = function(bundle, name, context) {
    var self = this;
    // TODO -- add ycb object caching
    return new Promise(function(fulfill, reject) {
        var haveDims,
            haveBody;
        function process() {
            var ycbBundle,
                ycb,
                contents;
            if (haveDims && haveBody) {
                try {
                    ycbBundle = [ { dimensions: haveDims } ];
                    ycbBundle = ycbBundle.concat(haveBody);
                    ycb = new libycb.Ycb(ycbBundle);
                    contents = ycb.read(context);
                    fulfill(contents);
                } catch (err) {
                    reject(err);
                }
            }
        }
        // TODO -- better way of executing concurrent promises?
        self.readDimensions().then(function(dims) {
            haveDims = dims;
            process();
        }, reject);
        self.readSimple(bundle, name).then(function(body) {
            haveBody = body;
            process();
        }, reject);
    });
};


/**
 * Reads a YAML file.
 * @private
 * @method _readFileYAML
 * @async
 * @param {string} path Full path to the file.
 * @return {Promise} A promise that will be fulfilled with the contents of the file.
 */
Config.prototype._readFileYAML = function(path) {
    return new Promise(function(fulfill, reject) {
        libfs.readFile(path, function(err, body) {
            if (err) {
                reject(err);
                return;
            }
            try {
                body = libyaml.load(body);
            } catch (e) {
                reject(e);
                return;
            }
            fulfill(body);
        });
    });
};


/**
 * Reads a JSON file.
 * @private
 * @method _readFileJSON
 * @async
 * @param {string} path Full path to the file.
 * @return {Promise} A promise that will be fulfilled with the contents of the file.
 */
Config.prototype._readFileJSON = function(path) {
    return new Promise(function(fulfill, reject) {
        libfs.readFile(path, function(err, body) {
            if (err) {
                reject(err);
                return;
            }
            try {
                body = JSON.parse(body);
            } catch (e) {
                reject(e);
                return;
            }
            fulfill(body);
        });
    });
};


module.exports = Config;


// hooks for testing
module.exports.test = {
    message: message
};


