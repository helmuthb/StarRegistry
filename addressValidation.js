'use strict';

const bitcoinMessage = require('bitcoinjs-message');

const defaultWindow = 300;
const messageSuffix = "starRegistry";
const cleanupInterval = 60*1000;

/**
 * Get the current time as a timestamp in seconds.
 */
const now = () => {
  return Math.round(Date.now() / 1000);
}

/**
 * Validation class
 * Class for a pending validation request
 * @param {String} address the bitcoin address to be validated
 */
class Validation {
  constructor(address) {
    this.address = address;
    this.requestTimeStamp = now();
    this.message = this._message();
    this.validationWindow = defaultWindow;
  }

  /**
   *  Get request message
   */
  _message() {
    return this.address + ":" + this.requestTimeStamp +
           ":" + messageSuffix;
  }

  /**
   * Get remaining validation window
   */
  remainingWindow() {
    return (this.requestTimeStamp + this.validationWindow) - now();
  }

  /**
   * Update validation request
   */
  update() {
    this.validationWindow = this.remainingWindow();
    this.requestTimeStamp = now();
    this.message = this._message();
  }

  /**
   * Check whether the pending validation is still available or already expired.
   * @returns true if still active, false if expired
   */
  isActive() {
    return this.remainingWindow() >= 0;
  }

  /**
   * Validate a signature against the message and the address of the
   * pending validation.
   * @param {String} signature 
   * @returns true if the signature is correct, false otherwise
   */
  validateSignature(signature) {
    try {
      return this.isActive() &&
            bitcoinMessage.verify(this.message, this.address, signature);
    }
    catch (exc) {
      return false;
    }
  }
}

/**
 * ValidationList Class
 * Representing the list of currently pending validation requests.
 */
class ValidationList {
  constructor() {
    this.list = [];
    // register periodic cleanup
    this._cleanup();
  }

  /**
   * Clean the list of expired validation requests
   */
  _cleanup() {
    for (let i=this.list.length-1; i>=0; i--) {
      if (!this.list[i].isActive()) {
        // delete element from array
        this.list.splice(i, 1);
      }
    }
    let self = this;
    // call the cleanup again after some time
    setTimeout(function() {self._cleanup();}, cleanupInterval);
  }

  /**
   * Find a validation record for an address
   * @param {String} address Bitcoin-style address
   * @returns the validation record (or undefined if not found)
   */
  findValidation(address) {
    for (let i=0; i<this.list.length; i++) {
      let request = this.list[i];
      if (request.address === address && request.isActive()) {
        return request;
      }
    }
    // nothing found -> return undefined
    return undefined;
  }

  /**
   * Get a validation request for an address
   * @param {String} address Bitcoin-style address
   * @returns the validation record
   */
  getValidation(address) {
    let request = this.findValidation(address);
    if (request) {
      // update request
      request.update();
    }
    else {
      // Create new validation
      request = new Validation(address);
      this.list.push(request);
    }
    return request;
  }
}

module.exports = {
  Validation, ValidationList
};
