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
    describe('unit', function() {
        describe('constructor', function() {
            it('should initialize nicely', function() {
                var config;
                config = new Config();
                expect(config._logger).to.be.a('function');
                expect(config._dimensionsPath).to.be.a('undefined');
                expect(config._bundles).to.deep.equal({});
            });
            it('should preserve options', function() {
                var config,
                    options = {
                        logger: function() {},
                        dimensionsPath: 'foo'
                    };
                config = new Config(options);
                expect(config._logger).to.equal(options.logger);
                expect(config._dimensionsPath).to.equal(options.dimensionsPath);
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
        // Asynchronous methods are functional tested.  To unit test we'll need
        // to mock out the "fs" library.
    });


    describe('functional', function() {
        describe('mojito-newsboxes', function() {
            var fixture = libpath.resolve(__dirname, '../fixtures/mojito-newsboxes'),
                config,
                bundle = require(fixture + '/expected-locator.js');
            config = new Config();
            config.addBundle(bundle);


            it('should find the dimensions.json', function() {
                expect(config._dimensionsPath).to.equal(libpath.resolve(fixture, 'node_modules/modown/dimensions.json'));
            });


            describe('readSimple()', function() {
                it('should work with .json files', function(next) {
                    config.readSimple('modown-newsboxes', 'package.json', function(err, have) {
                        expect(err).to.be.a('undefined');
                        expect(have).to.be.an('object');
                        next();
                    });
                });

                it('should work with .yaml files', function(next) {
                    config.readSimple('modown-newsboxes', 'application.yaml', function(err, have) {
                        expect(err).to.be.a('undefined');
                        expect(have).to.be.an('array');
                        next();
                    });
                });

                it('should find similar suffix', function(next) {
                    config.readSimple('modown-newsboxes', 'application.json', function(err, have) {
                        expect(err).to.be.a('undefined');
                        expect(have).to.be.an('array');
                        next();
                    });
                });
            });


            describe('readYCB()', function() {
                // TODO
            });
        });


        describe('touchdown-simple', function() {
            var fixture = libpath.resolve(__dirname, '../fixtures/touchdown-simple'),
                config,
                bundle = require(fixture + '/expected-locator.js');
            config = new Config();
            config.addBundle(bundle);


            // TODO
        });


        // This needs to be in its own section since it affects the overall
        // behavior of the library.
        describe('optimize()', function() {
            // TODO
        });
    });
});


