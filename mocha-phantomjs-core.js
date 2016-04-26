var
  system = require('system'),
  webpage = require('webpage'),
  fs = require('fs'),
  stderr = system.stderr || system.stdout,
  configured = false,
  runStarted = false,
  isSlimer = 'MozApplicationEvent' in window,
  config = {},
  hookData


function parseCli(args) {
  // Implementation courtesy https://github.com/joaquimserafim/cli-args
  // Node package dependency is not taken due to `require.paths` headaches
  var key, obj = { _: [] }

  function convert(val) {
    if (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(val)) {
      return Number(val)
    } else if (/^(true|false)$/.test(val)) {
      return 'true' === val
    } else if (/null/.test(val)) {
      return null
    } else if (!/undefined/.test(val)) {
      return val
    }
  }

  for (var i = 0; i < args.length; i++) {
    if (/^-\w|^--\w*=\w*/.test(args[i])) {
      key = args[i].replace(/^--/, '').replace(/^-/, '')

      // let args be passed either `--app=80` style or `-p 80`
      if (/=/.test(key)) {
        var splArg = key.split('=')
        obj[splArg[0]] = convert(splArg[1])
        key = null
      }

      continue
    }

    if (key) {
      obj[key] = convert(args[i])
      key = null
    } else {
      if (/^--/.test(args[i])) {
        args[i] = args[i].replace('--', '')
      }

      obj._.push(convert(args[i]))
    }
  }
  return obj
}

var cliOpts = parseCli(system.args),
    url = cliOpts._[0],
    reporter = cliOpts.r || cliOpts.reporter || 'spec'

function tryParseOption(what, def) {
  var json = cliOpts[what] || cliOpts[what[0]]
  if (!json) return def

  try {
    return JSON.parse(json)
  }
  catch(e) {
    stderr.writeLine('Error parsing ' + what + ': ' + e.message)
    phantom.exit(253)
  }
}

if (!url || cliOpts.help || cliOpts['?']) {
  var executable = isSlimer ? 'mocha-slimerjs' : 'mocha-phantomjs'
[
'  Usage: ' + executable + ' [options] page\n',
'  Options:',
'    --help                      output usage information',
'    -V, --version                output the version number',
'    -R, --reporter <name>        specify the reporter to use',
'    -f, --file <filename>        specify the file to dump reporter output',
'    -t, --timeout <timeout>      specify the test startup timeout to use',
'    -g, --grep <pattern>         only run tests matching <pattern>',
'    -i, --invert                 invert --grep matches',
'    -b, --bail                   exit on the first test failure',
'    -A, --agent <userAgent>      specify the user agent to use',
'    -c, --cookies <Object>       phantomjs cookie object http://git.io/RmPxgA',
'    -h, --header <name>=<value>  specify custom header',
'    -k, --hooks <path>           path to hooks module',
'    -s, --setting <key>=<value>  specify specific phantom settings',
'    -v, --view <width>x<height>  specify phantom viewport size',
'    -C, --no-color               disable color escape codes',
'    --ignore-resource-errors     ignore resource errors',
'  Any other options are passed to phantomjs (see `phantomjs --help`)\n',
'  Examples:\n',
'    $ ' + executable + ' -R dot /test/file.html',
'    $ ' + executable + ' https://testserver.com/file.html --ignore-ssl-errors=true',
'    $ ' + executable + ' -g "Login tests" -b test/file.html'
].forEach(function(line) {
  system.stdout.writeLine(line)
})
  phantom.exit(255)
}

if (phantom.version.major < 1 || (phantom.version.major === 1 && phantom.version.minor < 9)) {
  stderr.writeLine('mocha-phantomjs requires PhantomJS > 1.9.1')
  phantom.exit(254)
}

// Create and configure the client page
var
  filename = cliOpts.f || cliOpts.file,
  ua = cliOpts.ua || cliOpts['user-agent'],
  output = filename ? fs.open(filename, 'w') : system.stdout,
  settings = tryParse('settings'),
  fail = function(msg, errno) {
    if (output && filename) {
      output.close()
    }
    if (msg) {
      stderr.writeLine(msg)
    }
    return phantom.exit(errno || 1)
  },
  hooks = cliOpts.k || cliOpts.hooks

if (settings && ua) {
  settings.userAgent = ua
}

var page = webpage.create({
  settings: settings
})

if (hooks) {
  hookData = {
    page: page,
    config: config,
    reporter: reporter
  }
  try {
    hooks = require(hooks)
  }
  catch (e) {
    stderr.writeLine('Error loading hooks: ' + e.message)
    phantom.exit(253)
  }
} else {
  hooks = {}
}

if (cliOpts.h || cliOpts.headers) {
  page.customHeaders = cliOpts.h || cliOpts.headers
}

tryParseOption('cookies', []).forEach(function(cookie) {
  page.addCookie(cookie)
})

