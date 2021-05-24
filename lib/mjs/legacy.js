module.exports = function(id, callback) {
    return callback(new Error('Node >= 8 is required to import .mjs file'));
}
