/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
 * See the accompanying LICENSE.txt file for terms.
 */

'use strict';

var libpath = require('path'),
    libfs = require('fs'),
    expect = require('chai').expect,
    assert = require('chai').assert,
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
        describe('constructor', function () {
            it('should initialize nicely', function () {
                var config = new Config();
                expect(config._dimensionsPath).to.be.a('undefined');
            });
            it('should preserve options', function () {
                var config,
                    options = {
                        dimensionsPath: 'foo',
                    };
                config = new Config(options);
                expect(config._dimensionsPath).to.equal(options.dimensionsPath);
            });
        });

        describe('dimensions.json detection', function () {
            it('uses dimensionsPath given to the constructor', function () {
                var config = new Config({ dimensionsPath: 'foo' });
                expect(config._dimensionsPath).to.equal('foo');
            });

            it('uses dimensionsBundle given to the constructor', function () {
                var config = new Config({ dimensionsBundle: 'foo' });
                // we don't actually need to read the file
                config.addConfigContents('foo', 'dimensions', 'foo.json', '["contents"]');
                config.addConfigContents('bar', 'dimensions', 'b.json', '["contents"]');
                config.addConfig('foo', 'dimensions', 'foo.json');
                config.addConfig('bar', 'dimensions', 'b.json');
                expect(config._dimensionsPath).to.equal('foo.json');
            });

            it('uses shortest path', function () {
                var config = new Config();
                // we don't actually need to read the file
                config.addConfigContents('foo', 'dimensions', 'foo.json', '["contents"]');
                config.addConfigContents('bar', 'dimensions', 'b.json', '["contents"]');
                config.addConfig('foo', 'dimensions', 'foo.json');
                config.addConfig('bar', 'dimensions', 'b.json');
                expect(config._dimensionsPath).to.equal('b.json');
            });

            it('not found', function () {
                var config = new Config();
                // we don't actually need to read the file
                config._readConfigContents = function (path, callback) {
                    return callback(null, 'contents');
                };
                config.addConfig('foo', 'x', 'foo.json');
                config.addConfig('bar', 'y', 'b.json');
                expect(typeof config._dimensionsPath).to.equal('undefined');
            });
        });

        describe('addConfig()', function () {
            it('saves stats', function () {
                var config = new Config();
                config.addConfigContents('foo', 'bar', 'x.json', '["contents"]');
                config.addConfig('foo', 'bar', 'x.json');
                expect(config._configPaths.foo.bar).to.equal('x.json');
            });

            it('updates an existing resource', function () {
                var config = new Config();
                config.addConfigContents('foo', 'bar', 'x.js', '["contents"]');
                config.addConfigContents('foo', 'bar', 'y.json', '["contents"]');
                config.addConfig('foo', 'bar', 'x.js');
                config.addConfig('foo', 'bar', 'y.json');
                expect(config._configPaths.foo.bar).to.equal('y.json');
            });
        });

        describe('addConfigContents()', function () {
            it('work with string content', function () {
                var config;
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.json', '{"color":"orange"}');
                config.read('foo', 'bar', {}, function (err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('orange');
                });
            });
            it('work with object content', function () {
                var config,
                    object = { color: 'red' };
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.json', object);
                config.read('foo', 'bar', {}, function (err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
            });
            it('reads .js config files', function () {
                var config,
                    object = { color: 'red' };
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.js', object);
                config.read('foo', 'bar', {}, function (err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
            });
            it('reads .mjs config files', function () {
                var config = new Config({
                        dimensionsPath: libpath.resolve(fixtures, 'touchdown-simple/configs/dimensions.json'),
                    }),
                    fullPath = libpath.resolve(fixtures, 'touchdown-simple/configs/untranspiled-esm.mjs');
                config.addConfigContents('foo', 'bar', fullPath, null, function (err) {
                    expect(err).to.equal(null);
                    config.read('foo', 'bar', {}, function (err, have) {
                        expect(err).to.equal(null);
                        expect(have).to.deep.equal({
                            syntax: 'esm',
                            transpiled: false,
                        });
                    });
                });
            });
            it('should work twice in a row', function () {
                var config,
                    object = { color: 'red' };
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.js', object);
                config.read('foo', 'bar', {}, function (err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
                config.addConfigContents('foo', 'bar', 'x.js', object);
                config.read('foo', 'bar', {}, function (err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
            });
            it('should not set stale ycb', function (done) {
                var ycbConfig = new Config({
                    dimensionsPath: libpath.resolve(fixtures, 'touchdown-simple/configs/dimensions.json'),
                });
                var bundleName = 'bundle';
                var configName = 'config';

                var config1 = [{ settings: ['master'], msg: 'FIRST' }];
                var config2 = [{ settings: ['master'], msg: 'SECOND' }];

                ycbConfig.addConfigContents(bundleName, configName, 'example-config.json', config1, function () {
                    ycbConfig.read(bundleName, configName, {}, function (err, config) {
                        expect(err).to.equal(null);
                        expect(config.msg).to.equal('FIRST');
                    });
                });
                ycbConfig.addConfigContents(bundleName, configName, 'example-config.json', config2, function () {});
                setTimeout(function () {
                    ycbConfig.read(bundleName, configName, {}, function (err, config) {
                        expect(err).to.equal(null);
                        expect(config.msg).to.equal('SECOND');
                        done();
                    });
                }, 100);
            });
        });

        describe('deleteConfig()', function () {
            var touchdown = libpath.resolve(fixtures, 'touchdown-simple');

            it('deletes stats', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.addConfig(
                                'simple',
                                'no-master',
                                libpath.resolve(touchdown, 'configs/foo.js'),
                                function (err) {
                                    if (err) {
                                        throw err;
                                    }
                                    config.addConfig(
                                        'other',
                                        'foo',
                                        libpath.resolve(touchdown, 'configs/foo.js'),
                                        function (err) {
                                            if (err) {
                                                throw err;
                                            }
                                            expect(Object.keys(config._configPaths.simple).length).to.equal(3);
                                            expect(Object.keys(config._configPaths.other).length).to.equal(1);
                                            expect(Object.keys(config._configIdMap.simple).length).to.equal(3);
                                            expect(Object.keys(config._configIdMap.other).length).to.equal(1);
                                            config.deleteConfig('simple', 'foo', '');
                                            expect(Object.keys(config._configPaths.simple).length).to.equal(2);
                                            expect(Object.keys(config._configPaths.other).length).to.equal(1);
                                            expect(Object.keys(config._configIdMap.simple).length).to.equal(2);
                                            expect(Object.keys(config._configIdMap.other).length).to.equal(1);
                                            expect(config._configPaths.simple.foo).to.equal(undefined);
                                            config.deleteConfig('other', 'foo', '');
                                            expect(config._configPaths.other).to.equal(undefined);
                                            expect(config._configIdMap.other).to.equal(undefined);
                                            next();
                                        }
                                    );
                                }
                            );
                        });
                    }
                );
            });

            it('does not delete configs sharing same path', function () {
                var config = new Config({ cache: { max: 0 } });
                config.addConfigContents('foo', 'dimensions', 'path', [
                    { dimensions: [{ ynet: { 0: null, 1: null } }] },
                ]);
                config.addConfigContents('foo', 'bar', 'fake', [{ settings: ['master'], value: 'master config' }]);
                config.addConfigContents('foo', 'baz', 'fake', [{ settings: ['master'], value: 'master config' }]);
                config.read('foo', 'bar', {}, function (err) {
                    expect(err).to.equal(null);
                });
                config.read('foo', 'baz', {}, function (err) {
                    expect(err).to.equal(null);
                });
                config.deleteConfig('foo', 'baz', 'fake.json');
                config.read('foo', 'bar', {}, function (err) {
                    expect(err).to.equal(null);
                });
                config.read('foo', 'baz', {}, function (err) {
                    expect(err).to.not.equal(null);
                });
            });
        });

        describe('_mergeBaseContext()', function () {
            it('should skip if no baseContext', function () {
                var config,
                    input = { foo: 'bar' },
                    have;
                config = new Config();
                have = config._mergeBaseContext(input);
                compareObjects(have, input);
            });

            it('should handle undefined input', function () {
                var config = new Config();
                expect(config._mergeBaseContext()).to.be.an('object');
            });

            it('should mix in baseContext', function () {
                var config,
                    input = { foo: 'foo-in', bar: 'bar-in' },
                    base = { bar: 'bar-base', baz: 'baz-base' },
                    want = { bar: 'bar-in', baz: 'baz-base', foo: 'foo-in' },
                    have;
                config = new Config({ baseContext: base });
                have = config._mergeBaseContext(input);
                compareObjects(have, want);
            });
        });
    });

    describe('using fixtures', function () {
        var mojito = libpath.resolve(fixtures, 'mojito-newsboxes'),
            touchdown = libpath.resolve(fixtures, 'touchdown-simple');

        describe('contentsIsYCB()', function () {
            it('should pass YCB files', function () {
                var contents;
                contents = require(libpath.resolve(mojito, 'application.json'));
                expect(Config.test.contentsIsYCB(contents)).to.equal(true);
                expect(Config.test.contentsIsYCB([{ settings: ['master'] }])).to.equal(true);
            });
            it('should reject others', function () {
                var contents;
                contents = require(libpath.resolve(mojito, 'package.json'));
                expect(Config.test.contentsIsYCB(contents)).to.equal(false);
                expect(Config.test.contentsIsYCB([])).to.equal(false);
                expect(Config.test.contentsIsYCB(['foo', 'bar'])).to.equal(false);
                expect(Config.test.contentsIsYCB([{ foo: 'f' }, { bar: 'b' }])).to.equal(false);
                expect(Config.test.contentsIsYCB([{ foo: 'f' }, { settings: ['master'] }])).to.equal(false);
            });
        });

        describe('ES Modules', function () {
            it('should use the default export of a transpiled ES Module', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(touchdown, 'configs/transpiled-esm.js');
                config._readConfigContents(path, function (err, have) {
                    var want = [
                        {
                            settings: ['master'],
                            syntax: 'esm',
                            transpiled: true,
                        },
                    ];
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('should use the default export of an untranspiled ES Module', function (next) {
                var version = parseInt(process.versions.node.split('.'), 10);
                var config, path;
                config = new Config();
                path = libpath.resolve(touchdown, 'configs/untranspiled-esm.mjs');
                config._readConfigContents(path, function (err, have) {
                    if (version >= 12) {
                        var want = [
                            {
                                settings: ['master'],
                                syntax: 'esm',
                                transpiled: false,
                            },
                        ];
                        try {
                            compareObjects(have, want);
                            next();
                        } catch (err) {
                            next(err);
                        }
                    } else {
                        expect(err).to.be.an['instanceof'](Error);
                        expect(err.message).to.include('Unexpected token export');
                        next();
                    }
                });
            });
        });

        describe('makeYCB()', function () {
            it('should not error on undefined contents', function () {
                var dimensions = [{ foo: 'f' }, { settings: ['master'] }];
                expect(Config.test.makeYCB(Config, dimensions)).to.be.an('object');
            });
        });

        describe('_readConfigContents()', function () {
            it('reads .js config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(touchdown, 'configs/foo.js');
                config._readConfigContents(path, function (err, have) {
                    var want = [
                        { settings: ['master'], TODO: 'TODO' },
                        { settings: ['device:mobile'], selector: 'mobile' },
                    ];
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('reads .json5 config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'testfile.json5');
                config._readConfigContents(path, function (err, have) {
                    var want = {
                        foo: 'bar',
                        boolean: true,
                        string: 'long string multi-line string',
                        comment: 'inline',
                        hex: 3735928559,
                        decimal: 0.5,
                        delta: 10,
                        oh: ['double', 'single'],
                    };
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('reads .yaml config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'testfile.yaml');
                config._readConfigContents(path, function (err, have) {
                    var want = {
                        version: 12345,
                        customer: {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' },
                        },
                        'ship-to': {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' },
                        },
                        product: [{ book: '123ABC', price: 100 }],
                        comments: 'Contact is Bill  Phone num @ 123-4567.\n',
                    };
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('reads .yml config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'testfile.yml');
                config._readConfigContents(path, function (err, have) {
                    var want = {
                        version: 12345,
                        customer: {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' },
                        },
                        'ship-to': {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' },
                        },
                        product: [{ book: '123ABC', price: 100 }],
                        comments: 'Contact is Bill  Phone num @ 123-4567.\n',
                    };
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('reads .json config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'application.json');
                config._readConfigContents(path, function (err, have) {
                    var want = [
                        { settings: ['master'], TODO: 'TODO' },
                        { settings: ['device:mobile'], selector: 'mobile' },
                    ];
                    try {
                        compareObjects(have, want);
                        next();
                    } catch (err) {
                        next(err);
                    }
                });
            });

            it('fails on malformed .json config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.json');
                config._readConfigContents(path, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .json5 config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.json5');
                config._readConfigContents(path, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .yaml config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.yaml');
                config._readConfigContents(path, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .yml config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.yml');
                config._readConfigContents(path, function (err) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .js config files', function (next) {
                var config, path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.j');
                config._readConfigContents(path, function (err) {
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
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function () {
                        config.readDimensions(function (err, dims) {
                            try {
                                expect(dims).to.be.an('array');
                                expect(dims[0]).to.have.property('runtime');
                                next();
                            } catch (err) {
                                next(err);
                            }
                        });
                    }
                );
            });

            it('touchdown-simple', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function () {
                        config.readDimensions(function (err, dims) {
                            try {
                                expect(dims).to.be.an('array');
                                expect(dims[0]).to.have.property('ynet');
                                next();
                            } catch (err) {
                                next(err);
                            }
                        });
                    }
                );
            });
        });

        describe('read()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config.read('foo', 'bar', {}, function (err) {
                    try {
                        expect(err.message).to.equal('Unknown bundle "foo"');
                        next();
                    } catch (e) {
                        next(e);
                    }
                });
            });

            it('strips undefined', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/undefined-config.js'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                    try {
                                        expect(have).to.be.an('object');
                                        expect(Object.keys(have).length).to.be.equal(2);
                                        next();
                                    } catch (err) {
                                        next(err);
                                    }
                                });
                            }
                        );
                    }
                );
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown-newsboxes',
                    'application',
                    libpath.resolve(mojito, 'application.json'),
                    function () {
                        config.read('modown-newsboxes', 'foo', {}, function (err) {
                            try {
                                expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                                next();
                            } catch (e) {
                                next(e);
                            }
                        });
                    }
                );
            });

            it('reads non-contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function () {
                        config.read('simple', 'routes', {}, function (err, have) {
                            try {
                                expect(err).to.equal(null);
                                expect(have).to.be.an('array');
                                expect(have[0]).to.be.an('object');
                                expect(have[0].dimensions).to.be.an('array');
                                next();
                            } catch (err) {
                                next(err);
                            }
                        });
                    }
                );
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                try {
                                    expect(have).to.be.an('object');
                                    expect(have.TODO).to.equal('TODO');
                                    expect(have.selector).to.equal('mobile');
                                    next();
                                } catch (err) {
                                    next(err);
                                }
                            });
                        });
                    }
                );
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.read(
                                    'modown-newsboxes',
                                    'application',
                                    { device: 'mobile' },
                                    function (err, have) {
                                        try {
                                            expect(have).to.be.an('object');
                                            expect(have.TODO).to.equal('TODO');
                                            expect(have.selector).to.equal('mobile');
                                            next();
                                        } catch (err) {
                                            next(err);
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });

            it('applies baseContext', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile',
                    },
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function () {
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.read('modown-newsboxes', 'application', {}, function (err, have) {
                                    try {
                                        expect(have).to.be.an('object');
                                        expect(have.TODO).to.equal('TODO');
                                        expect(have.selector).to.equal('mobile');
                                        next();
                                    } catch (err) {
                                        next(err);
                                    }
                                });
                            }
                        );
                    }
                );
            });

            it('survives a bad context', function (next) {
                var config, context;
                context = { device: 'torture' };
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', context, function (err, have) {
                                try {
                                    expect(have.selector).to.be.an('undefined');
                                    next();
                                } catch (err) {
                                    next(err);
                                }
                            });
                        });
                    }
                );
            });

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true,
                });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                expect(have).to.be.an('object');
                                expect(have.TODO).to.equal('TODO');
                                try {
                                    have.TODO = 'DONE';
                                } catch (err) {
                                    expect(err.message).to.equal(
                                        "Cannot assign to read only property 'TODO' of object '#<Object>'"
                                    );
                                    next();
                                }
                            });
                        });
                    }
                );
            });
        });

        describe('readNoMerge()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config.readNoMerge('foo', 'bar', {}, function (err) {
                    if (err) {
                        try {
                            expect(err.message).to.equal('Unknown bundle "foo"');
                            next();
                        } catch (e) {
                            next(e);
                        }
                    } else {
                        next(new Error("Shouldn't get here."));
                    }
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown-newsboxes',
                    'application',
                    libpath.resolve(mojito, 'application.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.readNoMerge('modown-newsboxes', 'foo', {}, function (err) {
                            try {
                                expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                                next();
                            } catch (e) {
                                next(e);
                            }
                        });
                    }
                );
            });

            it('reads non-contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.readNoMerge('simple', 'routes', {}, function (err, have) {
                            try {
                                expect(have).to.be.an('array');
                                expect(have[0]).to.be.an('array');
                                expect(have[0][0]).to.be.an('object');
                                expect(have[0][0].dimensions).to.be.an('array');
                                next();
                            } catch (err) {
                                next(err);
                            }
                        });
                    }
                );
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function () {
                            config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
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
                            });
                        });
                    }
                );
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.readNoMerge(
                                    'modown-newsboxes',
                                    'application',
                                    { device: 'mobile' },
                                    function (err, have) {
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
                                    }
                                );
                            }
                        );
                    }
                );
            });

            it('applies baseContext', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile',
                    },
                });
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.readNoMerge('modown-newsboxes', 'application', {}, function (err, have) {
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
                                });
                            }
                        );
                    }
                );
            });

            it('survives a bad context', function (next) {
                var config, context;
                context = { device: 'torture' };
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', context, function (err, have) {
                                try {
                                    expect(have.selector).to.be.an('undefined');
                                    next();
                                } catch (err) {
                                    next(err);
                                }
                            });
                        });
                    }
                );
            });

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true,
                });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                expect(have).to.be.an('array');
                                expect(have[0]).to.be.an('object');
                                expect(have[0].TODO).to.equal('TODO');
                                try {
                                    have[0].TODO = 'DONE';
                                } catch (err) {
                                    expect(err.message).to.equal(
                                        "Cannot assign to read only property 'TODO' of object '#<Object>'"
                                    );
                                    next();
                                }
                            });
                        });
                    }
                );
            });
        });

        describe('time-functionality', function () {
            function intervalHelper(intervals, time) {
                var applicable = [];
                var next = Number.POSITIVE_INFINITY;
                for (var i = 0; i < intervals.length; i++) {
                    var interval = intervals[i];
                    var valid = true;
                    if (interval.start) {
                        valid = valid && interval.start <= time;
                        if (interval.start > time && interval.start < next) {
                            next = interval.start;
                        }
                    }
                    if (interval.end) {
                        valid = valid && interval.end >= time;
                        if (valid && interval.end < next) {
                            next = interval.end + 1;
                        }
                    }
                    if (valid) {
                        applicable.push(interval.name);
                    }
                }
                next = next === Number.POSITIVE_INFINITY ? undefined : next;
                return { configs: applicable, next: next };
            }

            it('scheduled configs should match timestamp', function (done) {
                var bundle;
                var path = libpath.join(__dirname, '..', 'fixtures', 'time', 'time-test.json');
                var data = libfs.readFileSync(path, 'utf8');
                bundle = JSON.parse(data);
                var intervals = [];
                var minTime = Number.POSITIVE_INFINITY;
                var maxTime = 0;
                bundle.forEach(function (config) {
                    if (config.settings) {
                        var name = config.name;
                        var interval = config.intervals[name];
                        if (interval.start || interval.end) {
                            if (interval.start && interval.start < minTime) {
                                minTime = interval.start;
                            }
                            if (interval.end && interval.end > maxTime) {
                                maxTime = interval.end;
                            }
                            interval = { start: interval.start, end: interval.end, name: name };
                            intervals.push(interval);
                        }
                    }
                });
                var config = new Config({ timeAware: true, cache: { max: 1000 } });
                config.addConfig(
                    'test',
                    'dimensions',
                    libpath.join(__dirname, '..', 'fixtures', 'time', 'time-test-dimensions.json'),
                    function () {
                        config.addConfig(
                            'test',
                            'configs',
                            libpath.join(__dirname, '..', 'fixtures', 'time', 'time-test-configs.json'),
                            function () {
                                var context = { environment: 'prod', device: 'smartphone' };
                                var times = [];
                                for (var t = minTime - 2; t < maxTime + 2; t++) {
                                    times.push(t);
                                }
                                var temp = times.slice();
                                temp.reverse();
                                times = times.concat(temp);
                                for (var i = 0; i < times.length; i++) {
                                    t = times[i];
                                    var ret = intervalHelper(intervals, t);
                                    var valid = ret.configs;
                                    context = { environment: 'prod', device: 'smartphone', time: t };
                                    /* jshint ignore:start */
                                    config.read('test', 'configs', context, function (err, config) {
                                        assert.equal(err, null, 'error should be null');
                                        assert(
                                            Object.keys(config.intervals).length === valid.length,
                                            'Number of valid configs should be equal'
                                        );
                                        valid.forEach(function (name) {
                                            assert(
                                                config.intervals[name] !== undefined,
                                                'Config ' + name + ' should be valid'
                                            );
                                        });
                                    });
                                    config.readNoMerge('test', 'configs', context, function (err, config) {
                                        assert.equal(err, null, 'error should be null');
                                        assert(
                                            config.length === valid.length,
                                            'Number of unmerged configs should be equal'
                                        );
                                    });
                                    /* jshint ignore:end */
                                }
                                done();
                            }
                        );
                    }
                );
            });

            it('custom time dimension is honored', function (next) {
                var config = new Config({ timeDimension: 'mytime' });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/no-master.js'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.read(
                                    'simple',
                                    'foo',
                                    { device: 'mobile', mytime: 1572872362000 },
                                    function (err, have) {
                                        if (err) {
                                            throw err;
                                        }
                                        expect(have).to.be.an('object');
                                        expect(have.name).to.equal('new');
                                        next();
                                    }
                                );
                            }
                        );
                    }
                );
            });

            it('readNoMerge time aware should correctly determine expiration time', function (next) {
                var config = new Config({ timeAware: true });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/no-master.js'),
                            function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.readNoMerge(
                                    'simple',
                                    'foo',
                                    { device: 'desktop', time: 0 },
                                    function (err, have) {
                                        if (err) {
                                            throw err;
                                        }
                                        have[0] = { foo: 'bar' };
                                        config.readNoMerge(
                                            'simple',
                                            'foo',
                                            { device: 'desktop', time: Number.MAX_SAFE_INTEGER },
                                            function (err, have) {
                                                if (err) {
                                                    throw err;
                                                }
                                                expect(have).to.be.an('array');
                                                expect(have[0].foo).to.equal('bar');
                                                next();
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });

        describe('cache-functionality', function () {
            it('[read] caches the config', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                have.foo = 'bar';
                                config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                    expect(have).to.be.an('object');
                                    expect(have.foo).to.equal('bar');
                                    next();
                                });
                            });
                        });
                    }
                );
            });

            it('[read-time-aware] caches the config', function (next) {
                var config = new Config({ timeAware: true });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile', time: 0 }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have.foo = 'bar';
                                config.read('simple', 'foo', { device: 'mobile', time: 0 }, function (err, have) {
                                    if (err) {
                                        throw err;
                                    }
                                    expect(have).to.be.an('object');
                                    expect(have.foo).to.equal('bar');
                                    next();
                                });
                            });
                        });
                    }
                );
            });

            it('[read-no-merge]caches the config', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have[0].foo = 'bar';
                                config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                    if (err) {
                                        throw err;
                                    }
                                    expect(have).to.be.an('array');
                                    expect(have[0].foo).to.equal('bar');
                                    next();
                                });
                            });
                        });
                    }
                );
            });

            it('[read-no-merge-time-aware] caches the config', function (next) {
                var config = new Config({ timeAware: true });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', { device: 'mobile', time: 0 }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have[0].foo = 'bar';
                                config.readNoMerge(
                                    'simple',
                                    'foo',
                                    { device: 'mobile', time: 0 },
                                    function (err, have) {
                                        if (err) {
                                            throw err;
                                        }
                                        expect(have).to.be.an('array');
                                        expect(have[0].foo).to.equal('bar');
                                        next();
                                    }
                                );
                            });
                        });
                    }
                );
            });

            it('cache capacity option is honored', function (next) {
                var config = new Config({ cache: { max: 0 } });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                have.foo = 'bar';
                                config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                    expect(have).to.be.an('object');
                                    expect(have.foo).to.equal(undefined);
                                    next();
                                });
                            });
                        });
                    }
                );
            });

            it('[read] adding config should invalidate current cache entries', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have.foo = 'bar';
                                config.addConfig(
                                    'simple',
                                    'foo',
                                    libpath.resolve(touchdown, 'configs/foo.js'),
                                    function (err) {
                                        if (err) {
                                            throw err;
                                        }
                                        config.read('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                            if (err) {
                                                throw err;
                                            }
                                            expect(have).to.be.an('object');
                                            expect(have.foo).to.equal(undefined);
                                            next();
                                        });
                                    }
                                );
                            });
                        });
                    }
                );
            });

            it('[read-time-aware] adding config should invalidate current cache entries', function (next) {
                var config = new Config({ timeAware: true });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile', time: 0 }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have.foo = 'bar';
                                config.addConfig(
                                    'simple',
                                    'foo',
                                    libpath.resolve(touchdown, 'configs/foo.js'),
                                    function (err) {
                                        if (err) {
                                            throw err;
                                        }
                                        config.read(
                                            'simple',
                                            'foo',
                                            { device: 'mobile', time: 0 },
                                            function (err, have) {
                                                if (err) {
                                                    throw err;
                                                }
                                                expect(have).to.be.an('object');
                                                expect(have.foo).to.equal(undefined);
                                                next();
                                            }
                                        );
                                    }
                                );
                            });
                        });
                    }
                );
            });

            it('[read-no-merge] adding config should invalidate current cache entries', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have[0].foo = 'bar';
                                config.addConfig(
                                    'simple',
                                    'foo',
                                    libpath.resolve(touchdown, 'configs/foo.js'),
                                    function (err) {
                                        if (err) {
                                            throw err;
                                        }
                                        config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                            if (err) {
                                                throw err;
                                            }
                                            expect(have).to.be.an('array');
                                            expect(have[0].foo).to.equal(undefined);
                                            next();
                                        });
                                    }
                                );
                            });
                        });
                    }
                );
            });

            it('[read-no-merge-time-aware] adding config should invalidate current cache entries', function (next) {
                var config = new Config({ timeAware: true });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.readNoMerge('simple', 'foo', { device: 'mobile', time: 0 }, function (err, have) {
                                if (err) {
                                    throw err;
                                }
                                have[0].foo = 'bar';
                                config.addConfig(
                                    'simple',
                                    'foo',
                                    libpath.resolve(touchdown, 'configs/foo.js'),
                                    function (err) {
                                        if (err) {
                                            throw err;
                                        }
                                        config.readNoMerge(
                                            'simple',
                                            'foo',
                                            { device: 'mobile', time: 0 },
                                            function (err, have) {
                                                if (err) {
                                                    throw err;
                                                }
                                                expect(have).to.be.an('array');
                                                expect(have[0].foo).to.equal(undefined);
                                                next();
                                            }
                                        );
                                    }
                                );
                            });
                        });
                    }
                );
            });

            it('read and read-no-merge do not cache collide', function (next) {
                var config = new Config({});
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function (err) {
                            if (err) {
                                throw err;
                            }
                            config.read('simple', 'foo', { device: 'mobile' }, function (err) {
                                if (err) {
                                    throw err;
                                }
                                config.readNoMerge('simple', 'foo', { device: 'mobile' }, function (err, have) {
                                    expect(have).to.be.an('array');
                                    next();
                                });
                            });
                        });
                    }
                );
            });
        });

        describe('_getYCB()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config._getYCB('foo', 'bar', function (err) {
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
                    libpath.resolve(mojito, 'application.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config._getYCB('modown-newsboxes', 'foo', function (err) {
                            try {
                                expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                                next();
                            } catch (e) {
                                next(e);
                            }
                        });
                    }
                );
            });

            it('reads non-contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'routes',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function () {
                        config._getYCB('simple', 'routes', function (err, tag, ycb) {
                            var have = ycb.read({});
                            try {
                                expect(have).to.be.an('array');
                                expect(have[0]).to.be.an('object');
                                expect(have[0].dimensions).to.be.an('array');
                                next();
                            } catch (err) {
                                next(err);
                            }
                        });
                    }
                );
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'), function () {
                            config._getYCB('simple', 'foo', function (err, tag, ycb) {
                                var have;
                                try {
                                    have = ycb.read({ device: 'mobile' });
                                    expect(have).to.be.an('object');
                                    expect(have.TODO).to.equal('TODO');
                                    expect(have.selector).to.equal('mobile');
                                    next();
                                } catch (err) {
                                    next(err);
                                }
                            });
                        });
                    }
                );
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) {
                            throw err;
                        }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function () {
                                config._getYCB('modown-newsboxes', 'application', function (err, tag, ycb) {
                                    var have;
                                    try {
                                        have = ycb.read({ device: 'mobile' });
                                        expect(have).to.be.an('object');
                                        expect(have.TODO).to.equal('TODO');
                                        expect(have.selector).to.equal('mobile');
                                        next();
                                    } catch (err) {
                                        next(err);
                                    }
                                });
                            }
                        );
                    }
                );
            });
        });
        /* jshint ignore:start */
        describe('promises.read()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config.promises.read('foo', 'bar', {})['catch']((err) => {
                    expect(err.message).to.equal('Unknown bundle "foo"');
                    next();
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('modown-newsboxes', 'application', libpath.resolve(mojito, 'application.json'))
                    .then(() => config.promises.read('modown-newsboxes', 'foo', {}))
                    ['catch']((err) => {
                        expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                        next();
                    });
            });

            it('reads non-contextualized .json config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('simple', 'routes', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() => config.promises.read('simple', 'routes', {}))
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].dimensions).to.be.an('array');
                        next();
                    });
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() => config.promises.read('simple', 'foo', { device: 'mobile' }))
                    .then((have) => {
                        expect(have).to.be.an('object');
                        expect(have.TODO).to.equal('TODO');
                        expect(have.selector).to.equal('mobile');
                        next();
                    });
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('modown', 'dimensions', libpath.resolve(mojito, 'node_modules/modown/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json')
                        )
                    )
                    .then(() =>
                        config.promises.read('modown-newsboxes', 'application', {
                            device: 'mobile',
                        })
                    )
                    .then((have) => {
                        expect(have).to.be.an('object');
                        expect(have.TODO).to.equal('TODO');
                        expect(have.selector).to.equal('mobile');
                        next();
                    });
            });

            it('applies baseContext', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile',
                    },
                });
                config.promises
                    .addConfig('modown', 'dimensions', libpath.resolve(mojito, 'node_modules/modown/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json')
                        )
                    )
                    .then(() => config.promises.read('modown-newsboxes', 'application', {}))
                    .then((have) => {
                        expect(have).to.be.an('object');
                        expect(have.TODO).to.equal('TODO');
                        expect(have.selector).to.equal('mobile');
                        next();
                    });
            });

            it('survives a bad context', function (next) {
                var config, context;
                context = { device: 'torture' };
                config = new Config();
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() =>
                        config.promises.read('simple', 'foo', context).then((have) => {
                            expect(have.selector).to.be.an('undefined');
                            next();
                        })
                    );
            });

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true,
                });
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() => config.promises.read('simple', 'foo', { device: 'mobile' }))
                    .then((have) => {
                        expect(have).to.be.an('object');
                        expect(have.TODO).to.equal('TODO');
                        next();
                    });
            });
        });

        describe('promises.readNoMerge()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config.promises.readNoMerge('foo', 'bar', {})['catch']((err) => {
                    expect(err.message).to.equal('Unknown bundle "foo"');
                    next();
                });
            });

            it('fails on unknown config', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('modown-newsboxes', 'application', libpath.resolve(mojito, 'application.json'))
                    .then(() => config.promises.readNoMerge('modown-newsboxes', 'foo', {}))
                    ['catch']((err) => {
                        expect(err.message).to.equal('Unknown config "foo" in bundle "modown-newsboxes"');
                        next();
                    });
            });

            it('reads non-contextualized .json config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('simple', 'routes', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() => config.promises.readNoMerge('simple', 'routes', {}))
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('array');
                        expect(have[0][0]).to.be.an('object');
                        expect(have[0][0].dimensions).to.be.an('array');
                        next();
                    });
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() => config.promises.readNoMerge('simple', 'foo', { device: 'mobile' }))
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    });
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('modown', 'dimensions', libpath.resolve(mojito, 'node_modules/modown/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json')
                        )
                    )
                    .then(() =>
                        config.promises.readNoMerge('modown-newsboxes', 'application', {
                            device: 'mobile',
                        })
                    )
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    });
            });

            it('applies baseContext', function (next) {
                var config = new Config({
                    baseContext: {
                        device: 'mobile',
                    },
                });
                config.promises
                    .addConfig('modown', 'dimensions', libpath.resolve(mojito, 'node_modules/modown/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json')
                        )
                    )
                    .then(() => config.promises.readNoMerge('modown-newsboxes', 'application', {}))
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        expect(have[1]).to.be.an('object');
                        expect(have[1].selector).to.equal('mobile');
                        next();
                    });
            });

            it('survives a bad context', function (next) {
                var config, context;
                context = { device: 'torture' };
                config = new Config();
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() => config.promises.readNoMerge('simple', 'foo', context))
                    .then((have) => {
                        expect(have.selector).to.be.an('undefined');
                        next();
                    });
            });

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true,
                });
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() =>
                        config.promises.addConfig('simple', 'foo', libpath.resolve(touchdown, 'configs/foo.js'))
                    )
                    .then(() => config.promises.readNoMerge('simple', 'foo', { device: 'mobile' }))
                    .then((have) => {
                        expect(have).to.be.an('array');
                        expect(have[0]).to.be.an('object');
                        expect(have[0].TODO).to.equal('TODO');
                        try {
                            have[0].TODO = 'DONE';
                        } catch (err) {
                            expect(err.message).to.equal(
                                "Cannot assign to read only property 'TODO' of object '#<Object>'"
                            );
                            next();
                        }
                    });
            });
        });

        describe('promises.readDimensions()', function () {
            it('mojito-newsboxes', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('modown', 'dimensions', libpath.resolve(mojito, 'node_modules/modown/dimensions.json'))
                    .then(() => config.promises.readDimensions())
                    .then((dims) => {
                        expect(dims).to.be.an('array');
                        expect(dims[0]).to.have.property('runtime');
                        next();
                    });
            });

            it('touchdown-simple', function (next) {
                var config = new Config();
                config.promises
                    .addConfig('simple', 'dimensions', libpath.resolve(touchdown, 'configs/dimensions.json'))
                    .then(() => config.promises.readDimensions())
                    .then((dims) => {
                        expect(dims).to.be.an('array');
                        expect(dims[0]).to.have.property('ynet');
                        next();
                    });
            });
        });
        /* jshint ignore:end */
    });
});
