// Paths shared by the end-to-end scripts. run-all.mjs serves SERVE at http://localhost:8090/.
const path = require("path");
const root = path.resolve(__dirname, "../..");
module.exports = {
  DIST: path.join(root, "dist"),
  SERVE: process.env.PE_SERVE || path.join(root, "tests/.serve"),
  OUT: process.env.PE_OUT || path.join(root, "tests/.out"),
  FIX: path.join(__dirname, "fixtures"),
};
