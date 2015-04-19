describe 'mocha-phantomjs-core', ->

  chai = require 'chai'
  expect = chai.expect
  should = chai.should()
  spawn = require('child_process').spawn
  url = require('url')
  fs = require('fs')
  Promise = require('bluebird')

  fileURL = (file) ->
    fullPath = fs.realpathSync "#{process.cwd()}/test/#{file}.html"
    fullPath = fullPath.replace /\\/g, '\/'
    urlString = fullPath
    urlString = url.format { protocol: 'file', hostname: '', pathname: fullPath } if process.platform isnt 'win32'

  run = (opts) ->
    opts = opts or {}
    new Promise (resolve, reject) ->          
      stdout = ''
      stderr = ''
      spawnArgs = [
        "#{process.cwd()}/mocha-phantomjs-core.js",
        opts.url or fileURL(opts.test or 'passing'),
        opts.reporter or 'spec',
        JSON.stringify(opts)
      ]
      mochaPhantomJS = spawn "#{process.cwd()}/phantomjs", spawnArgs
      mochaPhantomJS.stdout.on 'data', (data) -> stdout = stdout.concat data.toString()
      mochaPhantomJS.stderr.on 'data', (data) -> stderr = stderr.concat data.toString()
      mochaPhantomJS.on 'exit', (code) ->
        resolve { code, stdout, stderr }
      mochaPhantomJS.on 'error', (err) -> reject err


  xit 'returns a failure code and shows usage when no args are given', ->
    run done, [], (code, stdout, stderr) ->
      code.should.equal 1
      stdout.should.match /Usage: mocha-phantomjs/

  it 'returns a failure code and notifies of bad url when given one', ->
    @timeout = 4000
    { code, stdout } = yield run { url: 'foo/bar.html' }
    code.should.equal 1
    stdout.should.match /failed to load the page/i
    stdout.should.match /check the url/i
    stdout.should.match /foo\/bar.html/i

  it 'returns a failure code and notifies of no such runner class', ->
    { code, stdout } = yield run { reporter: 'nonesuch' }
    code.should.equal 1
    stdout.should.match /Unable to open file 'nonesuch'/

  it 'returns a success code when a directory exists with the same name as a built-in runner', ->
    fs.mkdir 'spec'
    { code } = yield run()
    fs.rmdir 'spec'
    code.should.equal 0

  it 'returns a failure code when mocha can not be found on the page', ->
    { code, stdout } = yield run { test: 'blank' }
    code.should.equal 1
    stdout.should.match /Failed to find mocha on the page/

  it 'returns a failure code when mocha fails to start for any reason', ->
    { code, stdout } = yield run { test: 'bad' }
    code.should.equal 1
    stdout.should.match /Failed to start mocha./

  it 'returns a failure code when mocha is not started in a timely manner', ->
    { code, stdout } = yield run { test: 'timeout', timeout: 500 }
    code.should.equal 255
    stdout.should.match /Failed to start mocha: Init timeout/

  it 'returns a failure code when there is a page error', ->
    { code, stdout } = yield run { test: 'error' }
    code.should.equal 1
    stdout.should.match /ReferenceError/

  it 'does not fail when an iframe is used', ->
    { code, stdout, stderr } = yield run { test: 'iframe' }
    stdout.should.not.match /Failed to load the page\./m
    stderr.should.be.empty
    code.should.equal 0

  it 'returns the mocha runner from run() and allows modification of it', ->
    { code, stdout } = yield run { test: 'mocha-runner' }
    stdout.should.not.match /Failed via an Event/m
    code.should.equal 1

  it 'passes the arguments along to mocha.run', ->
    { stdout } = yield run { test: 'mocha-runner' }
    stdout.should.match /Run callback fired/m

  passRegExp   = (n) -> ///\u001b\[32m\s\s[✔✓]\u001b\[0m\u001b\[90m\spasses\s#{n}///
  skipRegExp   = (n) -> ///\u001b\[36m\s\s-\sskips\s#{n}\u001b\[0m///
  failRegExp   = (n) -> ///\u001b\[31m\s\s#{n}\)\sfails\s#{n}\u001b\[0m///
  passComplete = (n) -> ///\u001b\[0m\n\n\n\u001b\[92m\s\s[✔✓]\u001b\[0m\u001b\[32m\s#{n}\stests\scomplete///
  pendComplete = (n) -> ///\u001b\[36m\s+•\u001b\[0m\u001b\[36m\s#{n}\stests\spending///
  failComplete = (x,y) -> ///\u001b\[31m\s\s#{x}\sfailing\u001b\[0m///

  describe 'spec', ->
    describe 'passing', ->
      before ->
        { @code, @stdout } = yield run { test: 'passing' }

      it 'returns a passing code', ->
        @code.should.equal 0

      it 'writes all output in color', ->
        @stdout.should.match /Tests Passing/
        @stdout.should.match passRegExp(1)
        @stdout.should.match passRegExp(2)
        @stdout.should.match passRegExp(3)
        @stdout.should.match skipRegExp(1)
        @stdout.should.match skipRegExp(2)
        @stdout.should.match skipRegExp(3)

    describe 'failing', ->
      before ->
        { @code, @stdout } = yield run { test: 'failing' }

      it 'returns a failing code equal to the number of mocha failures', ->
        @code.should.equal 3

      it 'writes all output in color', ->
        @stdout.should.match /Tests Failing/
        @stdout.should.match passRegExp(1)
        @stdout.should.match passRegExp(2)
        @stdout.should.match passRegExp(3)
        @stdout.should.match failRegExp(1)
        @stdout.should.match failRegExp(2)
        @stdout.should.match failRegExp(3)
        @stdout.should.match failComplete(3,6)

    describe 'failing async', ->
      before ->
        { @code, @stdout } = yield run { test: 'failing-async' }

      it 'returns a failing code equal to the number of mocha failures', ->
        @code.should.equal 3

      it 'writes all output in color', ->
        @stdout.should.match /Tests Failing/
        @stdout.should.match passRegExp(1)
        @stdout.should.match passRegExp(2)
        @stdout.should.match passRegExp(3)
        @stdout.should.match failRegExp(1)
        @stdout.should.match failRegExp(2)
        @stdout.should.match failRegExp(3)
        @stdout.should.match failComplete(3,6)

    describe 'screenshot', ->
      it 'takes a screenshot into given file, suffixed with .png', ->
        { code } = yield run { test: 'screenshot' }
        code.should.equal 0
        fileName = 'screenshot.png'
        fs.existsSync(fileName).should.be.true
        fs.unlinkSync(fileName)

  describe 'dot', ->
    it 'uses dot reporter', ->
      { stdout } = yield run
        reporter: 'dot'
        test: 'mixed'
      
      stdout.should.match /\u001b\[90m\․\u001b\[0m/ # grey
      stdout.should.match /\u001b\[36m\․\u001b\[0m/ # cyan
      stdout.should.match /\u001b\[31m\․\u001b\[0m/ # red

    before ->
      @args = ['-R', 'dot', fileURL('many')]

    it 'wraps lines correctly and has only one double space for the last dot', ->
      { stdout } = yield run
        reporter: 'dot'
        test: 'many'

      matches = stdout.match /\d\dm\․\u001b\[0m(\r\n\r\n|\n\n)/g
      matches.length.should.equal 1

  describe 'xunit', ->
    it 'basically works', ->
      { stdout } = yield run
        reporter: 'xunit'
        test: 'mixed'
      
      stdout.should.match /<testcase classname="Tests Mixed" name="passes 1" time=".*"\/>/

  describe 'third party', ->
    it 'loads and wraps node-style reporters to run in the browser', ->
      { stdout } = yield run
        reporter: process.cwd() + '/test/reporters/3rd-party.js'
        test: 'mixed'

      stdout.should.match /<section class="suite">/
      stdout.should.match /<h1>Tests Mixed<\/h1>/

    it 'can be referenced relatively', ->
      { stdout } = yield run
        reporter: './test/reporters/3rd-party.js'
        test: 'mixed'

      stdout.should.match /<section class="suite">/
      stdout.should.match /<h1>Tests Mixed<\/h1>/

    it 'gives a useful error when trying to require a node module', ->
      { code, stdout } = yield run
        reporter: process.cwd() + '/test/reporters/node-only.js'
        test: 'mixed'

      stdout.should.match /Node modules cannot be required/
      code.should.not.equal 0      

  describe 'hooks', ->
    xit 'should fail gracefully if they do not exist', ->
      { code } = yield run
        hooks: 'nonexistant-file.js'

      code.should.not.equal 0
    
    describe 'before start', ->
      it 'is called', ->
        { code, stdout } = yield run
          hooks: process.cwd() + '/test/hooks/before-start.js'

        stdout.should.contain 'Before start called!'
        code.should.equal 0

    describe 'after end', ->
      it 'is called', ->
        { code, stdout } = yield run
          hooks: process.cwd() + '/test/hooks/after-end.js'
        
        stdout.should.contain 'After end called!'
        code.should.equal 0


  describe 'config', ->
    describe 'user-agent', ->
      it 'has the default user agent', ->
        { stdout } = yield run { test: 'user-agent' }
        stdout.should.match /PhantomJS\//

      it 'has a custom user agent via settings', ->
        { stdout } = yield run
          test: 'user-agent'
          settings: 
            userAgent: 'mocha=UserAgent'

        stdout.should.match /^mocha=UserAgent/

    describe 'cookies', ->
      it 'has passed cookies', ->
        { stdout } = yield run
          test: 'cookie'
          cookies: [
            { name: 'foo', value: 'bar' },
            { name: 'baz', value: 'bat', path: '/' }
          ]

        stdout.should.match /foo=bar; baz=bat/

    describe 'viewport', ->
      it 'has the specified dimensions', ->
        { stdout } = yield run
          test: 'viewport'
          viewportSize: 
            width: 123
            height: 456

        stdout.should.match /123x456/

    describe 'grep', ->
      it 'filters tests to match the criteria', ->
        { code, stdout } = yield run
          test: 'mixed'
          grep: 'pass'

        code.should.equal 0
        stdout.should.not.match /fail/

      it 'can be inverted to filter out tests matching the criteria', ->
        { code, stdout } = yield run
          test: 'mixed'
          grep: 'pass'
          invert: true

        code.should.equal 6
        stdout.should.not.match /passes/

    describe 'no-colors', ->
      it 'suppresses color output', ->
        { stdout } = yield run
          test: 'mixed'
          useColors: false

        stdout.should.not.match /\u001b\[\d\dm/

    describe 'bail', ->
      it 'should bail on the first error', ->
        { stdout } = yield run
          test: 'mixed'
          bail: true

        stdout.should.match failRegExp 1

    describe 'file', ->
      it 'pipes reporter output to a file', ->
        { stdout } = yield run
          test: 'file'
          reporter: 'json'
          file: 'reporteroutput.json'

        stdout.should.contain 'Extraneous'
        results = JSON.parse fs.readFileSync 'reporteroutput.json', { encoding: 'utf8' }
        results.passes.length.should.equal 6
        results.failures.length.should.equal 6

      after ->
        fs.unlinkSync 'reporteroutput.json'

    describe 'ignore resource errors', ->
      it 'by default shows resource errors', ->
        { code, stdout } = yield run { test: 'resource-errors' }
        stdout.should.contain('Error loading resource').and.contain('nonexistant-file.css')
        code.should.equal 0

      it 'can suppress resource errors', ->
        { stdout } = yield run { test: 'resource-errors', ignoreResourceErrors: true }
        stdout.should.not.contain('Error loading resource')

  describe 'env', ->
    it 'has passed environment variables', ->
      process.env.FOO = 'yowzer'
      { stdout, stderr } = yield run { test: 'env' }
      stdout.should.match /^yowzer/
