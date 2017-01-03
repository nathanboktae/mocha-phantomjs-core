describe('Viewport Size Change', function() {
  it('changes viewport size', function() {
    callPhantom({
      viewportSize: {
        width: 500,
        height: 500
      }
    })
    expect(window.innerWidth).to.equal(500)
    expect(window.innerHeight).to.equal(500)
  })

  it('changes viewport size - only on width', function() {
    callPhantom({
      viewportSize: { width: 1000 }
    })
    expect(window.innerWidth).to.equal(1000)
  })

  it('chanves viewport size - only on height', function() {
    callPhantom({
      viewportSize: { height: 1000 }
    })
    expect(window.innerHeight).to.equal(1000)
  })
})

