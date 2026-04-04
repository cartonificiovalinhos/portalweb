const path = require('path');
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  cleanDistDir: false,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
