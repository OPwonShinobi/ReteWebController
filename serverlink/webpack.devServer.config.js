let original = require("./webpack.config");
let merge = require("lodash").merge;

module.exports.hmr = {
  devServer: {
    port: 9090,
    proxy: {
      "**": "http://localhost:8080"
    },
    hot: true
  },
  output: {
    publicPath: "http://localhost:9090" + original.output.publicPath
  }
};

module.exports = merge(original, module.exports.hmr);
