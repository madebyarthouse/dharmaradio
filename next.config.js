/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
