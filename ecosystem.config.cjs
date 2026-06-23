module.exports = {
  apps: [
    {
      name: "encore-dev",
      script: "npx",
      args: "next dev -p 3001",
      cwd: "/home/ubuntu/encore",
      env: {
        DATABASE_URL: "postgresql://encore:encore_dev@localhost:54322/encore",
        DIRECT_URL: "postgresql://encore:encore_dev@localhost:54322/encore",
        NODE_ENV: "development",
      },
    },
    {
      name: "encore-tunnel",
      script: "npx",
      args: "localtunnel --port 3001",
      cwd: "/home/ubuntu/encore",
    },
  ],
};
