require.config({
  baseUrl: '..',
  paths: {
    chai: 'node_modules/chai/chai',
    mocha: 'node_modules/mocha/mocha'
  }
})

define(['mocha', 'chai'], function(_, chai) {
  mocha.setup('bdd')
  mocha.reporter('html')
  window.chai = chai

  require(['test/lib/passing'], function() {
    mocha.run()
  })
})
