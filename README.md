# YCB Config

[![npm version](https://badge.fury.io/js/ycb-config.svg)](http://badge.fury.io/js/ycb-config)
![Build Status](https://github.com/yahoo/ycb-config/actions/workflows/test.yml/badge.svg)

A module that provides a simpler API to access and configure Yahoo Configuration Bundle files,
regardless of the file format used. It also provides a caching layer to reduce the amount of
calls necessary to the `ycb` module for processing.

## Overview

### Goals

Yahoo Configuration Bundle files (known as YCB files) are configuration files used to store information on
multiple "dimensions" of an application. They can include configuration information for properties such as
specific locales, languages, device types, environments (development vs. production), and more.

The YCB Config module helps to provide a better interface for reading important information from those files.
It provides a normalized way of accessing those files regardless of what file format (JSON, YAML, etc.) they're in.
And it provides a caching layer so that duplicate reads don't need to re-process the entire configuration object.

### Installation

Install using npm:

```shell
$ npm install ycb-config
```

## Usage

To get started, `require` the `ycb-config` module and instantiate it:

```js
var ConfigHelper = require('ycb-config'),
    helper = new ConfigHelper();
```

The following methods are then exposed through the `helper` object:

## Methods

#### `helper.addConfig(bundleName, configName, path, [callback])`

Example:

```js
helper.addConfig('homepage', 'weather-widget', 'config/application.json', function (err, config) {
    /**
     * `config` contains the configuration you just added as a JavaScript object
     * Properties within it will vary depending on your configuration file.
     */
});
```

YCB Config allows you to register a single configuration file with two properties:

-   A `bundle` name, which references the bundle of CSS, JavaScript, and other assets involved with a single
    modular portion of a web page.

-   A `config` name, which is just a simple name that we can use to reference that configuration object, rather
    than using the full file path name.

This needs to be done for every configuration file that you plan on accessing through YCB Config.

#### `helper.read(bundleName, configName, context, callback)`

Example:

```js
// This contextual information is usually obtained from some custom middleware in your application.
var context = {
    device: 'iphone',
    locale: 'en-US',
    bucket: 'new-feature-x',
};

// This requires that the config we're reading has already been added through `addConfig`.
helper.read('homepage', 'weather-widget', context, function (err, config) {
    /**
     * The `config` object now contains the correct configuration settings for
     * our context above.  You can use it to render a template correctly for an
     * iPhone, with the right localization settings for the US, and with the new
     * feature you're bucket testing for.
     */
});
```

YCB Config lets you read the configuration you've specified with the dimensions that you've provided through a
context object. The context object is always generated per request, and through custom middleware you write.

`read` will merge all of the matched configuration selectors into a single object that you can use. What
that means is that the context:

```js
{
    'device': 'iphone',
    'locale': 'en-US'
}
```

It will match the configuration that you specify for just:

```js
{
    'device': 'iphone'
}
```

As well as a more specific config for both:

```js
{
    'device': 'iphone',
    'locale': 'en-US'
}
```

It works a lot like CSS selectors, where a more specific config setting will override a
less specific config setting.

#### `helper.readNoMerge(bundleName, configName, context, callback)`

Example:

```js
// This contextual information is usually obtained from some custom middleware in your application.
var context = {
    device: 'iphone',
    locale: 'en-US',
    bucket: 'new-feature-x',
};

// This requires that the config we're reading has already been added through `addConfig`.
helper.readNoMerge('homepage', 'weather-widget', context, function (err, configs) {
    /**
     * The `configs` variable now contains an array of configuration settings, based on
     * the individual selectors, from most specific to least specific.
     *
     * Like before, you can use them to render a template correctly for an
     * iPhone, with the right localization settings for the US, and with the new
     * feature you're bucket testing for.
     *
     * This time, though, it's up to you to merge the individual configs instead of having
     * them automatically merged for you.
     */
});
```

YCB Config lets you read the configuration you've specified with the dimensions that you've provided through a
context object. The context object is always generated per request, and through custom middleware you write.

`readNoMerge` will not merge all of the matched configuration selectors into a single object, but instead,
provide all of them as individual objects within an array. It's up to the developer to determine how they
would like to properly handle all of the individual configuration settings with the current context.

#### `helper.readDimensions(callback)`

Example:

```js
// This requires that the config we're reading has already been added through `addConfig`
helper.readDimensions(function (err, dimensions) {
    /**
     * The `dimensions` variable contains an array of objects containing all of the possible
     * selectors that can be used to contextualize a request that's coming in.
     * See https://github.com/yahoo/ycb/blob/master/examples/full/dimensions.json
     * for an example of what this could look like.
     */
});
```

YCB Config lets you read just the dimensions that are available for you to contextualize a request that's
coming in. This can be an array of properties such as device type, language, feature bucket, or more.

### Promises

The following methods do not require a `callback` parameter, they will return Promise so that you can use chainable methods (such as` then` and `catch`) or` async` and `await` to handle asynchronous operations.

#### `helper.promises.addConfig(bundleName, configName, path)`

Example:

```js
helper.promises.addConfig('homepage', 'weather-widget', 'config/application.json').then(function (config) {
    /**
     * `config` contains the configuration you just added as a JavaScript object
     * Properties within it will vary depending on your configuration file.
     */
});
```

#### `helper.promises.read(bundleName, configName, context)`

Example:

```js
// This contextual information is usually obtained from some custom middleware in your application.
var context = {
    device: 'iphone',
    locale: 'en-US',
    bucket: 'new-feature-x',
};

// This requires that the config we're reading has already been added through `addConfig`.
helper.promises.read('homepage', 'weather-widget', context).then(function (config) {
    /**
     * The `config` object now contains the correct configuration settings for
     * our context above.  You can use it to render a template correctly for an
     * iPhone, with the right localization settings for the US, and with the new
     * feature you're bucket testing for.
     */
});
```

#### `helper.promises.readNoMerge(bundleName, configName, context)`

Example:

```js
// This contextual information is usually obtained from some custom middleware in your application.
var context = {
    device: 'iphone',
    locale: 'en-US',
    bucket: 'new-feature-x',
};

// This requires that the config we're reading has already been added through `addConfig`.
helper.readNoMerge('homepage', 'weather-widget', context).then(function (configs) {
    /**
     * The `configs` variable now contains an array of configuration settings, based on
     * the individual selectors, from most specific to least specific.
     *
     * Like before, you can use them to render a template correctly for an
     * iPhone, with the right localization settings for the US, and with the new
     * feature you're bucket testing for.
     *
     * This time, though, it's up to you to merge the individual configs instead of having
     * them automatically merged for you.
     */
});
```

#### `helper.promises.readDimensions()`

Example:

```js
// This requires that the config we're reading has already been added through `addConfig`
helper.promises.readDimensions.then(function (dimensions) {
    /**
     * The `dimensions` variable contains an array of objects containing all of the possible
     * selectors that can be used to contextualize a request that's coming in.
     * See https://github.com/yahoo/ycb/blob/master/examples/full/dimensions.json
     * for an example of what this could look like.
     */
});
```

## Scheduled Configs

To support scheduled configs as described in [ycb](https://github.com/yahoo/ycb) ycb-config must be set to time aware mode via option flag and the time must be passed as a special dimension of the context when in this mode.

```
let helper = new ConfigHelper({timeAware: true});
let context = req.context;
context.time = Date.now(); //{device: 'mobile', time: 1573235678929}
helper.read(bundle, config, context, callback);
```

The time value in the context should be a millisecond timestamp. To use a custom time dimension
it may specified asn an option:`new ConfigHelper({timeDimension: 'my-time-key'})`.

## License

This software is free to use under the Yahoo Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[license file]: https://github.com/yahoo/ycb-config/blob/master/LICENSE.txt

## Contribute

See the [CONTRIBUTING.md file][] for info.

[contributing.md file]: https://github.com/yahoo/ycb-config/blob/master/CONTRIBUTING.md
