/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, white:true, node:true */
/*globals describe, it */
"use strict";


var libpath = require('path'),
    expect = require('chai').expect,
    Config = require('../../lib/index');


// expect().to.deep.equal() cares about order of keys
// but very often we don't
function compareObjects(have, want) {
    expect(typeof have).to.equal(typeof want);
    if ('object' === typeof want) {
        // order of keys doesn't matter
        if (Object.keys(want).length) {
            expect(have).to.have.keys(Object.keys(want));
        }
        if (Object.keys(have).length) {
            expect(want).to.have.keys(Object.keys(have));
        }
        Object.keys(want).forEach(function(key) {
            compareObjects(have[key], want[key]);
        });
    } else {
        expect(have).to.deep.equal(want);
    }
}


describe('config', function() {


    describe('unit tests', function() {


        describe('constructor', function() {
            it('should initialize nicely', function() {
                var config;
                config = new Config();
                expect(config._options).to.deep.equal({});
                expect(config._bundles).to.deep.equal({});
            });
            it('should preserve options', function() {
                var config,
                options = { foo: 'bar' };
                config = new Config(options);
                expect(config._options).to.deep.equal(options);
            });
        });


        describe('addBundle()', function() {
            it('should add a simple bundle', function() {
                var config,
                    bundle;
                bundle = {
                    name: 'foo'
                };
                config = new Config();
                config.addBundle(bundle);
                expect(config._bundles.foo).to.deep.equal(bundle);
            });
            it('should add a nested bundles', function() {
                var config,
                    bundle;
                bundle = {
                    name: 'foo',
                    bundles: {
                        bar: { name: 'bar-bar' },
                        baz: { name: 'bazinator' }
                    }
                };
                config = new Config();
                config.addBundle(bundle);
                expect(config._bundles.foo).to.deep.equal(bundle);
                expect(config._bundles['bar-bar']).to.deep.equal(bundle.bundles.bar);
                expect(config._bundles.bazinator).to.deep.equal(bundle.bundles.baz);
            });
        });


        // TODO
        // In order to unit test optimize() and read() we'll need to mock out
        // the filesystem.


    });


    describe('functional tests', function() {


        describe('optimize()', function() {
            // TODO
        });


        describe('read()', function() {
            // TODO
        });


    });


});


