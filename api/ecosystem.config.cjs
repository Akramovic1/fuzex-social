/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: 'fuzex-api',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
