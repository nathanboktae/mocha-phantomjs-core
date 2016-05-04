expect = (chai && chai.expect) || require('chai').expect;

describe('Viewport Size Change', function() {
  it('changes viewport size', function() {
    if (window.callPhantom) {
    	console.log("Changing viewport size to : width 500, height 500")
    	callPhantom({'viewportSize': { width : 500, height : 500}})
      expect(window.innerWidth).to.equal(500);
      expect(window.innerHeight).to.equal(500);
    }
  });

  it('changes viewport size - only on width', function() {
  	if (window.callPhantom) {
	  	console.log("Changing viewport size to : width 1000")
		callPhantom({'viewportSize': { width : 1000}})
      expect(window.innerWidth).to.equal(1000)
  	}
  })

  it('chanves viewport size - only on height', function() {
  	if (window.callPhantom) {
	  	console.log("Changing viewport size to : height 1000")
	    callPhantom({'viewportSize': { height : 1000}})
      expect(window.innerHeight).to.equal(1000)
  	}
  })
});

