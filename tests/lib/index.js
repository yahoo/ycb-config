/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */


/*jslint nomen:true, anon:true, node:true */
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
        describe('message()', function() {
            it('does substitutions', function() {
                var have,
                    want = 'Found repeated bundle "**NAME**"\nrepeat: **REPEAT**\n using: **USING**';
                have = Config.test.message('repeat bundle', {
                    name:   '**NAME**',
                    repeat: '**REPEAT**',
                    using:  '**USING**'
                });
            });
            // FUTURE -- replace duplicates of the same token (if/when some message uses that feature)
        });


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
            it('should use only the shallowest of repeat bundles', function() {
                var config,
                    bundle,
                    logs = [];
                bundle = {
                    name: 'foo',
                    baseDirectory: '0foodir',
                    bundles: {
                        bar: {
                            name: 'bar',
                            baseDirectory: '1barpath'
                        },
                        baz: {
                            name: 'baz',
                            baseDirectory: '1bazpath',
                            bundles: {
                                bar: {
                                    name: 'bar',
                                    baseDirectory: '2barpath'
                                }
                            }
                        }
                    }
                };
                config = new Config({
                    logger: function(msg) {
                        logs.push(msg);
                    }
                });
                config.addBundle(bundle);
                expect(logs[0]).to.equal(Config.test.message('repeat bundle', {
                    name:   'bar',
                    repeat: '2barpath',
                    using:  '1barpath'
                }));
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
                    config.readSimple('modown-newsboxes', 'package').then(function(have) {
                        try {
                            expect(have).to.be.an('object');
                            next();
                        } catch (err) {
                            next(err);
                            return;
                        }
                    }, next);
                });
            });


            describe('readDimensions()', function() {
                it('should work', function(next) {
                    config.readDimensions().then(function(dims) {
                        try {
                            expect(dims).to.be.an('array');
                            expect(dims[0].runtime).to.have.property('common');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                });
            });


            describe('readYCB()', function() {
                it('should work with .json files', function(next) {
                    var context = {};
                    config.readYCB('modown-newsboxes', 'routes', context).then(function(have) {
                        try {
                            expect(have).to.be.an('object');
                            expect(have['/']).to.be.an('object');
                            expect(have['/read.html (offline)']).to.be.an('object');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                });
                it('should work with default context', function(next) {
                    var context = {};
                    config.readYCB('modown-newsboxes', 'application', context).then(function(have) {
                        try {
                            expect(have).to.be.an('object');
                            expect(have.TODO).to.equal('TODO');
                            expect(have.selector).to.be.an('undefined');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                });
                it('should work with device:mobile context', function(next) {
                    var context = { device: 'mobile' };
                    config.readYCB('modown-newsboxes', 'application', context).then(function(have) {
                        try {
                            expect(have).to.be.an('object');
                            expect(have.TODO).to.equal('TODO');
                            expect(have.selector).to.equal('mobile');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                });
            });
        });


        describe('touchdown-simple', function() {
            var fixture = libpath.resolve(__dirname, '../fixtures/touchdown-simple'),
                config,
                bundle = require(fixture + '/expected-locator.js');
            config = new Config();
            config.addBundle(bundle);

            it('should find the dimensions.json', function() {
                expect(config._dimensionsPath).to.equal(libpath.resolve(fixture, 'configs/dimensions.json'));
            });


            it('readSimple()', function(next) {
                config.readSimple('simple', 'app').then(function(have) {
                    try {
                        expect(have).to.be.an('object');
                        next();
                    } catch (err) {
                        next(err);
                        return;
                    }
                }, next);
            });


            it('readDimensions()', function(next) {
                config.readDimensions().then(function(dims) {
                    try {
                        expect(dims).to.be.an('array');
                        expect(dims[0].ynet).to.have.property('1');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });


        });


        // This needs to be in its own section since it affects the overall
        // behavior of the library.
        describe('optimize()', function() {
            // TODO
        });
    });
});


