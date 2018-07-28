describe('SimpleChain', () => {
  const { Block, Blockchain } = require('../simpleChain');

  beforeEach((done) => {
    // use a random leveldb-filename to avoid race conditions
    let filename = `test-${Math.random().toString(36).substring(7)}.levedb`;
    blockchain = new Blockchain(filename);
    // wait half a second for level-db being finished
    setTimeout((() => {
      let j = 1;
      // immediately-invoked named function
      (function loopBlocks(i) {
        setTimeout(() => {
          blockchain.addBlock(new Block(`test data ${j}`));
          if (i > 0) {
            loopBlocks(i-1);
          }
          else {
            // we are ready with the preparations
            done();
          }
        }, 100);
      })(10);
    }), 500);
  });

  afterEach((done) => {
    blockchain.remove().then(() => {
      done();
    });
  });

  it('should validate a correct Blockchain', (done) => {
    let rc = blockchain.validateChain();
    expect(rc).toBe(true);
    done();
  });

  it('should raise errors in manipulated chain', (done) => {
    const inducedErrorBlocks = [2, 4, 7];
    for (let i = 0; i < inducedErrorBlocks.length; i++) {
      let idx = inducedErrorBlocks[i];
      blockchain.chain[idx].body = 'induced chain error';
    }
    let rc = blockchain.validateChain();
    expect(rc).toBe(false);
    done();
  });
});
