/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, white:true, node:true */
"use strict";


var NAME = 'ModownConfig',
    libpath = require('path'),
    libfs = require('fs'),
    libycb = require('ycb'),
    libyaml = require('js-yaml'),
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
 * @param {function} callback Callback to call once done.
 * @param {Error} callback.err Error object if a problem occurs.
 * @return {nothing}
 */
Config.prototype.optimize = function(contexts, callback) {
    // TODO
    // * readSimple() all config files in all bundles
};


/**
 * Reads the contents of the named configuration file.
 * @method readSimple
 * @async
 * @param {string} bundle The bundle in which to find the configuration file.
 * @param {string} name Which configuration file to read.
 * @param {function} callback The callback to call to return the results.
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contents of the configuration file.
 * @return {nothing}
 */
Config.prototype.readSimple = function(bundle, name, callback) {
    var configs,
        path,
        ext,
        basename,
        i;
    // TODO -- add file content caching

    if (!this._bundles[bundle]) {
        callback(new Error(message('unknown bundle', { name: bundle })));
        return;
    }
    bundle = this._bundles[bundle];

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
        this._readFileJSON(path, callback);
    } else if ('.yaml' === ext || '.yml' === ext) {
        this._readFileYAML(path, callback);
    } else {
        callback(new Error(message('unknown ext', { file: path })));
        return;
    }
};


/**
 * Reads the dimensions file for the application.
 * The dimensions file will be autodetected, or can be passed to this object's constructor.
 * (See constructor documentation for details.)
 * The returned dimensions object is shared, so it should not be modified.
 * @method readDimensions
 * @param {function} callback How the results are returned.
 * callback.err
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contents of the dimensions file.
 * @return {nothing}
 */
Config.prototype.readDimensions = function(callback) {
    var self = this;
    if (!this._dimensionsPath) {
        callback(new Error(message('missing dimensions', {})));
        return;
    }
    if (this._cachedDimensions) {
        callback(undefined, this._cachedDimensions);
    } else {
        this._readFileJSON(this._dimensionsPath, function(err, body) {
            if (err) {
                callback(err);
                return;
            }
            self._cachedDimensions = body[0].dimensions;
            callback(undefined, self._cachedDimensions);
        });
    }
};


/**
 * Reads the contents of the named context-sensitive configuration file.
 * @method readYCB
 * @async
 * @param {string} bundle The bundle in which to find the configuration file.
 * @param {string} name Which configuration file to read.
 * @param {object} context The runtime context.
 * @param {function} callback The callback to call to return the results.
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contextualized contents of the configuration file.
 * @return {nothing}
 */
Config.prototype.readYCB = function(bundle, name, context, callback) {
    var self = this;
    // TODO -- add ycb object caching
    this.readDimensions(function(err, dims) {
        if (err) {
            callback(err);
            return;
        }
        self.readSimple(bundle, name, function(err, body) {
            var ycbBundle,
                ycb,
                contents;
            if (err) {
                callback(err);
                return;
            }
            ycbBundle = [ { dimensions: dims } ];
            ycbBundle = ycbBundle.concat(body);
            ycb = new libycb.Ycb(ycbBundle);
            contents = ycb.read(context);
            callback(undefined, contents);
        });
    });
};


/**
 * Reads a YAML file.
 * @private
 * @method _readFileYAML
 * @async
 * @param {string} path Full path to the file.
 * @param {function} callback Results returned this way
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contents of the file.
 * @return {nothing}
 */
Config.prototype._readFileYAML = function(path, callback) {
    libfs.readFile(path, function(err, body) {
        if (err) {
            callback(err);
            return;
        }
        try {
            body = libyaml.load(body);
        } catch(e) {
            callback(e);
            return;
        }
        callback(undefined, body);
    });
};


/**
 * Reads a JSON file.
 * @private
 * @method _readFileJSON
 * @async
 * @param {string} path Full path to the file.
 * @param {function} callback Results returned this way
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contents of the file.
 * @return {nothing}
 */
Config.prototype._readFileJSON = function(path, callback) {
    libfs.readFile(path, function(err, body) {
        if (err) {
            callback(err);
            return;
        }
        try {
            body = JSON.parse(body);
        } catch(e) {
            callback(e);
            return;
        }
        callback(undefined, body);
    });
};


module.exports = Config;


// hooks for testing
module.exports.test = {
    message: message
};


