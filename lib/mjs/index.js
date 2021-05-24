const path = require('path');
const version = parseInt(process.versions.node.split('.'), 10);
const id = path.resolve(__dirname, version >= 8 ? 'modern' : 'legacy');

/**
 * Older versions of node will throw a syntax error when it sees `import`
 * Since this library supports down to Node 0.8, we need to dynamically
 * route importing of mjs files to a NOOP that throws an error for legacy
 * versions of Node and does the actual import for newer versions.
 * https://nodejs.org/api/esm.html#esm_import_expressions
 */
module.exports = require(id);
