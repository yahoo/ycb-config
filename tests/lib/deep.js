'use strict';

var expect = require('chai').expect,
    deepFreeze = require('../../lib/deep');

function assertImmutableObject (object, modifier) {
    var catchedErr = null;
    try {
        modifier(object);
    } catch (err) {
        catchedErr = err;
    }
    expect(catchedErr).to.be.an['instanceof'](Error);
    expect(catchedErr.message).to.include('object is not extensible');
}

describe('deep freeze', function () {
    it('should be immutable', function () {
        deepFreeze(Buffer);
        assertImmutableObject(Buffer, function (obj) {
            obj.x = 5;
        });
        assertImmutableObject(Buffer, function (obj) {
            obj.prototype.z = 3;
        });
    });
});
