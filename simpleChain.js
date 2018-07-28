'use strict';

const SHA256 = require('crypto-js/sha256');
const level = require('level');
const rimraf = require('rimraf');

const filePath = './chaindb';

/**
 * Block Class
 * Class with a constructor for block
 */
class Block {
  constructor(data) {
    this.hash = '';
    this.height = 0;
    this.body = data;
    this.time = 0;
    this.previousBlockHash = '';
  }

  calculateHash() {
    const hash = SHA256(JSON.stringify(this)).toString();
    return hash;
  }

  validateHash() {
    const theHash = this.hash;
    this.hash = '';
    const validHash = this.calculateHash();
    this.hash = theHash;
    if (theHash === validHash) {
      return true;
    }

    console.log(`Block #${this.height} invalid hash:\n${theHash}<>${validHash}`);
    return false;
  }
}

/**
 * Blockchain Class
 * Class with a constructor for new blockchain
 */
class Blockchain {
  constructor(filename = filePath) {
    this.filename = filename;
    this.chain = undefined;
    this.db = undefined;
    let promise = new Promise((resolve, reject) => {
        level(filename, {}, (err, db) => {
          if (err) {
            reject(err);
          }
          else {
            resolve(db);
          }
        });
      }
    );
    promise.then(db => {
      // store DB into Blockchain object
      this.db = db;
      // load blockchain from LevelDB
      return new Promise((resolve, reject) => {
        // read all blocks into the variable "chain"
        let chain = [];
        this.db.createReadStream()
        .on('data', raw => {
          const key = parseInt(raw.key);
          const data = JSON.parse(raw.value);
          data.__proto__ = Block.prototype;
          chain[key] = data;
        })
        .on('error', err => console.log("Error when reading LevelDB: ", err))
        .on('close', () => console.log("Stream closed"))
        .on('end', () => resolve(chain));
      })
    }).then(chain => {
      this.chain = chain;
      if (chain.length < 1) {
        // add initial block to blockchain
        this.addBlock(new Block('First block in the chain - Genesis block'));
      }
    });
  }

  /**
   * Check if blockchain is ready
   */
  _isReady() {
    if (typeof this.chain === "undefined") {
      throw "Blockchain not ready, is still loading from LevelDB";
    }
    return true;
  }

  /**
   * Add a block to the chain and persist it to LevelDB.
   * @param {Block} aBlock the new block to be added to the chain
   */
  addBlock(aBlock) {
    // throw error if not ready
    this._isReady();
    // clone it (we don't want side-effects)
    const newBlock = new Block(aBlock.body);
    // Block height
    newBlock.height = this.chain.length;
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0,-3);
    // previous block hash
    if(this.chain.length>0) {
      newBlock.previousBlockHash = this.chain[this.chain.length-1].hash;
    }
    // Using "calculateHash" member function
    newBlock.hash = newBlock.calculateHash();
    // Adding block object to chain
    this.chain.push(newBlock);
    // and persist to LevelDB
    this.db.put(
      newBlock.height,
      JSON.stringify(newBlock),
      function(err) {
        if (err) {
          console.log('Block ' + key + ' submission failed', err);
          throw err;
        }
      }
    );
  }
  
  /**
   * Get Block Height
   */
  getBlockHeight() {
    if (this._isReady()) {
      return this.chain.length - 1;
    }
  }

  /**
   * Get a block of specified height.
   * It will throw an exception if the data is not yet loaded from LevelDB.
   * @param {Integer} blockHeight the height of the block to be returned
   * @returns a generic object (not of class "Block")
   */
  getBlock(blockHeight) {
    if (this._isReady()) {
      // return object as a single string
      return JSON.parse(JSON.stringify(this.chain[blockHeight]));
    }
  }
  /**
   * Validate a specific block.
   * @param {Integer} blockHeight the height of the block to be validated
   */
  validateBlock(blockHeight){
    // throw an exception if the data is not yet loaded
    this._isReady();
    // get block object
    let block = this.chain[blockHeight];
    return block.validateHash();
  }

  // Validate blockchain
  validateChain(){
    // throw an exception if the data is not yet loaded
    this._isReady();
    let errorLog = [];
    for (var i = 0; i < this.chain.length; i++) {
      // validate block
      if (!this.validateBlock(i)) errorLog.push(i);
      // compare blocks hash link - only till the last-but-one
      if (i < this.chain.length - 1) {
        let blockHash = this.chain[i].hash;
        let previousHash = this.chain[i+1].previousBlockHash;
        if (blockHash!==previousHash) {
          errorLog.push(i);
        }
      }
    }
    if (errorLog.length>0) {
      console.log('Block errors = ' + errorLog.length);
      console.log('Blocks: '+errorLog);
    } else {
      console.log('No errors detected');
    }
    return errorLog.length == 0;
  }

  /**
   * Close the LevelDB object.
   * @returns a promise which resolves once it is closed.
   */
  close() {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  /**
   * Delete the LevelDB file.
   * It will also close the DB.
   * @returns a promise which resolves once it is deleted.
   */
  remove() {
    return this.close().then(() => {
      return new Promise((resolve, reject) => {
        rimraf(this.filename, err => {
          if (err) {
            console.log("Could not delete LevelDB file", err);
            reject("Could not delete LevelDB file");
          }
          else {
            resolve(true);
          }
        });
      });
    });
  }
}

module.exports = {
  Block, Blockchain
};
