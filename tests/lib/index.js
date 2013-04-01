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
    Config = require('../../lib/index'),
    fixtures = libpath.resolve(__dirname, '../fixtures/');


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
        Object.keys(want).forEach(function (key) {
            compareObjects(have[key], want[key]);
        });
    } else {
        expect(have).to.deep.equal(want);
    }
}


describe('config', function () {
    describe('standalone', function () {
        describe('message()', function () {
            it('does substitutions', function () {
                var have,
                    want = 'Unknown config "**CONFIG**" in bundle "**BUNDLE**"';
                have = Config.test.message('unknown config', {
                    config:   '**CONFIG**',
                    bundle: '**BUNDLE**'
                });
                expect(have).to.equal(want);
            });
            // FUTURE -- replace duplicates of the same token (if/when some message uses that feature)
        });


        describe('constructor', function () {
            it('should initialize nicely', function () {
                var config;
                config = new Config();
                expect(config._dimensionsPath).to.be.a('undefined');
            });
            it('should preserve options', function () {
                var config,
                    options = {
                        dimensionsPath: 'foo'
                    };
                config = new Config(options);
                expect(config._dimensionsPath).to.equal(options.dimensionsPath);
            });
        });


        describe('locatorPlugin()', function () {
            var config,
                plugin;

            config = new Config();
            plugin = config.locatorPlugin();

            it('describe', function () {
                expect(plugin).to.have.property('describe');
                expect(plugin.describe).to.have.property('summary');
                expect(plugin.describe.types).to.equal('configs');
                expect(plugin.describe.extensions).to.deep.equal(['js', 'json']);
            });

            it('resourceUpdated()', function (next) {
                expect(plugin.resourceUpdated).to.be.a('function');
                next();
            });

            it('resourceDeleted()', function (next) {
                expect(plugin.resourceDeleted).to.be.a('function');
                next();
            });

        });


        describe('dimensions.json detection', function () {

            it('uses dimensionsPath given to the constructor', function () {
                var config;
                config = new Config({dimensionsPath: 'foo'});
                expect(config._dimensionsPath).to.equal('foo');
            });

            it('uses dimensionsBundle given to the constructor', function () {
                var config,
                    plugin;
                config = new Config({dimensionsBundle: 'foo'});
                plugin = config.locatorPlugin();
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                plugin.resourceUpdated({
                    name: 'dimensions',
                    bundleName: 'foo',
                    fullPath: 'foo.json'
                }, {});
                plugin.resourceUpdated({
                    name: 'dimensions',
                    bundleName: 'bar',
                    fullPath: 'b.json'
                }, {});
                expect(config._dimensionsPath).to.equal('foo.json');
            });

            it('uses shortest path', function () {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                plugin.resourceUpdated({
                    name: 'dimensions',
                    bundleName: 'foo',
                    fullPath: 'foo.json'
                }, {});
                plugin.resourceUpdated({
                    name: 'dimensions',
                    bundleName: 'bar',
                    fullPath: 'b.json'
                }, {});
                expect(config._dimensionsPath).to.equal('b.json');
            });

            it('not found', function () {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                plugin.resourceUpdated({
                    name: 'x',
                    bundleName: 'foo',
                    fullPath: 'foo.json'
                }, {});
                plugin.resourceUpdated({
                    name: 'y',
                    bundleName: 'bar',
                    fullPath: 'b.json'
                }, {});
                expect(typeof config._dimensionsPath).to.equal('undefined');
            });

        });


        describe('cache usage', function () {

            it('reuses file contents (_configContents)', function (next) {
                var config,
                    readCalls = 0;
                config = new Config();
                config._configPaths.foo = {
                    bar: 'baz.json'
                };
                config._configContents['baz.json'] = 'x';
                config.read('foo', 'bar', {}).then(function () {
                    // If we got here, we used the cache successfully, since
                    // baz.json doesn't exists in the filesystem.
                    next();
                }, next);
            });

            it('reuses YCB objects (_configYCBs)', function (next) {
                var config,
                    readCalls = 0;
                config = new Config();
                config._configPaths.foo = {
                    bar: 'baz.json'
                };
                config._configYCBs['baz.json'] = {
                    read: function () {
                        readCalls += 1;
                    }
                };
                config.read('foo', 'bar', {}).then(function () {
                    expect(readCalls).to.equal(1);
                    next();
                }, next);
            });

        });


        describe('resourceUpdated()', function () {

            it("skips files that aren't resources", function () {
                var config,
                    plugin,
                    ret;
                config = new Config();
                plugin = config.locatorPlugin();
                ret = plugin.resourceUpdated({
                    ext: 'json',
                    fullPath: 'x.json'
                }, {});
                expect(typeof ret).to.equal('undefined');
            });

            it('saves stats', function () {
                var config,
                    plugin,
                    readCalls = 0;
                config = new Config();
                config._readConfigContents = function () {
                    readCalls += 1;
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'foo',
                    name: 'bar',
                    ext: 'json',
                    fullPath: 'x.json'
                }, {});
                expect(config._configPaths.foo.bar).to.equal('x.json');
                expect(readCalls).to.equal(1);
            });

            it('updates an existing resource', function () {
                var config,
                    plugin,
                    readCalls = 0;
                config = new Config();
                config._readConfigContents = function () {
                    readCalls += 1;
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'foo',
                    name: 'bar',
                    ext: 'json',
                    fullPath: 'x.js'
                }, {});
                plugin.resourceUpdated({
                    bundleName: 'foo',
                    name: 'bar',
                    ext: 'json',
                    fullPath: 'y.json'
                }, {});
                expect(config._configPaths.foo.bar).to.equal('y.json');
                expect(readCalls).to.equal(2);
            });

        });


        describe('resourceDeleted()', function () {

            it("skips files that aren't resources", function () {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                config._configContents['x.json'] = 'contents';
                plugin.resourceDeleted({
                    ext: 'json',
                    fullPath: 'x.json'
                });
                expect(config._configContents['x.json']).to.equal('contents');
            });

            it('deletes stats', function () {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                config._configPaths.foo = {
                    bar: 'x.json'
                };
                config._configContents['x.json'] = 'contents';
                plugin.resourceDeleted({
                    bundleName: 'foo',
                    name: 'bar',
                    ext: 'json',
                    fullPath: 'x.json'
                }, {});
                expect(typeof config._configPaths.foo.bar).to.equal('undefined');
                expect(typeof config._configContents['x.json']).to.equal('undefined');
            });

        });


        describe('_expandContext()', function () {
            it('should skip if no baseContext', function () {
                var config,
                    input = {foo: 'bar'},
                    have;
                config = new Config();
                have = config._expandContext(input);
                compareObjects(have, input);
            });

            it('should mix in baseContext', function () {
                var config,
                    input = {foo: 'foo-in', bar: 'bar-in'},
                    base = {bar: 'bar-base', baz: 'baz-base'},
                    want = {bar: 'bar-in', baz: 'baz-base', foo: 'foo-in'},
                    have;
                config = new Config({baseContext: base});
                have = config._expandContext(input);
                compareObjects(have, want);
            });
        });
    });


    describe('using fixtures', function () {
        var mojito = libpath.resolve(fixtures, 'mojito-newsboxes'),
            touchdown = libpath.resolve(fixtures, 'touchdown-simple');


        describe('isYCB()', function () {
            it('should pass YCB files', function () {
                var config,
                    contents;
                config = new Config();
                contents = require(libpath.resolve(mojito, 'application.json'));
                expect(config._isYCB(contents)).to.equal(true);
                expect(config._isYCB([{settings: ['master']}])).to.equal(true);
            });
            it('should reject others', function () {
                var config,
                    contents;
                config = new Config();
                contents = require(libpath.resolve(mojito, 'package.json'));
                expect(config._isYCB(contents)).to.equal(false);
                expect(config._isYCB([])).to.equal(false);
                expect(config._isYCB(['foo', 'bar'])).to.equal(false);
                expect(config._isYCB([{foo: 'f'}, {bar: 'b'}])).to.equal(false);
                expect(config._isYCB([{foo: 'f'}, {settings: ['master']}])).to.equal(false);
                // malformed
                expect(config._isYCB([{settings: 'master'}])).to.equal(false);
            });
        });


        describe('_readConfigContents()', function () {

            it('reads .js config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(touchdown, 'configs/routes.js');
                config._readConfigContents(path).then(function (have) {
                    var getCalled = 0;
                    try {
                        expect(typeof have).to.equal('function');
                        have({
                            get: function () {
                                getCalled += 1;
                            }
                        });
                        expect(getCalled).to.equal(1);
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('reads .json config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'application.json');
                config._readConfigContents(path).then(function (have) {
                    var want = [
                        { settings: [ 'master' ], TODO: 'TODO' },
                        { settings: [ 'device:mobile' ], selector: 'mobile' }
                    ];
                    try {
                        compareObjects(have, want);
                        compareObjects(config._configContents[path], want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('fails on malformed .json config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.json');
                config._readConfigContents(path).then(function (have) {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .js config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.j');
                config._readConfigContents(path).then(function (have) {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

        });


        describe('readDimensions()', function () {
            it('mojito-newsboxes', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'modown',
                    name: 'dimensions',
                    fullPath: libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                }, {}).then(function () {
                    config.readDimensions().then(function (dims) {
                        try {
                            expect(dims).to.be.an('array');
                            expect(dims[0]).to.have.property('runtime');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                }, next);
            });

            it('touchdown-simple', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'simple',
                    name: 'dimensions',
                    fullPath: libpath.resolve(touchdown, 'configs/dimensions.json')
                }, {}).then(function () {
                    config.readDimensions().then(function (dims) {
                        try {
                            expect(dims).to.be.an('array');
                            expect(dims[0]).to.have.property('ynet');
                            next();
                        } catch (err) {
                            next(err);
                        }
                    }, next);
                }, next);
            });
        });


        describe('read()', function () {
            it('fails on unknown bundle', function (next) {
                var config;
                config = new Config();
                config.read('foo', 'bar', {}).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal(Config.test.message('unknown bundle', {bundle: 'foo'}));
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('fails on unknown config', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'modown-newsboxes',
                    name: 'application',
                    fullPath: libpath.resolve(mojito, 'application.json')
                }, {}).then(function () {
                    return config.read('modown-newsboxes', 'foo', {});
                }).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal(Config.test.message('unknown config', {bundle: 'modown-newsboxes', config: 'foo'}));
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('reads non-contextualized .js config files', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'simple',
                    name: 'routes',
                    fullPath: libpath.resolve(touchdown, 'configs/routes.js')
                }, {}).then(function () {
                    return config.read('simple', 'routes', {});
                }).then(function (have) {
                    var getCalled = 0;
                    try {
                        expect(typeof have).to.equal('function');
                        have({
                            get: function () {
                                getCalled += 1;
                            }
                        });
                        expect(getCalled).to.equal(1);
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('reads non-contextualized .json config files', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'simple',
                    name: 'routes',
                    fullPath: libpath.resolve(touchdown, 'configs/dimensions.json')
                }, {}).then(function () {
                    return config.read('simple', 'routes', {});
                }).then(function (have) {
                    try {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].dimensions).to.be.an('array');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('reads contextualized .js config files', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'simple',
                    name: 'dimensions',
                    fullPath: libpath.resolve(touchdown, 'configs/dimensions.json')
                }, {}).then(function () {
                    return plugin.resourceUpdated({
                        bundleName: 'simple',
                        name: 'foo',
                        fullPath: libpath.resolve(touchdown, 'configs/foo.js')
                    });
                }).then(function () {
                    return config.read('simple', 'foo', {device: 'mobile'});
                }).then(function (have) {
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

            it('reads contextualized .json config files', function (next) {
                var config,
                    plugin;
                config = new Config();
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'modown',
                    name: 'dimensions',
                    fullPath: libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                }, {}).then(function () {
                    return plugin.resourceUpdated({
                        bundleName: 'modown-newsboxes',
                        name: 'application',
                        fullPath: libpath.resolve(mojito, 'application.json')
                    });
                }).then(function () {
                    return config.read('modown-newsboxes', 'application', {device: 'mobile'});
                }).then(function (have) {
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

            it('applies baseContext', function (next) {
                var config,
                    plugin;
                config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                plugin = config.locatorPlugin();
                plugin.resourceUpdated({
                    bundleName: 'modown',
                    name: 'dimensions',
                    fullPath: libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                }, {}).then(function () {
                    return plugin.resourceUpdated({
                        bundleName: 'modown-newsboxes',
                        name: 'application',
                        fullPath: libpath.resolve(mojito, 'application.json')
                    });
                }).then(function () {
                    return config.read('modown-newsboxes', 'application', {});
                }).then(function (have) {
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
});


