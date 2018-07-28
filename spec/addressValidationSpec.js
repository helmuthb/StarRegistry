const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const wif = require('wif');

describe('Validation', () => {
  const { Validation } = require('../addressValidation');

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should give a validation window of 300 seconds', () => {
    let validation = new Validation('dummy-address');
    expect(validation.validationWindow).toBe(300);
  });

  it ('should have a unique message per address', () => {
    let val1 = new Validation('dummy-address-1');
    let val2 = new Validation('dummy-address-2');
    expect(val1.message).not.toBe(val2.message);
  });

  it ('should have different messages after some time', () => {
    let val1 = new Validation('dummy-address');
    jasmine.clock().tick(2000);
    let val2 = new Validation('dummy-address');
    expect(val1.message).not.toBe(val2.message);
});

  it ('should be active when created', () => {
    let val = new Validation('dummy-address');
    expect(val.isActive()).toBe(true);
  });

  it ('should be active after some seconds', () => {
    let val = new Validation('dummy-address');
    jasmine.clock().tick(2000);
    expect(val.isActive()).toBe(true);
  });

  it ('should not be active after five minutes', () => {
    let val = new Validation('dummy-address');
    jasmine.clock().tick(301000);
    expect(val.isActive()).toBe(false);
  });

  it('should reduce the validation window after time', () => {
    let validation = new Validation('dummy-address');
    jasmine.clock().tick(2000);
    validation.update();
    expect(validation.validationWindow).toBeLessThan(300);
  });

  it ('should validate correct signatures', () => {
    const keyPair = bitcoin.ECPair.makeRandom();
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
    const privateKey = wif.decode(keyPair.toWIF()).privateKey;
    let validation = new Validation(address);
    const signature = bitcoinMessage.sign(validation.message, privateKey, keyPair.compressed);
    expect(validation.validateSignature(signature)).toBe(true);
  })

  it ('should not validate incorrect signatures', () => {
    const keyPair1 = bitcoin.ECPair.makeRandom();
    const { address1 } = bitcoin.payments.p2pkh({ pubkey: keyPair1.publicKey });
    let validation = new Validation(address1);
    const keyPair2 = bitcoin.ECPair.makeRandom();
    const privateKey2 = wif.decode(keyPair2.toWIF()).privateKey;
    const signature = bitcoinMessage.sign(validation.message, privateKey2, keyPair2.compressed);
    expect(validation.validateSignature(signature)).toBe(false);
  });
});
