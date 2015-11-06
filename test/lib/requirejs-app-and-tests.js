/* global require, describe, it, mocha */

mocha.setup('bdd');
mocha.reporter('html');

require.config({
    baseUrl: "..",
    paths: {
        "chai": "node_modules/chai/chai",
    }
});

define(['chai'], function (chai) {

    describe('1 + 1', function () {
        it('should be 1', function () {
            chai.assert.equal(1 + 1, 1);
        });
        it('should be 2', function () {
            chai.assert.equal(1 + 1, 2);
        });
        it('should be 3', function () {
            chai.assert.equal(1 + 1, 3);
        });
    });

    mocha.run();
});
