try {
  config = require('dev-config');
}
catch (e) {
  module.exports = {
    reddit: {
      userAgent: process.env.userAgent,
      clientId: process.env.clientId,
      clientSecret: process.env.clientSecret,
      refreshToken: process.env.refreshToken
    },
    aws: {
      accessKeyId: process.env.accessKeyId,
      secretAccessKey: process.env.secretAccessKey,
      region: process.env.region
    }
  }
}
