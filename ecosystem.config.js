module.exports = {
  apps: [{
    name: 'slict-property',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DOMAIN: 'properties.slict.lk'
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001, // Use a different port for dev if needed
      DOMAIN: 'localhost'
    }
  }]
};
// To start in development: pm2 start ecosystem.config.js --env development
// To start in production: pm2 start ecosystem.config.js --env production