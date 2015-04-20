var
  system = require('system'),
  webpage = require('webpage'),
  fs = require('fs'),
  url = system.args[1],
  reporter = system.args[2] || 'spec',
  config = JSON.parse(system.args[3] || '{}'),

  mochaStartWait = config.timeout || 6000,
  startTime = Date.now(),
  hookData

if (!url) {
  console.log("Usage: phantomjs mocha-phantomjs-core.js URL REPORTER [CONFIG-AS-JSON]")
  phantom.exit(0)
}

if (phantom.version.major < 1 || (phantom.version.major === 1 && phantom.version.minor < 9)) {
  console.log('mocha-phantomjs requires PhantomJS > 1.9.1')
  phantom.exit(-1)
}

if (config.hooks) {
  hookData = {
    page: page,
    config: config,
    reporter: reporter,
    startTime: startTime
  }
  config.hooks = require(config.hooks)
} else {
  config.hooks = {}
}

// Create and configure the client page
var
  output = config.file ? fs.open(config.file, 'w') : system.stdout,
  page = webpage.create({
    settings: config.settings
  }),
  fail = function(msg, errno) {
    if (output && config.file) {
      output.close()
    }
    if (msg) {
      console.log(msg)
    }
    return phantom.exit(errno || 1)
  }

if (config.headers) {
  page.customHeaders = config.headers
}
(config.cookies || []).forEach(function(cookie) {
  page.addCookie(cookie)
})
if (config.viewportSize) {
  page.viewportSize = config.viewportSize
}

page.onConsoleMessage = function(msg) {
  return system.stdout.writeLine(msg)
}
page.onResourceError = function(resErr) {
  if (!config.ignoreResourceErrors) {
    return system.stdout.writeLine("Error loading resource " + resErr.url + " (" + resErr.errorCode + "). Details: " + resErr.errorString)
  }
}
page.onError = function(msg, traces) {
  if (page.evaluate(function() { return !!window.onerror })) return

  fail(msg + '\n' + traces.reduce(function(stack, trace) {
    return stack + '\n  ' + (trace.function ? ' in ' + trace.function + '' : '')
            + ' at ' + trace.file + ':' + trace.line
  }, ''))
}
page.onInitialized = function() {
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
  }, system.env)
}

// Load the test page
page.open(url)
page.onCallback = function(data) {
  if (data) {
    if (data['Mocha.process.stdout.write']) {
      output.write(data['Mocha.process.stdout.write'])
    } else if (data['mochaPhantomJS.run']) {
      if (page.evaluate(function() { return !!window.mocha })) {
        page.injectJs('core_extensions.js')
        page.evaluate(function(columns) {
          return Mocha.reporters.Base.window.width = columns
        }, parseInt(system.env.COLUMNS || 75) * .75 | 0)

        waitForRunMocha()
      } else {
        fail("Failed to find mocha on the page.");
      }
    } else if (typeof data.screenshot === 'string') {
      page.render(data.screenshot + '.png')
    }
  }
  return true
}
page.onLoadFinished = function(status) {
  page.onLoadFinished = function() {}
  if (status !== 'success') {
    fail("Failed to load the page. Check the url: " + url)
  }
  return waitForInitMocha()
}

function checkStarted() {
  var started = page.evaluate(function() { return mochaPhantomJS.started })

  if (!started && mochaStartWait && startTime + mochaStartWait < Date.now()) {
    fail("Failed to start mocha: Init timeout", 255)
  }
  return started
}

function waitForRunMocha() {
  checkStarted() ? runMocha() : setTimeout(waitForRunMocha, 100)
}

function waitForInitMocha() {
  if (!checkStarted()) {
    setTimeout(waitForInitMocha, 100)
  }
}

function setupReporter(reporter) {
  try {
    mocha.setup({
      reporter: reporter || Mocha.reporters.Custom
    })
    return true
  } catch (error) {
    return error
  }
}

function runMocha() {
  // Configure mocha in the page
  page.evaluate(function(config) {
    mocha.useColors(config.useColors)
    mocha.bail(config.bail)
    if (config.grep) {
      mocha.grep(config.grep)
    }
    if (config.invert) {
      mocha.invert()
    }
  }, config)

  if (typeof config.hooks.beforeStart === 'function') {
    config.hooks.beforeStart(hookData) 
  }

  // setup a the reporter
  if (page.evaluate(setupReporter, reporter) !== true) {
    // we failed to set the reporter - likely a 3rd party reporter than needs to be wrapped
    var customReporter = fs.read(reporter),
    wrapper = function() {
      var exports, module, process, require;
      require = function(what) {
        what = what.replace(/[^a-zA-Z0-9]/g, '')
        for (var r in Mocha.reporters) {
          if (r.toLowerCase() === what) {
            return Mocha.reporters[r]
          }
        }
        throw new Error("Your custom reporter tried to require '" + what + "', but Mocha is not running in Node.js in mocha-phantomjs, so Node modules cannot be required - only other reporters");
      };
      module = {};
      exports = undefined;
      process = Mocha.process;
      'customreporter';
      return Mocha.reporters.Custom = exports || module.exports;
    },
    wrappedReporter = wrapper.toString().replace("'customreporter'", "(function() {" + (customReporter.toString()) + "})()");
    
    page.evaluate(wrappedReporter)
    if (page.evaluate(function() { return !Mocha.reporters.Custom }) ||
        page.evaluate(setupReporter) !== true) {
      fail("Failed to use load and use the custom reporter " + reporter)
    }
  }

  // Run mocha
  if (page.evaluate(function() {
    try {
      mochaPhantomJS.runner = mocha.run.apply(mocha, mochaPhantomJS.runArgs);
      if (mochaPhantomJS.runner) {
        var cleanup = function() {
          mochaPhantomJS.failures = mochaPhantomJS.runner.failures
          mochaPhantomJS.ended = true
        }
        if (mochaPhantomJS.runner && mochaPhantomJS.runner.stats && mochaPhantomJS.runner.stats.end) {
          cleanup()
        } else {
          mochaPhantomJS.runner.on('end', cleanup)
        }
      }
      return !!mochaPhantomJS.runner;
    } catch (error) {
      return false
    }
  })) {
    return waitForMocha()
  } else {
    return fail("Failed to start mocha.")
  }
}

function waitForMocha() {
  if (page.evaluate(function() { return mochaPhantomJS.ended })) {
    if (typeof config.hooks.afterEnd === 'function') {
      config.hooks.afterEnd(hookData)
    }
    if (config.file) {
      output.close()
    }
    return phantom.exit(page.evaluate(function() {
      return mochaPhantomJS.failures
    }))
  } else {
    return setTimeout(waitForMocha, 100)
  }
}