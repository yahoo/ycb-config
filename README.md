modown-config
=============

normalizes advanced config file features behind a simple interface


## Goals & Design
* provide a single API for reading different kinds of configuration files
* hide advanced configuration file features (such as includes) behind a simple API


## Installation
Install using npm:

```shell
$ ynpm install modown-config
```


## Example

```javascript
var ConfigHelper = require('modown-config');

var helper = new ConfigHelper();

// This is optional. It allows modown-config to prepare the configuration
// file for faster response.
helper.addConfig('foo', 'bar', 'application.json');

// The `read()` method is the heart of modown-config. It is what reads the
// configuration file for you. If the file is context-sensitive it'll apply
// the context.
var context = { device: 'iphone', region: 'US' };
var contextualizedConfig = helper.read('foo', 'bar', context);
```


## License
This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/yahoo/locator/blob/master/LICENSE.txt


## Contribute
See the [CONTRIBUTE.md file][] for info.

[CONTRIBUTE.md file]: https://github.com/yahoo/locator/blob/master/CONTRIBUTE.md


