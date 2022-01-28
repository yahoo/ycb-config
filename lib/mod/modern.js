const { interopDefault, ParseError } = require('./utils');

/**
 * Import an ESModule config.
 * @param {String} id module name or path
 * @param {Function} [callback] Called once the config has been added to the helper.
 *   @param {Error|null} callback.err If an error occurred, then this parameter will
 *   contain the error. If the operation succeeded, then `err` will be null.
 *   @param {Object} callback.contents The contents of the config file, as a
 *   JavaScript object.
 */
module.exports = async (id, callback) => {
    try {
        const mod = interopDefault(await import(id));
        callback(null, mod.default);
    } catch (e) {
        callback(new ParseError(e, id));
    }
};
