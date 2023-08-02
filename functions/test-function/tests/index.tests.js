const app = require('../index.js');
const { expect } = require('chai');

describe('Test Function', () => {
  describe('handler', () => {
    it('Success', async () => {
      const response = await app.handler({});
      expect(response).to.be.equal('hello world');
    });
  });
});