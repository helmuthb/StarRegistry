'use strict';

const appFactory = require('./appFactory.js');

// is the server terminating?
let terminating = false;

// initialize app (with defaults)
const app = appFactory();

const server = app.listen(
  8000,
  "localhost",
  () => console.log('Star Registry listening on port 8000'));

process.on("SIGINT", () => {
  if (!terminating) {
    terminating = true;
    console.log("Closing Blockchain DB");
    app.closeBlockchain().then(() => {
      console.log("Terminating server");
      server.close((() => {
        process.exit();
      }));
    });
  }
});