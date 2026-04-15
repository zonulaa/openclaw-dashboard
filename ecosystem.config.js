module.exports = {
  apps: [
    {
      name: 'zonula-control-v2',
      cwd: '/Users/user/.openclaw/workspace/zonula-control-v2',
      script: 'npm',
      args: 'run dev',
      env: {
        PORT: 3300
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/tmp/zonula-control-v2-error.log',
      out_file: '/tmp/zonula-control-v2-out.log'
    }
  ]
};
