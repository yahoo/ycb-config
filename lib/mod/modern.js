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
    // Until https://github.com/facebook/jest/issues/9430 is solved, we can't use import
    // in this library as it will break anyone using Jest. While there is no way around
    // that for ESM files, we can at least not break CJS by adding a first try to require
    // the file which will then fail over to the ESM compatible import should that fail.
    try {
        const mod = require(id);
        callback(null, mod);
        return;
    } catch (e) {
        // do nothing
    }

    try {
        const mod = interopDefault(await import(id));
        callback(null, mod.default);
    } catch (e) {
        callback(new ParseError(e, id));
    }
};
