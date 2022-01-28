var utils = require('./utils');

/**
 * Import a CommonJS config
 * @param {String} id module name or path
 * @param {Function} [callback] Called once the config has been added to the helper.
 *   @param {Error|null} callback.err If an error occurred, then this parameter will
 *   contain the error. If the operation succeeded, then `err` will be null.
 *   @param {Object} callback.contents The contents of the config file, as a
 *   JavaScript object.
 */
module.exports = function (id, callback) {
    try {
        var mod = utils.interopDefault(require(id));
        callback(null, mod);
    } catch (e) {
        callback(new utils.ParseError(e, id));
    }
};
