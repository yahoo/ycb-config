module.exports = function(id, callback) {
    return callback(new Error('Node >= 12 is required to import .mjs file'));
}
