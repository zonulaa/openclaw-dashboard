module.exports = {
  apps: [
    {
      name: 'openclaw-dashboard',
      script: 'npm',
      args: 'run dev',
      env: {
        PORT: 3000,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/openclaw-dashboard-error.log',
      out_file: './logs/openclaw-dashboard-out.log',
    },
  ],
};
