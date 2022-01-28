var path = require('path');
var version = parseInt(process.versions.node.split('.'), 10);
var id = version >= 12 ? './modern.js' : './legacy.js';

/**
 * Older versions of node will throw a syntax error when it sees `import`
 * Since this library supports down to Node 0.8, we need to dynamically
 * route importing of mjs files to a NOOP that throws an error for legacy
 * versions of Node and does the actual import for newer versions.
 * https://nodejs.org/api/esm.html#esm_import_expressions
 */
module.exports = require(id);
