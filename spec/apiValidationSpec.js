'use strict';

const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const wif = require('wif');
const appFactory = require('../appFactory.js');
const rimraf = require('rimraf');
const fs = require('fs');
const supertest = require('supertest');
const async = require('async');

describe('API Validation Service', () => {
  const dummyDB = '/tmp/test-db-dummy-validation';
  let app = undefined;

  beforeAll((done) => {
    const dbRemove = new Promise((resolve, reject) => {
      fs.stat(dummyDB, (err, stat) => {
        if (err == null) {
          rimraf(dummyDB, () => {
            resolve();
          })
        }
        else {
          resolve();
        }
      });
    });
    dbRemove.then(() => {
      // create app object
      app = appFactory(dummyDB);
      done();
    });
  });

  afterAll((done) => {
    // stop the server mock
    app.closeBlockchain().then(() => {
      rimraf(dummyDB, () => {
        done();
      });
    });
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  const tellJasmine = (done) => {
    return (err) => {
      if (err) {
        done.fail(err);
      }
      else {
        done();
      }
    };
  };

  it('should detect missing address in a validation request', (done) => {
    supertest(app)
      .post('/requestValidation')
      .set('Content-Type', 'application/json')
      .expect('Content-Type', /json/)
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).not.toBe(200);
      })
      .end(tellJasmine(done));
  });

  const keyHash = bitcoin.crypto.sha256(Buffer.from('API validation test'));
  const keyPair = bitcoin.ECPair.fromPrivateKey(keyHash);
  const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
  let message;

  const stepSendRequest = (callback) => {
    supertest(app)
      .post('/requestValidation')
      .set('Content-Type', 'application/json')
      .send({address})
      .expect(response => {
        // switching to Jasmine expect
        expect(response.body.message).toBeDefined('Request validation should have a message');
        // store message
        message = response.body.message;
      })
      .end(callback);
  };

  const stepValidate = (callback) => {
    const privateKey = wif.decode(keyPair.toWIF()).privateKey;
    const signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    // wait 2 seconds
    jasmine.clock().tick(2000);
    supertest(app)
      .post('/message-signature/validate')
      .set('Content-Type', 'application/json')
      .send({address, signature})
      .expect(response => {
        // switching to Jasmine expect
        expect(response.body.registerStar).toBe(true, 'Validation should succeed');
        expect(response.body.status).toBeDefined('A status should be part of the response');
        expect(response.body.status.messageSignature).toBe('valid', 'Signature should be verified');
        expect(response.body.status.validationWindow).not.toBe(300, 'Validation window should have decreased');
      })
      .end(callback);
  };

  const stepValidateWrong = (callback) => {
    // wait 2 seconds
    jasmine.clock().tick(2000);
    supertest(app)
      .post('/message-signature/validate')
      .set('Content-Type', 'application/json')
      .send({address, signature: 'a wrong signature'})
      .expect(response => {
        // switching to Jasmine expect
        expect(response.body.registerStar).toBe(false, 'Validation should fail');
        expect(response.body.status).toBeDefined('A status should be part of the response');
        expect(response.body.status.messageSignature).toBe('invalid', 'False signature should be detected');
        expect(response.body.status.validationWindow).not.toBe(300, 'Validation window should have decreased');
      })
      .end(callback);
  };

  it('should correctly validate', (done) => {
    async.series([
      stepSendRequest,
      stepValidateWrong,
      stepValidate
    ], tellJasmine(done));
  });
});
