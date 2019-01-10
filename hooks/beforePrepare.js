const webpack = require('webpack')
const webpackConfig = require('../webpack.config')
const fs = require('fs')
module.exports = function (context) {
  if (!fs.existsSync('www')) fs.mkdirSync('www')
  let prod = context.cmdLine.includes('--release')
  return new Promise((resolve, reject) => {
    webpack(webpackConfig({prod}), (err, stats) => {
      let log = stats.toString({colors: true})
      console.log(log);
      (err || stats.hasErrors()) ? reject(log) : resolve(log)
    })
  })
}
