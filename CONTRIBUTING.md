## Contributing Code to `ycb-config`

This components follows the same contribution model used by [Mojito][], you can
review the [Contributing-Code-to-Mojito file][] for more details.

Please be sure to sign our [CLA][] before you submit pull requests or otherwise contribute to `ycb-config`. This protects `ycb-config` developers, who rely on [`ycb-config`'s BSD license][].

[`ycb-config`'s bsd license]: https://github.com/yahoo/ycb-config/blob/master/LICENSE.txt
[cla]: http://developer.yahoo.com/cocktails/mojito/cla/
[mojito]: https://github.com/yahoo/mojito
[contributing-code-to-mojito file]: https://github.com/yahoo/mojito/wiki/Contributing-Code-to-Mojito

## Dev mode installation

-   The main source files are located under `lib/`.
-   Unit tests are located under `tests/lib/*`.

To install the dependencies:

    npm install

To run the unit tests (with coverage by default):

    npm test

To lint the app lib folder:

    npm run lint
