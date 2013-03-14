/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, white:true, node:true */
"use strict";


var libpath = require('path'),
    libfs = require('fs'),
    libycb = require('ycb'),
    libyaml = require('js-yaml'),
    SUFFIXES = [ '.yaml', '.yml', '.json' ];


/**
 * A manager for configuration files.
 * @module ModownConfig
 */


/**
 * @class ModownConfig
 * @constructor
 * @param {object} options Options for how the configuration files are handled.
 */
function Config(options) {
    this._options = options || {};
    this._bundles = {};
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
    if (!this._bundles[bundle.name]) {
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
 * @async
 * @param {array} contexts Array of runtime contexts which are expected to be the most used.
 * Partial contexts can be passed as well.
 * @param {function} callback Callback to call once done.
 * @param {Error} callback.err Error object if a problem occurs.
 * @return {nothing}
 */
Config.prototype.optimize = function(contexts, callback) {
    // TODO
};


/**
 * Reads the contents of the named configuration file.
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

    if (!this._bundles[bundle]) {
        callback(new Error('unknown bundle "' + bundle + '"'));
        return;
    }
    bundle = this._bundles[bundle];

    configs = bundle.resources['{}'].configs;
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
        callback(new Error('unknown file extension for "' + name + '"'));
        return;
    }
};


/**
 * Reads the contents of the named context-sensitive configuration file.
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
    // TODO
};


// read the dimensions file
// TODO DOCS
Config.prototype._readDimensions = function(callback) {
    // TODO
};


/**
 * Reads a YAML file.
 * @private
 * @async
 * @method _readFileYAML
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
 * @async
 * @method _readFileJSON
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


