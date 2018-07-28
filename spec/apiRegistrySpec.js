'use strict';

const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const wif = require('wif');
const appFactory = require('../appFactory.js');
const rimraf = require('rimraf');
const fs = require('fs');
const supertest = require('supertest');
const async = require('async');

describe('API Registry Service', () => {
  const dummyDB = '/tmp/test-db-dummy-registry';
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

  const keyHash = bitcoin.crypto.sha256(Buffer.from('API registry test'));
  const keyPair = bitcoin.ECPair.fromPrivateKey(keyHash);
  const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
  let message;

  const stepSendRequest = (callback) => {
    supertest(app)
      .post('/requestValidation')
      .set('Content-Type', 'application/json')
      .send({address})
      .expect(response => {
        // store message
        message = response.body.message;
      })
      .end(callback);
  };

  const stepValidate = (callback) => {
    const privateKey = wif.decode(keyPair.toWIF()).privateKey;
    const signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed);
    supertest(app)
      .post('/message-signature/validate')
      .set('Content-Type', 'application/json')
      .send({address, signature})
      .end(callback);
  };

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

  beforeEach((done) => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
    // validate the address before each request
    async.series([
        stepSendRequest,
        stepValidate
    ], tellJasmine(done));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should fail for missing address', (done) => {
    supertest(app)
      .post('/block')
      .set('Content-Type', 'application/json')
      .send({
          star: { dec: 'some dec', ra: 'some ra', story: 'some story'}
      })
      .expect('Content-Type', /json/)
      .expect(response => {
          // switching to Jasmine expect
          expect(response.status).not.toBe(200, 'Missing address should fail');
      })
      .end(tellJasmine(done));
  });


  it('should fail for un-validated address', (done) => {
    supertest(app)
      .post('/block')
      .set('Content-Type', 'application/json')
      .send({
          address: 'unknown-address',
          star: { dec: 'some dec', ra: 'some ra', story: 'some story'}
      })
      .expect('Content-Type', /json/)
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).not.toBe(200, 'Unvalidated address should fail');
      })
      .end(tellJasmine(done));
  });

  const star = {
    dec: '-26° 29\' 24.9',
    ra: '16h 29m 1.0s',
    story: 'Found star using https://www.google.com/sky/'
  };
  let hash;
  let height;

  const stepRegister = callback => {
    supertest(app)
      .post('/block')
      .set('Content-Type', 'application/json')
      .send({address, star})
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).toBe(200, 'Validated address should succeed');
        // assign to variables
        hash = response.body.hash;
        height = response.body.height;
        expect(height).toBeGreaterThan(0, 'A height should be returned');
        expect(hash).toBeDefined('A hash should be returned');
      })
      .end(callback);
  };

  const compareStar = body => {
    // switching to Jasmine expect
    expect(body.address).toBe(address, 'Address should be the same');
    expect(body.star).toBeDefined('Response should have a star');
    expect(body.star.dec).toBe(star.dec, 'DEC value should be the same');
    expect(body.star.ra).toBe(star.ra, 'RA value should be the same');
    expect(body.star.storyDecoded).toBe(star.story);
  };

  const stepGetByHash = callback => {
    supertest(app)
      .get('/stars/hash:' + hash)
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).toBe(200, 'Result should be OK');
        expect(response.body.hash).toBe(hash, 'Hash should be the same');
        expect(response.body.height).toBe(height, 'Height should be the same');
        expect(response.body.body).toBeDefined('Response should have a body');
        compareStar(response.body.body);
      })
      .end(callback);
  };

  const stepGetByWrongHash = callback => {
    supertest(app)
      .get('/stars/hash:XXXXX')
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).not.toBe(200, 'Result should not be OK');
      })
      .end(callback);
  };

  const stepGetByHeight = callback => {
    supertest(app)
      .get('/block/' + height)
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).toBe(200, 'Result should be OK');
        expect(response.body.hash).toBe(hash, 'Hash should be the same');
        expect(response.body.height).toBe(height, 'Height should be the same');
        expect(response.body.body).toBeDefined('Response should have a body');
        compareStar(response.body.body);
      })
      .end(callback);
  };

  const stepGetByWrongHeight = callback => {
    supertest(app)
      .get('/block/1000')
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).not.toBe(200, 'Result should be not OK');
      })
      .end(callback);
  };

  const stepGetByAddress = callback => {
    supertest(app)
      .get('/stars/address:' + address)
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).toBe(200, 'Result should be OK');
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        let body = response.body[0];
        expect(body.hash).toBe(hash, 'Hash should be the same');
        expect(body.height).toBe(height, 'Height should be the same');
        expect(body.body).toBeDefined('Response should have a body');
        compareStar(body.body);
      })
      .end(callback);
  };

  const stepGetByWrongAddress = callback => {
    supertest(app)
      .get('/stars/address:not-existing')
      .expect(response => {
        // switching to Jasmine expect
        expect(response.status).toBe(200, 'Result should be OK');
        expect(response.body.length).toBe(0, 'Result should be empty');
      })
      .end(callback);
  };

  it ('should succeed for validated address', (done) => {
    async.series([
      stepRegister,
      stepGetByAddress,
      stepGetByHash,
      stepGetByHeight,
      stepGetByWrongAddress,
      stepGetByWrongHash,
      stepGetByWrongHeight
    ], tellJasmine(done));
  });
});
