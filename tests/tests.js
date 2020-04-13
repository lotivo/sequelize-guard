// Importing mocha and chai
const mocha = require('mocha')
const chai = require('chai')
var expect = chai.expect;
var assert = chai.assert;

var SequelizeAcl = require('../lib/index');

exports.Test = function(){
    describe('properly runs a test', () => {
        it('should pass', function(){
            expect(SequelizeAcl(2)).to.equal(4);
        })
    })
    
}
