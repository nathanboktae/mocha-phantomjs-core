module.exports = {
  beforeStart: function(opts) {
    if (typeof opts.reporter !== 'string') {
      console.log('opts.reporter is not a string!')
    }
    else if (!opts.page || typeof opts.page.open !== 'function') {
      console.log('opts.page is not a webpage object!')
    }
    else if (!opts.config || !opts.config.hooks) {
      console.log('mocha-phantomjs-core configuration was not passed in')
    } else {
      console.log('Before start called correctly!')
    }
  }
}