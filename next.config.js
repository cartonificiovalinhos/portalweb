const path = require('path');
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  distDir: '.next_build',
  output: 'standalone',
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
