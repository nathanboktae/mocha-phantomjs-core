var
  system = require('system'),
  webpage = require('webpage'),
  fs = require('fs'),
  url = system.args[1],
  reporter = system.args[2] || 'spec',
  config = JSON.parse(system.args[3] || '{}'),

  mochaStartWait = config.timeout || 6000,
  startTime = Date.now(),
  page

if (!url) {
  console.log("Usage: phantomjs mocha-phantomjs-core.js URL REPORTER [CONFIG-AS-JSON]")
  phantom.exit(0)
}

if (phantom.version.major < 1 || (phantom.version.major === 1 && phantom.version.minor < 9)) {
  console.log('mocha-phantomjs requires PhantomJS > 1.9.1')
  phantom.exit(-1)
}

if (config.hooks) {
  config.hooks = require(config.hooks)
} else {
  config.hooks = {}
}

var output = config.file ? fs.open(config.file, 'w') : system.stdout

var Reporter = (function() {
  function Reporter() {}

  Reporter.prototype.run = function() {
    this.initPage();
    return this.loadPage();
  };

  Reporter.prototype.customizeOptions = function() {
    return {
      columns: this.columns
    };
  };

  Reporter.prototype.fail = function(msg, errno) {
    if (output && config.file) {
      output.close();
    }
    if (msg) {
      console.log(msg);
    }
    return phantom.exit(errno || 1);
  };

  Reporter.prototype.finish = function() {
    if (config.file) {
      output.close();
    }
    return phantom.exit(page.evaluate(function() {
      return mochaPhantomJS.failures;
    }));
  };

  Reporter.prototype.initPage = function() {
    var _this = this;
    page = webpage.create({
      settings: config.settings
    });
    if (config.headers) {
      page.customHeaders = config.headers;
    }
    (config.cookies || []).forEach(function(cookie) {
      page.addCookie(cookie)
    })
    if (config.viewportSize) {
      page.viewportSize = config.viewportSize;
    }
    page.onConsoleMessage = function(msg) {
      return system.stdout.writeLine(msg);
    };
    page.onResourceError = function(resErr) {
      if (!config.ignoreResourceErrors) {
        return system.stdout.writeLine("Error loading resource " + resErr.url + " (" + resErr.errorCode + "). Details: " + resErr.errorString);
      }
    };
    page.onError = function(msg, traces) {
      var file, index, line, _j, _len1, _ref1;
      if (page.evaluate(function() {
        return window.onerror != null;
      })) {
        return;
      }
      for (index = _j = 0, _len1 = traces.length; _j < _len1; index = ++_j) {
        _ref1 = traces[index], line = _ref1.line, file = _ref1.file;
        traces[index] = "  " + file + ":" + line;
      }
      return _this.fail("" + msg + "\n\n" + (traces.join('\n')));
    };
    return page.onInitialized = function() {
      return page.evaluate(function(env) {
        return window.mochaPhantomJS = {
          env: env,
          failures: 0,
          ended: false,
          started: false,
          run: function() {
            mochaPhantomJS.runArgs = arguments;
            mochaPhantomJS.started = true;
            window.callPhantom({
              'mochaPhantomJS.run': true
            });
            return mochaPhantomJS.runner;
          }
        };
      }, system.env);
    };
  };

  Reporter.prototype.loadPage = function() {
    var _this = this;
    page.open(url);
    page.onLoadFinished = function(status) {
      page.onLoadFinished = function() {};
      if (status !== 'success') {
        _this.onLoadFailed();
      }
      return _this.waitForInitMocha();
    };
    return page.onCallback = function(data) {
      if (data != null ? data.hasOwnProperty('Mocha.process.stdout.write') : void 0) {
        output.write(data['Mocha.process.stdout.write']);
      } else if (data != null ? data.hasOwnProperty('mochaPhantomJS.run') : void 0) {
        if (_this.injectJS()) {
          _this.waitForRunMocha();
        }
      } else if (typeof (data != null ? data.screenshot : void 0) === "string") {
        page.render(data.screenshot + ".png");
      }
      return true;
    };
  };

  Reporter.prototype.onLoadFailed = function() {
    return this.fail("Failed to load the page. Check the url: " + url);
  };

  Reporter.prototype.injectJS = function() {
    if (page.evaluate(function() {
      return window.mocha != null;
    })) {
      page.injectJs('core_extensions.js');
      page.evaluate(function(columns) {
        return Mocha.reporters.Base.window.width = columns;
      }, parseInt(system.env.COLUMNS || 75) * .75 | 0);
      return true;
    } else {
      this.fail("Failed to find mocha on the page.");
      return false;
    }
  };

  Reporter.prototype.runMocha = function() {
    var customReporter, wrappedReporter, wrapper, _base;
    page.evaluate(function(config) {
      mocha.useColors(config.useColors);
      mocha.bail(config.bail);
      if (config.grep) {
        mocha.grep(config.grep);
      }
      if (config.invert) {
        return mocha.invert();
      }
    }, config);
    if (typeof (_base = config.hooks).beforeStart === "function") {
      _base.beforeStart(this);
    }
    if (page.evaluate(this.setupReporter, reporter) !== true) {
      customReporter = fs.read(reporter);
      wrapper = function() {
        var exports, module, process, require;
        require = function(what) {
          var r;
          what = what.replace(/[^a-zA-Z0-9]/g, '');
          for (r in Mocha.reporters) {
            if (r.toLowerCase() === what) {
              return Mocha.reporters[r];
            }
          }
          throw new Error("Your custom reporter tried to require '" + what + "', but Mocha is not running in Node.js in mocha-phantomjs, so Node modules cannot be required - only other reporters");
        };
        module = {};
        exports = undefined;
        process = Mocha.process;
        'customreporter';
        return Mocha.reporters.Custom = exports || module.exports;
      };
      wrappedReporter = wrapper.toString().replace("'customreporter'", "(function() {" + (customReporter.toString()) + "})()");
      page.evaluate(wrappedReporter);
      if (page.evaluate(function() {
        return !Mocha.reporters.Custom;
      }) || page.evaluate(this.setupReporter) !== true) {
        this.fail("Failed to use load and use the custom reporter " + reporter);
      }
    }
    if (page.evaluate(this.runner)) {
      this.mochaRunAt = new Date().getTime();
      return this.waitForMocha();
    } else {
      return this.fail("Failed to start mocha.");
    }
  };

  Reporter.prototype.waitForMocha = function() {
    var ended, _base;
    ended = page.evaluate(function() {
      return mochaPhantomJS.ended;
    });
    if (ended) {
      if (typeof (_base = config.hooks).afterEnd === "function") {
        _base.afterEnd(this);
      }
      return this.finish();
    } else {
      var self = this
      return setTimeout(function() {
        self.waitForMocha()
      }, 100);
    }
  };

  Reporter.prototype.waitForInitMocha = function() {
    if (!this.checkStarted()) {
      var self = this
      setTimeout(function() {
        self.waitForInitMocha()
      }, 100);
    }
  };

  Reporter.prototype.waitForRunMocha = function() {
    if (this.checkStarted()) {
      return this.runMocha();
    } else {
      var self = this
      setTimeout(function() {
        this.waitForRunMocha()
      }, 100)
    }
  };

  Reporter.prototype.checkStarted = function() {
    var started;
    started = page.evaluate(function() {
      return mochaPhantomJS.started;
    });
    if (!started && mochaStartWait && startTime + mochaStartWait < Date.now()) {
      this.fail("Failed to start mocha: Init timeout", 255);
    }
    return started;
  };

  Reporter.prototype.setupReporter = function(reporter) {
    var error;
    try {
      mocha.setup({
        reporter: reporter || Mocha.reporters.Custom
      });
      return true;
    } catch (_error) {
      error = _error;
      return error;
    }
  };

  Reporter.prototype.runner = function() {
    var cleanup, error, _ref, _ref1;
    try {
      mochaPhantomJS.runner = mocha.run.apply(mocha, mochaPhantomJS.runArgs);
      if (mochaPhantomJS.runner) {
        cleanup = function() {
          mochaPhantomJS.failures = mochaPhantomJS.runner.failures;
          return mochaPhantomJS.ended = true;
        };
        if ((_ref = mochaPhantomJS.runner) != null ? (_ref1 = _ref.stats) != null ? _ref1.end : void 0 : void 0) {
          cleanup();
        } else {
          mochaPhantomJS.runner.on('end', cleanup);
        }
      }
      return !!mochaPhantomJS.runner;
    } catch (_error) {
      error = _error;
      return false;
    }
  };

  return Reporter;

})()

var mocha = new Reporter()

mocha.run()
