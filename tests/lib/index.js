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
        describe('merge()', function () {
            it('should work on arrays', function () {
                var base = [0, 1, 2, 3],
                    over = ['a', 'b'];
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(['a', 'b', 2, 3]);
            });

            it('should work on objects', function () {
                var base = {
                        a: 1,
                        b: 2
                    },
                    over = {
                        c: 3,
                        d: 4
                    },
                    want = {
                        a: 1,
                        b: 2,
                        c: 3,
                        d: 4
                    };
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(want);
            });

            it('should replace object values', function () {
                var base = {
                        a: 1,
                        b: 2
                    },
                    over = {
                        c: 3,
                        a: 4
                    },
                    want = {
                        a: 4,
                        b: 2,
                        c: 3
                    };
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(want);
            });

            it('should handle nested merges', function () {
                var base = {
                        a: 1,
                        b: 2,
                        c: {
                            foo: 1
                        }
                    },
                    over = {
                        c: {
                            bar: 2
                        }
                    },
                    want = {
                        a: 1,
                        b: 2,
                        c: {
                            foo: 1,
                            bar: 2
                        }
                    };
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(want);
            });

            it('should handle nested merges with replacements', function () {
                var base = {
                        a: 1,
                        b: 2,
                        c: {
                            foo: 1,
                            baz: 3
                        }
                    },
                    over = {
                        a: 4,
                        c: {
                            foo: 3,
                            bar: 2
                        }
                    },
                    want = {
                        a: 4,
                        b: 2,
                        c: {
                            foo: 3,
                            bar: 2,
                            baz: 3
                        }
                    };
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(want);
            });

            it('value type matrix', function () {
                // positions:  base, overlay
                // s = scalar
                // o = object
                // a = array
                // n = null
                // u = undefined
                // m = missing (not given)
                var base = {
                        'ss': 'base-ss',
                        'so': 'base-so',
                        'sa': 'base-sa',
                        'sn': 'base-sn',
                        'su': 'base-su',
                        'sm': 'base-sm',
                        'os': { 'base': 'os' },
                        'oo': { 'base': 'oo' },
                        'oa': { 'base': 'oa' },
                        'on': { 'base': 'on' },
                        'ou': { 'base': 'ou' },
                        'om': { 'base': 'om' },
                        'as': [ 'base-as' ],
                        'ao': [ 'base-ao' ],
                        'aa': [ 'base-aa' ],
                        'an': [ 'base-an' ],
                        'au': [ 'base-au' ],
                        'am': [ 'base-am' ],
                        'ns': null,
                        'no': null,
                        'na': null,
                        'nn': null,
                        'nu': null,
                        'nm': null,
                        'us': undefined,
                        'uo': undefined,
                        'ua': undefined,
                        'un': undefined,
                        'uu': undefined,
                        'um': undefined
                    },
                    over = {
                        'ss': 'over-ss',
                        'so': { 'over': 'so' },
                        'sa': [ 'over-sa' ],
                        'sn': null,
                        'su': undefined,
                        'os': 'over-os',
                        'oo': { 'over': 'oo' },
                        'oa': [ 'over-oa' ],
                        'on': null,
                        'ou': undefined,
                        'as': 'over-as',
                        'ao': { 'over': 'ao' },
                        'aa': [ 'over-aa' ],
                        'an': null,
                        'au': undefined,
                        'ns': 'over-ns',
                        'no': { 'over': 'no' },
                        'na': [ 'over-na' ],
                        'nn': null,
                        'nu': undefined,
                        'us': 'over-us',
                        'uo': { 'over': 'uo' },
                        'ua': [ 'over-ua' ],
                        'un': null,
                        'uu': undefined,
                        'ms': 'over-ms',
                        'mo': { 'over': 'mo' },
                        'ma': [ 'over-ma' ],
                        'mn': null,
                        'mu': undefined
                    },
                    want = {
                        'ss': 'over-ss',
                        'so': 'base-so',
                        'sa': [ 'over-sa' ],
                        'sn': null,
                        'sm': 'base-sm',
                        'su': undefined,
                        'os': 'over-os',
                        'oo': { 'base': 'oo', 'over': 'oo' },
                        'oa': [ 'over-oa' ],
                        'on': null,
                        'om': { 'base': 'om' },
                        'ou': undefined,
                        'as': 'over-as',
                        'ao': [ 'base-ao' ],
                        'aa': [ 'over-aa' ],
                        'an': null,
                        'am': [ 'base-am' ],
                        'au': undefined,
                        'ns': 'over-ns',
                        'no': { 'over': 'no' },
                        'na': [ 'over-na' ],
                        'nn': null,
                        'nm': null,
                        'nu': undefined,
                        'mu': undefined,
                        'us': 'over-us',
                        'uo': { 'over': 'uo' },
                        'ua': [ 'over-ua' ],
                        'un': null,
                        'uu': undefined,
                        'ms': 'over-ms',
                        'mo': { 'over': 'mo' },
                        'ma': [ 'over-ma' ],
                        'mn': null,
                        'um': undefined
                    };
                want.ao.over = 'ao';
                base = Config.test.merge(over, base);
                expect(base).to.deep.equal(want);
            });
        });


        describe('constructor', function () {
            it('should initialize nicely', function () {
                var config = new Config();
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


        describe('dimensions.json detection', function () {

            it('uses dimensionsPath given to the constructor', function () {
                var config = new Config({dimensionsPath: 'foo'});
                expect(config._dimensionsPath).to.equal('foo');
            });

            it('uses dimensionsBundle given to the constructor', function () {
                var config = new Config({dimensionsBundle: 'foo'});
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                config.addConfig('foo', 'dimensions', 'foo.json');
                config.addConfig('bar', 'dimensions', 'b.json');
                expect(config._dimensionsPath).to.equal('foo.json');
            });

            it('uses shortest path', function () {
                var config = new Config();
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                config.addConfig('foo', 'dimensions', 'foo.json');
                config.addConfig('bar', 'dimensions', 'b.json');
                expect(config._dimensionsPath).to.equal('b.json');
            });

            it('not found', function () {
                var config = new Config();
                // we don't actually need to read the file
                config._readConfigContents = function () {
                    return {
                        then: function (f, r) {
                            f('contents');
                        }
                    };
                };
                config.addConfig('foo', 'x', 'foo.json');
                config.addConfig('bar', 'y', 'b.json');
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
                        return 'xyz';
                    }
                };
                config.read('foo', 'bar', {}).then(function () {
                    expect(readCalls).to.equal(1);
                    next();
                }, next);
            });

        });


        describe('addConfig()', function () {

            it('saves stats', function () {
                var config,
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
                config.addConfig('foo', 'bar', 'x.json');
                expect(config._configPaths.foo.bar).to.equal('x.json');
                expect(readCalls).to.equal(1);
            });

            it('updates an existing resource', function () {
                var config,
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
                config.addConfig('foo', 'bar', 'x.js');
                config.addConfig('foo', 'bar', 'y.json');
                expect(config._configPaths.foo.bar).to.equal('y.json');
                expect(readCalls).to.equal(2);
            });

        });


        describe('deleteConfig()', function () {

            it('deletes stats', function () {
                var config = new Config();
                config._configPaths.foo = {
                    bar: 'x.json'
                };
                config._configContents['x.json'] = 'contents';
                config.deleteConfig('foo', 'bar', 'x.json');
                expect(typeof config._configPaths.foo.bar).to.equal('undefined');
                expect(typeof config._configContents['x.json']).to.equal('undefined');
            });

        });


        describe('_mergeBaseContext()', function () {
            it('should skip if no baseContext', function () {
                var config,
                    input = {foo: 'bar'},
                    have;
                config = new Config();
                have = config._mergeBaseContext(input);
                compareObjects(have, input);
            });

            it('should mix in baseContext', function () {
                var config,
                    input = {foo: 'foo-in', bar: 'bar-in'},
                    base = {bar: 'bar-base', baz: 'baz-base'},
                    want = {bar: 'bar-in', baz: 'baz-base', foo: 'foo-in'},
                    have;
                config = new Config({baseContext: base});
                have = config._mergeBaseContext(input);
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
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
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
                var config = new Config();
                config.read('foo', 'bar', {}).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown bundle "foo"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown-newsboxes',
                    'application',
                    libpath.resolve(mojito, 'application.json')
                ).then(function () {
                    return config.read('modown-newsboxes', 'foo', {});
                }).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('reads non-contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/routes.js')
                ).then(function () {
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'simple',
                        'foo',
                        libpath.resolve(touchdown, 'configs/foo.js')
                    );
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
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
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
                var config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
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

            it('survives a bad context', function (next) {
                var config,
                    context;
                context = {device: 'torture'};
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'simple',
                        'foo',
                        libpath.resolve(touchdown, 'configs/foo.js')
                    );
                }).then(function () {
                    return config.read('simple', 'foo', context);
                }).then(function (have) {
                    try {
                        expect(have.selector).to.be.an('undefined');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('gracefully handles YCB errors', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'unknown-dim.json')
                    );
                }).then(function () {
                    return config.read('modown-newsboxes', 'application', {
                        device: 'unknown'
                    });
                }).then(function (have) {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });
        });


        describe('readNoMerge()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config.readNoMerge('foo', 'bar', {}).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown bundle "foo"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown-newsboxes',
                    'application',
                    libpath.resolve(mojito, 'application.json')
                ).then(function () {
                    return config.readNoMerge('modown-newsboxes', 'foo', {});
                }).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('reads non-contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/routes.js')
                ).then(function () {
                    return config.readNoMerge('simple', 'routes', {});
                }).then(function (have) {
                    var getCalled = 0;
                    try {
                        expect(have).to.be.an('array');
                        expect(typeof have[0]).to.equal('function');
                        have[0]({
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.readNoMerge('simple', 'routes', {});
                }).then(function (have) {
                    try {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('array');
                        expect(have[0][0]).to.be.an('object');
                        expect(have[0][0].dimensions).to.be.an('array');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'simple',
                        'foo',
                        libpath.resolve(touchdown, 'configs/foo.js')
                    );
                }).then(function () {
                    return config.readNoMerge('simple', 'foo', {device: 'mobile'});
                }).then(function (have) {
                    try {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
                }).then(function () {
                    return config.readNoMerge('modown-newsboxes', 'application', {device: 'mobile'});
                }).then(function (have) {
                    try {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('applies baseContext', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
                }).then(function () {
                    return config.readNoMerge('modown-newsboxes', 'application', {});
                }).then(function (have) {
                    try {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('survives a bad context', function (next) {
                var config,
                    context;
                context = {device: 'torture'};
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'simple',
                        'foo',
                        libpath.resolve(touchdown, 'configs/foo.js')
                    );
                }).then(function () {
                    return config.readNoMerge('simple', 'foo', context);
                }).then(function (have) {
                    try {
                        expect(have.selector).to.be.an('undefined');
                        next();
                    } catch (err) {
                        next(err);
                    }
                }, next);
            });

            it('gracefully handles YCB errors', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'unknown-dim.json')
                    );
                }).then(function () {
                    return config.readNoMerge('modown-newsboxes', 'application', {
                        device: 'unknown'
                    });
                }).then(function (have) {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });
        });


        describe('_getYCB()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config._getYCB('foo', 'bar').then(function (ycb) {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown bundle "foo"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown-newsboxes',
                    'application',
                    libpath.resolve(mojito, 'application.json')
                ).then(function () {
                    return config._getYCB('modown-newsboxes', 'foo');
                }).then(function () {
                    next(new Error('shoudnt get here'));
                }, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('reads non-contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/routes.js')
                ).then(function () {
                    return config._getYCB('simple', 'routes');
                }).then(function (ycb) {
                    var getCalled = 0,
                        have = ycb.read({});
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config._getYCB('simple', 'routes');
                }).then(function (ycb) {
                    var have = ycb.read({});
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
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'simple',
                        'foo',
                        libpath.resolve(touchdown, 'configs/foo.js')
                    );
                }).then(function () {
                    return config._getYCB('simple', 'foo');
                }).then(function (ycb) {
                    var have;
                    try {
                        have = ycb.read({device: 'mobile'});
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
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
                }).then(function () {
                    return config._getYCB('modown-newsboxes', 'application');
                }).then(function (ycb) {
                    var have;
                    try {
                        have = ycb.read({device: 'mobile'});
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
                var config = new Config({
                    baseContext: {
                        device: 'mobile'
                    }
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json')
                ).then(function () {
                    return config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json')
                    );
                }).then(function () {
                    return config._getYCB('modown-newsboxes', 'application');
                }).then(function (ycb) {
                    var have;
                    try {
                        have = ycb.read({});
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


