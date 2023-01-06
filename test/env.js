const { Blob } = require('buffer');
const Environment = require('jest-environment-node').default;

module.exports = class CustomTestEnvironment extends Environment {
  async setup() {
    await super.setup();
    this.global.Blob ||= Blob;
  }
};
