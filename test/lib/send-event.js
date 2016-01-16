expect = (chai && chai.expect) || require('chai').expect;

describe('Send Event', function() {
  it('click on "Update target" button', function() {
    if (window.callPhantom) {
      callPhantom({'sendEvent': ['click', 5, 5]})
    }
    expect(window.document.getElementById('target').innerHTML).to.equal('button was clicked')
  });
});
