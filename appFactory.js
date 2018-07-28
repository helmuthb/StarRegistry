'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const { Blockchain } = require('./simpleChain.js');
const { ValidationList } = require('./addressValidation.js');

function createApp(db) {
  const app = express();
  // create blockchain (or load from DB)
  const blockchain = new Blockchain(db);
  // create empty validation request list
  const validationRequests = new ValidationList();
  // list of validated addresses
  const validatedAddresses = [];

  app.use(bodyParser.json());

  // Endpoint: Request Validation
  // POST /requestValidation
  app.post('/requestValidation', (req, res) => {
    const data = req.body;
    if (!data.address) {
      res.status(400).send({
        error: 'No address specified'
      });
      return;
    }
    let v = validationRequests.getValidation(data.address);
    res.send(v);
  });

  // Endpoint: Validate address
  // POST /message-signature/validate
  app.post('/message-signature/validate', (req, res) => {
    const data = req.body;
    if (!data.address) {
      res.status(400).send({
        error: 'Missing address in validation'
      });
      return;
    }
    if (!data.signature) {
      res.status(400).send({
        error: 'Missing signature in validation'
      });
    }
    let v = validationRequests.findValidation(data.address);
    if (!v) {
      res.status(400).send({
        error: 'No active validation request found'
      });
      return;
    }
    if (!v.validateSignature(data.signature)) {
      // failure
      res.send({
        registerStar: false,
        status: {
          address: v.address,
          requestTimeStamp: v.requestTimeStamp,
          message: v.message,
          validationWindow: v.validationWindow,
          messageSignature: 'invalid'
        }
      });
      return;
    }
    // Success!
    console.log('Address', data.address);
    console.log('Address', v.address);
    validatedAddresses.push(v.address);
    console.log('List', validatedAddresses);
    res.send({
      registerStar: true,
      status: {
        address: v.address,
        requestTimeStamp: v.requestTimeStamp,
        message: v.message,
        validationWindow: v.validationWindow,
        messageSignature: 'valid'
      }
    });
  });

  // Helper function: get star block output
  let starBlockOutput = (block) => {
    // make a deep copy
    let result = JSON.parse(JSON.stringify(block));
    if (block.body && block.body.star && block.body.star.story) {
      // Add the decoded string to the result
      let storyBuffer = Buffer.from(block.body.star.story, 'hex');
      result.body.star.storyDecoded = storyBuffer.toString('ascii');
    }
    return result;
  }

  // Endpoint: get block by height
  // GET /block/{height}
  app.get('/block/:height', (req, res) => {
    try {
      const height = parseInt(req.params.height);
      const block = blockchain.getBlock(height);
      let output = starBlockOutput(block);
      res.send(output);
    }
    catch (exp) {
      res.status(500).send({ 
        error: 'Could not load block',
        exception: JSON.stringify(exp)
      });
    }
  });

  // Endpoint: get block(s) by address
  // GET /stars/address:{address}
  app.get('/stars/address\\::address', (req, res) => {
    try {
      let blocks = [];
      // loop through all blocks (after genesis)
      for (let i=1; i<=blockchain.getBlockHeight(); i++) {
        let block = blockchain.getBlock(i);
        if (block && block.body && block.body.address) {
          if (block.body.address === req.params.address) {
            blocks.push(starBlockOutput(block));
          }
        }
      }
      res.send(blocks);
    }
    catch (exp) {
      res.status(500).send({
        error: 'Could not load blocks',
        exception: JSON.stringify(exp)
      });
    }
  });

  // Endpoint: get block by hash
  // GET /stars/hash:{hash}
  app.get('/stars/hash\\::hash', (req, res) => {
    try {
      // loop through all blocks (after genesis)
      for (let i=1; i<=blockchain.getBlockHeight(); i++) {
        let block = blockchain.getBlock(i);
        if (block.hash === req.params.hash) {
          let output = starBlockOutput(block);
          res.send(output);
          return;
        }
      }
      res.status(404).send({
        error: 'No block with this hash found'
      });
    }
    catch (exp) {
      res.status(500).send({
        error: 'Could not load blocks',
        exception: JSON.stringify(exp)
      });
    }
  });

  // Endpoint: add a star
  // POST /block
  app.post('/block', (req, res) => {
    try {
      let {address, star} = req.body;
      if (!address) {
        res.status(400).send({
          error: 'No wallet address specified'
        });
        return;
      }
      // is the address validated?
      let addressIndex = validatedAddresses.indexOf(address);
      if (addressIndex == -1) {
        res.status(400).send({
          error: 'Wallet address is not validated yet'
        });
        return;
      }
      // is the star fully specified?
      if (!star || !star.dec || !star.ra) {
        res.status(400).send({
          error: 'Star attributes not fully specified - star, star.dec and star.ra are needed'
        });
        return;
      }
      // let's get exactly the right star attributes
      let theStar = {
        dec: star.dec,
        ra: star.ra
      };
      if (star.story) {
        let storyBuffer = Buffer.from(star.story, 'ascii');
        theStar.story = storyBuffer.toString('hex');
      }
      // compose the block
      let block = {
        body: {
          address: address,
          star: theStar
        }
      }
      // add the block to the chain
      blockchain.addBlock(block);
      // remove address from list of validated addresses
      validatedAddresses.splice(addressIndex, 1);
      // get the newly added block
      let newBlock = blockchain.getBlock(blockchain.getBlockHeight());
      // and return it (do not decode string in this case)
      res.send(newBlock);
    }
    catch (exp) {
      console.log(exp);
      res.status(500).send({ 
        error: 'Could not save block',
        exception: JSON.stringify(exp)
      });
    }
  });

  // add a function to close blockchain
  app.closeBlockchain = () => {
    return blockchain.close();
  }
  return app;
}

module.exports = createApp;