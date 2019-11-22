/*
 * Copyright 2013 Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the BSD License.
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


        describe('cache usage', function () {

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
                config.read('foo', 'bar', {}, function (err, data) {
                    expect(readCalls).to.equal(1);
                    next();
                });
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
                config.read('foo', 'bar', {}, function(err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('orange');
                });
            });
            it('work with object content', function () {
                var config,
                    object = {color: 'red'};
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.json', object);
                config.read('foo', 'bar', {}, function(err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
            });
            it('reads .js config files', function () {
                var config,
                    object = {color: 'red'};
                config = new Config();
                config.addConfigContents('foo', 'bar', 'x.js', object);
                config.read('foo', 'bar', {}, function(err, have) {
                    expect(err).to.equal(null);
                    expect(have.color).to.equal('red');
                });
            });
        });


        describe('deleteConfig()', function () {

            it('deletes stats', function () {
                var config = new Config();
                config._configPaths.foo = {
                    bar: 'x.json'
                };
                config.deleteConfig('foo', 'bar', 'x.json');
                expect(typeof config._configPaths.foo.bar).to.equal('undefined');
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

            it('should handle undefined input', function () {
                var config = new Config();
                expect(config._mergeBaseContext()).to.be.an('object');
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


        describe('contentsIsYCB()', function () {
            it('should pass YCB files', function () {
                var contents;
                contents = require(libpath.resolve(mojito, 'application.json'));
                expect(Config.test.contentsIsYCB(contents)).to.equal(true);
                expect(Config.test.contentsIsYCB([{settings: ['master']}])).to.equal(true);
            });
            it('should reject others', function () {
                var contents;
                contents = require(libpath.resolve(mojito, 'package.json'));
                expect(Config.test.contentsIsYCB(contents)).to.equal(false);
                expect(Config.test.contentsIsYCB([])).to.equal(false);
                expect(Config.test.contentsIsYCB(['foo', 'bar'])).to.equal(false);
                expect(Config.test.contentsIsYCB([{foo: 'f'}, {bar: 'b'}])).to.equal(false);
                expect(Config.test.contentsIsYCB([{foo: 'f'}, {settings: ['master']}])).to.equal(false);
                // malformed
                expect(Config.test.contentsIsYCB([{settings: 'master'}])).to.equal(false);
            });
        });

        describe('makeYCB()', function () {
            it('should not error on undefined contents', function () {
                var dimensions = [{foo: 'f'}, {settings: ['master']}];
                expect(Config.test.makeYCB(Config, dimensions)).to.be.an('object');
            });
        });

        describe('_readConfigContents()', function () {

            it('reads .js config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(touchdown, 'configs/foo.js');
                config._readConfigContents(path, function (err, have) {
                    var want = [
                        { settings: [ 'master' ], TODO: 'TODO' },
                        { settings: [ 'device:mobile' ], selector: 'mobile' }
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
                var config,
                    path;
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
                        oh: [ 'double', 'single' ]
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
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'testfile.yaml');
                config._readConfigContents(path, function (err, have) {
                    var want = {
                        version: 12345,
                        customer: {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' }
                        },
                        'ship-to': {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' }
                        },
                        product: [ { book: '123ABC', price: 100 } ],
                        comments: 'Contact is Bill  Phone num @ 123-4567.\n'
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
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'testfile.yml');
                config._readConfigContents(path, function (err, have) {
                    var want = {
                        version: 12345,
                        customer: {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' }
                        },
                        'ship-to': {
                            name: 'John',
                            address: { lines: '701 first ave.\nSuite #292\n', city: 'Sunnyvale' }
                        },
                        product: [ { book: '123ABC', price: 100 } ],
                        comments: 'Contact is Bill  Phone num @ 123-4567.\n'
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
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'application.json');
                config._readConfigContents(path, function (err, have) {
                    var want = [
                        { settings: [ 'master' ], TODO: 'TODO' },
                        { settings: [ 'device:mobile' ], selector: 'mobile' }
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
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.json');
                config._readConfigContents(path, function (err, config) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .json5 config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.json5');
                config._readConfigContents(path, function (err, config) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .yaml config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.yaml');
                config._readConfigContents(path, function (err, config) {
                    expect(err).to.have.property('message');
                    expect(err).to.have.property('stack');
                    next();
                });
            });

            it('fails on malformed .yml config files', function (next) {
                var config,
                    path;
                config = new Config();
                path = libpath.resolve(mojito, 'broken.yml');
                config._readConfigContents(path, function (err, config) {
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
                config._readConfigContents(path, function (err, config) {
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
                    function (err, data) {
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
                    function (err, data) {
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
                config.read('foo', 'bar', {}, function(err, data) {
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
                        config.read('modown-newsboxes', 'foo', {}, function (err, data) {
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
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                if (err) { throw err; }
                                config.read('simple', 'foo', {device: 'mobile'}, function (err, have) {
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
                });
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json'),
                        function (err) {
                            if (err) { throw err; }
                            config.read('modown-newsboxes',
                                        'application', {device: 'mobile'}, function (err, have) {
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
                });
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
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function () {
                    config.addConfig(
                        'modown-newsboxes',
                        'application',
                        libpath.resolve(mojito, 'application.json'),
                        function (err) {
                            if (err) { throw err; }
                            config.read('modown-newsboxes', 'application', {},
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
                });
            });

            it('survives a bad context', function (next) {
                var config,
                    context;
                context = {device: 'torture'};
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                if (err) { throw err; }
                                config.read('simple', 'foo', context, function (err, have) {
                                    try {
                                        expect(have.selector).to.be.an('undefined');
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

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true
                });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                if (err) { throw err; }
                                config.read('simple', 'foo', {device: 'mobile'}, function (err, have) {
                                    expect(have).to.be.an('object');
                                    expect(have.TODO).to.equal('TODO');
                                    try {
                                        have.TODO = 'DONE';
                                    } catch (err) {
                                        expect(err.message).to.equal('Cannot assign to read only property \'TODO\' of object \'#<Object>\'');
                                        next();
                                    }
                                });
                            }
                        );
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
                        if (err) { throw err; }
                        config.readNoMerge('modown-newsboxes', 'foo', {}, function (err, have) {
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
                        if (err) { throw err; }
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
                });
            });

            it('reads contextualized .js config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                config.readNoMerge('simple', 'foo', {device: 'mobile'},
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
                                    });
                            }
                        );
                });
            });

            it('reads contextualized .json config files', function (next) {
                var config = new Config();
                config.addConfig(
                    'modown',
                    'dimensions',
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) { throw err; }
                                config.readNoMerge('modown-newsboxes', 'application', {device: 'mobile'},
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
                                    });
                            }
                        );
                });
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
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                if (err) { throw err; }
                                config.readNoMerge('modown-newsboxes', 'application', {},
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
                                    });
                            }
                        );
                });
            });

            it('survives a bad context', function (next) {
                var config,
                    context;
                context = {device: 'torture'};
                config = new Config();
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                if (err) { throw err; }
                                config.readNoMerge('simple', 'foo', context, function (err, have) {
                                    try {
                                        expect(have.selector).to.be.an('undefined');
                                        next();
                                    } catch (err) {
                                        next(err);
                                    }
                                });
                            }
                        );
                });
            });

            it('freezes the config object if the `safeMode` option is passed', function (next) {
                var config = new Config({
                    safeMode: true
                });
                config.addConfig(
                    'simple',
                    'dimensions',
                    libpath.resolve(touchdown, 'configs/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                if (err) { throw err; }
                                config.readNoMerge('simple', 'foo', {device: 'mobile'}, function (err, have) {
                                    expect(have).to.be.an('array');
                                    expect(have[0]).to.be.an('object');
                                    expect(have[0].TODO).to.equal('TODO');
                                    try {
                                        have[0].TODO = 'DONE';
                                    } catch (err) {
                                        expect(err.message).to.equal('Cannot assign to read only property \'TODO\' of object \'#<Object>\'');
                                        next();
                                    }
                                });
                            }
                        );
                    }
                );
            });
        });


        describe('_getYCB()', function () {
            it('fails on unknown bundle', function (next) {
                var config = new Config();
                config._getYCB('foo', 'bar', function (err, ycb) {
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
                        if (err) { throw err; }
                        config._getYCB('modown-newsboxes', 'foo', function (err, have) {
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
                        config._getYCB('simple', 'routes', function (err, ycb) {
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
                        if (err) { throw err; }
                        config.addConfig(
                            'simple',
                            'foo',
                            libpath.resolve(touchdown, 'configs/foo.js'),
                            function (err) {
                                config._getYCB('simple', 'foo', function (err, ycb) {
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
                                });
                            }
                        );
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
                        if (err) { throw err; }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                config._getYCB('modown-newsboxes', 'application', function (err, ycb) {
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
                                });
                            }
                        );
                    }
                );
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
                    libpath.resolve(mojito, 'node_modules/modown/dimensions.json'),
                    function (err) {
                        if (err) { throw err; }
                        config.addConfig(
                            'modown-newsboxes',
                            'application',
                            libpath.resolve(mojito, 'application.json'),
                            function (err) {
                                config._getYCB('modown-newsboxes', 'application', function (err, ycb) {
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
                                });
                            }
                        );
                    }
                );
            });
        });


        /* jshint ignore:start */
        describe("readPromises()", function() {
          it("fails on unknown bundle", function(next) {
            var config = new Config();
            config.readPromise("foo", "bar", {}).catch(err => {
              expect(err.message).to.equal('Unknown bundle "foo"');
              next();
            });
          });

          it("fails on unknown config", function(next) {
            var config = new Config();
            config.addConfig(
              "modown-newsboxes",
              "application",
              libpath.resolve(mojito, "application.json"),
              function(err) {
                config.readPromise("modown-newsboxes", "foo", {}).catch(err => {
                  expect(err.message).to.equal(
                    'Unknown config "foo" in bundle "modown-newsboxes"'
                  );
                  next();
                });
              }
            );
          });

          it("reads non-contextualized .json config files", function(next) {
            var config = new Config();
            config.addConfig(
              "simple",
              "routes",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                config.readPromise("simple", "routes", {}).then(have => {
                  expect(have).to.be.an("array");
                  expect(have[0]).to.be.an("object");
                  expect(have[0].dimensions).to.be.an("array");
                  next();
                });
              }
            );
          });

          it("reads contextualized .js config files", function(next) {
            var config = new Config();
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readPromise("simple", "foo", { device: "mobile" })
                      .then(have => {
                        expect(have).to.be.an("object");
                        expect(have.TODO).to.equal("TODO");
                        expect(have.selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("reads contextualized .json config files", function(next) {
            var config = new Config();
            config.addConfig(
              "modown",
              "dimensions",
              libpath.resolve(mojito, "node_modules/modown/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "modown-newsboxes",
                  "application",
                  libpath.resolve(mojito, "application.json"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readPromise("modown-newsboxes", "application", {
                        device: "mobile"
                      })
                      .then(have => {
                        expect(have).to.be.an("object");
                        expect(have.TODO).to.equal("TODO");
                        expect(have.selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("applies baseContext", function(next) {
            var config = new Config({
              baseContext: {
                device: "mobile"
              }
            });
            config.addConfig(
              "modown",
              "dimensions",
              libpath.resolve(mojito, "node_modules/modown/dimensions.json"),
              function() {
                config.addConfig(
                  "modown-newsboxes",
                  "application",
                  libpath.resolve(mojito, "application.json"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readPromise("modown-newsboxes", "application", {})
                      .then(have => {
                        expect(have).to.be.an("object");
                        expect(have.TODO).to.equal("TODO");
                        expect(have.selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("survives a bad context", function(next) {
            var config, context;
            context = { device: "torture" };
            config = new Config();
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config.readPromise("simple", "foo", context).then(have => {
                      expect(have.selector).to.be.an("undefined");
                      next();
                    });
                  }
                );
              }
            );
          });

          it("freezes the config object if the `safeMode` option is passed", function(next) {
            var config = new Config({
              safeMode: true
            });
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readPromise("simple", "foo", { device: "mobile" })
                      .then(have => {
                        expect(have).to.be.an("object");
                        expect(have.TODO).to.equal("TODO");
                        next();
                      });
                  }
                );
              }
            );
          });
        });


        describe("readNoMerge()", function() {
          it("fails on unknown bundle", function(next) {
            var config = new Config();
            config.readNoMergePromise("foo", "bar", {}).catch(err => {
              expect(err.message).to.equal('Unknown bundle "foo"');
              next();
            });
          });

          it("fails on unknown config", function(next) {
            var config = new Config();
            config.addConfig(
              "modown-newsboxes",
              "application",
              libpath.resolve(mojito, "application.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config
                  .readNoMergePromise("modown-newsboxes", "foo", {})
                  .catch(err => {
                    expect(err.message).to.equal(
                      'Unknown config "foo" in bundle "modown-newsboxes"'
                    );
                    next();
                  });
              }
            );
          });

          it("reads non-contextualized .json config files", function(next) {
            var config = new Config();
            config.addConfig(
              "simple",
              "routes",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.readNoMergePromise("simple", "routes", {}).then(have => {
                  expect(have).to.be.an("array");
                  expect(have[0]).to.be.an("array");
                  expect(have[0][0]).to.be.an("object");
                  expect(have[0][0].dimensions).to.be.an("array");
                  next();
                });
              }
            );
          });

          it("reads contextualized .js config files", function(next) {
            var config = new Config();
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    config
                      .readNoMergePromise("simple", "foo", { device: "mobile" })
                      .then(have => {
                        expect(have).to.be.an("array");
                        expect(have[0]).to.be.an("object");
                        expect(have[0].TODO).to.equal("TODO");
                        expect(have[1]).to.be.an("object");
                        expect(have[1].selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("reads contextualized .json config files", function(next) {
            var config = new Config();
            config.addConfig(
              "modown",
              "dimensions",
              libpath.resolve(mojito, "node_modules/modown/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "modown-newsboxes",
                  "application",
                  libpath.resolve(mojito, "application.json"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readNoMergePromise("modown-newsboxes", "application", {
                        device: "mobile"
                      })
                      .then(have => {
                        expect(have).to.be.an("array");
                        expect(have[0]).to.be.an("object");
                        expect(have[0].TODO).to.equal("TODO");
                        expect(have[1]).to.be.an("object");
                        expect(have[1].selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("applies baseContext", function(next) {
            var config = new Config({
              baseContext: {
                device: "mobile"
              }
            });
            config.addConfig(
              "modown",
              "dimensions",
              libpath.resolve(mojito, "node_modules/modown/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "modown-newsboxes",
                  "application",
                  libpath.resolve(mojito, "application.json"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readNoMergePromise("modown-newsboxes", "application", {})
                      .then(have => {
                        expect(have).to.be.an("array");
                        expect(have[0]).to.be.an("object");
                        expect(have[0].TODO).to.equal("TODO");
                        expect(have[1]).to.be.an("object");
                        expect(have[1].selector).to.equal("mobile");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("survives a bad context", function(next) {
            var config, context;
            context = { device: "torture" };
            config = new Config();
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readNoMergePromise("simple", "foo", context)
                      .then(have => {
                        expect(have.selector).to.be.an("undefined");
                        next();
                      });
                  }
                );
              }
            );
          });

          it("freezes the config object if the `safeMode` option is passed", function(next) {
            var config = new Config({
              safeMode: true
            });
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err) {
                if (err) {
                  throw err;
                }
                config.addConfig(
                  "simple",
                  "foo",
                  libpath.resolve(touchdown, "configs/foo.js"),
                  function(err) {
                    if (err) {
                      throw err;
                    }
                    config
                      .readNoMergePromise("simple", "foo", { device: "mobile" })
                      .then(have => {
                        expect(have).to.be.an("array");
                        expect(have[0]).to.be.an("object");
                        expect(have[0].TODO).to.equal("TODO");
                        try {
                          have[0].TODO = "DONE";
                        } catch (err) {
                          expect(err.message).to.equal(
                            "Cannot assign to read only property 'TODO' of object '#<Object>'"
                          );
                          next();
                        }
                      });
                  }
                );
              }
            );
          });
        });


        describe("readDimensionsPromise()", function() {
          it("mojito-newsboxes", function(next) {
            var config = new Config();
            config.addConfig(
              "modown",
              "dimensions",
              libpath.resolve(mojito, "node_modules/modown/dimensions.json"),
              function(err, data) {
                config.readDimensionsPromise().then(dims => {
                  expect(dims).to.be.an("array");
                  expect(dims[0]).to.have.property("runtime");
                  next();
                });
              }
            );
          });

          it("touchdown-simple", function(next) {
            var config = new Config();
            config.addConfig(
              "simple",
              "dimensions",
              libpath.resolve(touchdown, "configs/dimensions.json"),
              function(err, data) {
                config.readDimensionsPromise().then(dims => {
                  expect(dims).to.be.an("array");
                  expect(dims[0]).to.have.property("ynet");
                  next();
                });
              }
            );
          });
        });
        /* jshint ignore:end */
    });
});
