# Run client-side Mocha tests in PhantomJS or SlimerJS

## Deprecated

Ariya Hidayat [archived phantomjs](https://github.com/ariya/phantomjs/issues/15344) on March 3rd, 2018. (See [this tweet](https://twitter.com/AriyaHidayat/status/970173001701367808) for more info). phantomjs served us all as great headless browser for years, but now with [Electron](https://electronjs.org/) and headless modes for both [Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome) and [Firefox](https://developer.mozilla.org/en-US/Firefox/Headless_mode), we have much better options.  [mocha-chrome](https://github.com/shellscape/mocha-chrome) is a project inspired by `mocha-phantomjs`, so migration should be easy, and you will be running your tests on the same browser that 50% of your users actually use! I highly recommend it.

I will accept pull requests still, but I won't be answering issues or doing feature work myself.

## Summary

[![Build Status](https://secure.travis-ci.org/nathanboktae/mocha-phantomjs-core.png)](http://travis-ci.org/nathanboktae/mocha-phantomjs-core)

So now that you got your tests [Mocha](http://mochajs.org/) running on a simple flat HTML file, now how do you run them in your CI environment? [Karma](http://karma-runner.github.io/)? what is this `karma.conf.js` file I have to write? and some background runner task? how do I grep over just a few tests? wait I need a to also install a launcher for phantomjs or slimerjs too? bleck.

Rather than force you to redo your test harness and local development testing, simply run `phantomjs mocha-phantomjs-core.js spec tests/mytests.html` and be done with it. `mocha-phantomjs-core` builds on top of what you already have, with no high barrier to entry like Karma.

New in 2.0 is [SlimerJS](https://slimerjs.org) support! There are [some bugs](https://github.com/laurentj/slimerjs/issues/created_by/nathanboktae) still to be worked out, but now you can run your tests headless on the latest firefox version instead of an old QtWebKit!

## Installation

```
npm install mocha-phantomjs-core
```

## Usage

```
<phantomjs|slimerjs> mocha-phantomjs-core.js <TESTS> <REPORTER> <CONFIG as JSON>

Examples:
phantomjs ./node_modules/mocha-phantomjs-core/mocha-phantomjs-core.js tests.html
phantomjs ./node_modules/mocha-phantomjs-core/mocha-phantomjs-core.js tests/runner.html xunit > results.xml
/usr/local/bin/phantomjs /path/to/mocha-phantomjs-core.js tests.html spec "{\"useColors\":true}"
```

Due to resource loading timing issues with external sources, you may need to call `initMochaPhantomJS` before calling any mocha setup functions like `setup()`, `ui()`, etc. `mocha-phantomjs-core` will notify you if you need this, and if so, add a check for it before your mocha setup code:

```
if (typeof initMochaPhantomJS === 'function') {
  initMochaPhantomJS()
}
```

This can be avoided by removing unnessecary external resources like fonts, CSS, etc. from your tests, or simply having `mocha.js` as the first script loaded.

### Config

It's best to always refer to [the tests](https://github.com/nathanboktae/mocha-phantomjs-core/blob/master/test/core.tests.coffee) for full usage and examples.

#### `reporter`

One of mocha's built in reporters, or a full path to a file for a 3rd party reporter (see below on how to write one).

#### `grep`

a string to pass to `mocha.grep()` to filter tests. also provide `invert: true` if you want to invert the grep and filter out tests.

#### `useColors`

Boolean. Force or suppress color usage. Defaults to what your terminal supports.

#### `bail`

Boolean. Stop the test run at the first failure if true. Defaults to false.

#### `ignoreResourceErrors`

Boolean. Suppress the resource failure output that `mocha-phantomjs-core` will output by default.

#### `loadTimeout`

Time in milliseconds after the page loads that `mocha.run` needs to be called. Defaults to 10 seconds. 

#### `timeout`

Sets mocha's root suite timeout. Defers to mocha's default if omitted. 

#### `viewportSize`

Sets the viewport size. Specify `height` and `width`, like below:

#### `settings`

If you need to pass [additional settings](https://github.com/ariya/phantomjs/wiki/API-Reference-WebPage#webpage-settings) to the phantomjs webpage, you can specify an object of settings here, including common ones like `userAgent` and `loadImages`.

```
phantomjs mocha-phantomjs-core.js dot tests/mytests.html "{\"viewportSize\":{\"width\":720,\"height\":480}}"
```

Previously `mocha-phantomjs` required you to look for `mochaPhantomJS` and then use `mochaPhantomJS.run()`. That is no longer required. Call `mocha.run()` as you normally would.

## Screenshots

`mocha-phantomjs-core` supports creating screenshots from your test code. For example, you could write a function like below into your test code.

```javascript
function takeScreenshot() {
  if (window.callPhantom) {
    var date = new Date()
    var filename = "screenshots/" + date.getTime()
    console.log("Taking screenshot " + filename)
    callPhantom({'screenshot': filename})
  }
}
```

If you want to generate a screenshot for each test failure you could add the following into your test code.

```javascript
  afterEach(function () {
    if (this.currentTest.state == 'failed') {
      takeScreenshot()
    }
  })
```

## Send event

`mocha-phantomjs-core` supports [sending events](http://phantomjs.org/api/webpage/method/send-event.html)
from your test code to allow for more ouside testing. For example, to trigger an external `click` event:

```javascript
if (window.callPhantom) {
  window.callPhantom({
    sendEvent: ['click', 10, 10] // array of arguments
  });
}
```

## Changing `viewportSize`

`mocha-phantomjs-core` now also supports changing of viewportSize (the simulated `window` size for the headless browser) - while running tests.

```javascript
if (window.callPhantom) {
  window.callPhantom({
    viewportSize : {
      width : 100,
      height : 100
    }
  });
}
```

This comes on particlarly handy when testing for responsiveness.

## Environment variables

`mocha-phantomjs-core` will expose environment variables at `mocha.env`

## Third Party Reporters

Mocha has support for custom [3rd party reporters](https://github.com/mochajs/mocha/wiki/Third-party-reporters), and mocha-phantomjs does support 3rd party reporters, but keep in mind - *the reporter does not run in Node.js, but in the browser, and node modules can't be required.* You need to only use basic, vanilla JavaScript when using third party reporters. However, some things are available:

- `require`: You can only require other reporters, like `require('./base')` to build off of the BaseReporter
- `exports`, `module`: Export your reporter class as normal
- `process`: use `process.stdout.write` preferrably to support the `--file` option over `console.log` (see #114)

Also, no compilers are supported currently, so please provide plain ECMAScript 5 for your reporters.

## Testing

```
npm install
npm test
```

Travis CI does a matrix build against phantomjs 1.9.7 and 2.0.0, currently. See `.travis.yml` for the latest.

To debug an individual test, since they are just process forks, you may want to run them directly, like

```
phantomjs mocha-phantomjs-core.js test/timeout.html spec "{\"timeout\":500}"
```

## License

Released under the MIT license. Copyright (c) 2015 Ken Collins and Nathan Black.

