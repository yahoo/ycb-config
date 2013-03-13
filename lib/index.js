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
 * @param {object} cfg Configuration for how the configuration files are handled :)
 */
function Config(cfg) {
    this._cfg = cfg;
}


module.exports = Config;


