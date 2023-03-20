/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // regex which matches everything except the string "coming-soon"
  async redirects() {
    return [
      {
        source: "/:path((?!coming-soon|sounds).*)",
        destination: "/coming-soon",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig
