// Configuration PM2 — Site Bourse (production)
module.exports = {
  apps: [
    {
      name: 'site-bourse-backend',
      script: './backend/src/server.js',
      cwd: '/var/www/site-bourse',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      out_file: '/var/log/site-bourse/out.log',
      error_file: '/var/log/site-bourse/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
