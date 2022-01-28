var MESSAGES = require('../messages');
var util = require('util');

/**
 * Return the export of a CJS module or default export of a transpiled ESModule
 * See https://babeljs.io/docs/en/babel-plugin-transform-modules-commonjs
 * @param {Object} mod module
 * @returns {*} exported module content
 */
module.exports.interopDefault = function interopDefault(mod) {
    if (mod && mod.__esModule) {
        return mod.default;
    }
    return mod;
};

module.exports.ParseError = (function () {
    function ParseError(e, id) {
        this.message = util.format(MESSAGES['parse error'], id, e.message);
    }
    ParseError.prototype = new Error();
    return ParseError;
})();