if (cliOpts.v || cliOpts.view) {
  var viewport = (cliOpts.v || cliOpts.view).split('x')
  page.viewportSize = {
    width: Number(viewport[0]),
    height: Number(viewport[1])
  }
}

page.onConsoleMessage = function(msg) {
  return system.stdout.writeLine(msg)
}
page.onResourceError = function(resErr) {
  if (!cliOpts['ignore-resource-errors']) {
    return stderr.writeLine("Error loading resource " + resErr.url + " (" + resErr.errorCode + "). Details: " + resErr.errorString)
  }
}
page.onError = function(msg, traces) {
  if (page.evaluate(function() { return !!window.onerror })) return

  fail(msg + '\n' + traces.reduce(function(stack, trace) {
    return stack + '\n  ' + (trace.function ? ' in ' + trace.function + '' : '')
            + ' at ' + trace.file + ':' + trace.line
  }, ''))
}

// Load the test page
page.open(url)
page.onInitialized = function() {
  page.injectJs('browser-shim.js')

  if (isSlimer && ua) {
    page.evaluate(function(ua) {
      navigator.__defineGetter__('userAgent', function() { return ua })
    }, ua)
  }
}
page.onResourceReceived = function(resource) {
  if (resource.url.match(/mocha\.js$/)) {
    page.evaluate(function() {
      checkForMocha()
    })
  }
}
page.onCallback = function(data) {
  if (data) {
    if (data.stdout) {
      output.write(data.stdout)
    } else if (typeof data.screenshot === 'string') {
      page.render(data.screenshot + '.png')
    } else if (data.configureColWidth) {
      page.evaluate(function(columns) {
        Mocha.reporters.Base.window.width = columns
      }, parseInt(system.env.COLUMNS || 75) * .75 | 0)
    } else if (data.configureMocha) {
      configureMocha()
    } else if ('testRunStarted' in data) {
      if (data.testRunStarted == 0) {
        fail('mocha.run() was called with no tests')
      }
      runStarted = true
    } else if (data.testRunEnded) {
      if (typeof hooks.afterEnd === 'function') {
        hookData.runner = data.testRunEnded
        hooks.afterEnd(hookData)
      }
      if (file) {
        output.close()
      }
      setTimeout(function() {
        phantom.exit(data.testRunEnded.failures)
      }, 100)
    } else if (data.sendEvent) {
      page.sendEvent.apply(page, data.sendEvent)
    }
  }
  return true
}
page.onLoadFinished = function(status) {
  page.onLoadFinished = null
  if (status !== 'success') {
    fail('Failed to load the page. Check the url: ' + url)
    return
  }

  var loadTimeout = cliOpts['load-timeout'] || 10000
  setTimeout(function() {
    if (!configured) {
      if (page.evaluate(function() { return !window.mocha })) {
        fail('mocha was not found in the page within ' + loadTimeout + 'ms of the page loading.')
      } else if (page.evaluate(function() { return window.initMochaPhantomJS })) {
        fail('Likely due to external resource loading and timing, your tests require calling `window.initMochaPhantomJS()` before calling any mocha setup functions. See https://github.com/nathanboktae/mocha-phantomjs-core/issues/12')
      } else {
        fail('mocha was not initialized within ' + loadTimeout + 'ms of the page loading. Make sure to call `mocha.ui` or `mocha.setup`.')
      }
    } else if (!runStarted) {
      fail('mocha.run() was not called within ' + loadTimeout + 'ms of the page loading.')
    }
  }, loadTimeout)
}

function configureMocha() {
  page.evaluate(function(cliOpts, env) {
    mocha.env = env

    var noColors = cliOpts.C || cliOpts['no-color']
    mocha.useColors(!noColors)
    mocha.bail(cliOpts.b || cliOpts.bail)
    if (cliOpts.t || cliOpts.timeout) {
      mocha.timeout(cliOpts.t || cliOpts.timeout)
    }
    if (cliOpts.g || cliOpts.grep) {
      mocha.grep(cliOpts.g || cliOpts.grep)
    }
    if (cliOpts.i || cliOpts.invert) {
      mocha.invert()
    }
  }, cliOpts, system.env)

  // setup a the reporter
  if (page.evaluate(setupReporter, reporter) !== true) {
    // we failed to set the reporter - likely a 3rd party reporter than needs to be wrapped
    try {
      var customReporter = fs.read(reporter)
    } catch(e) {
      fail('Unable to open file \'' + reporter + '\'')
    }

    var wrapper = function() {
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
    wrappedReporter = wrapper.toString().replace("'customreporter'", "(function() {" + (customReporter.toString()) + "})()")

    page.evaluate(wrappedReporter)
    if (page.evaluate(function() { return !Mocha.reporters.Custom }) ||
        page.evaluate(setupReporter) !== true) {
      fail('Failed to use load and use the custom reporter ' + reporter)
    }
  }

  if (typeof hooks.beforeStart === 'function') {
    hooks.beforeStart(hookData)
  }
  configured = true
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