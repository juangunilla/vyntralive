module.exports = {
  apps: [
    {
      name: 'live-backend',
      script: './backend/server.js',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
