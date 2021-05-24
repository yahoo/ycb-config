module.exports = function(id, callback) {
    import(id).then(function (obj) {
        callback(null, obj);
    }).catch(function (e) {
        return callback(e);
    });
}
