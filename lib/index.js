/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, white:true, node:true */
"use strict";


var libpath = require('path'),
    libfs = require('fs');


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
 * @param {string} bundle The bundle in which to find the configuration file.
 * @param {string} name Which configuration file to read.
 * @param {object} context The runtime context.
 * @param {function} callback The callback to call to return the results.
 * @param {Error} callback.err Error object if a problem occurs.
 * @param {object} callback.contents The contextualized contents of the configuration file.
 * @return {nothing}
 */
Config.prototype.read = function(bundle, name, context, callback) {
    // TODO
};


module.exports = Config;


