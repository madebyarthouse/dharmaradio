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
        source: "/:path((?!coming-soon|sounds|js|api).*)",
        destination: "/coming-soon",
        permanent: false,
      },
    ];
  },
  // Plausible Analytics rewrite
  async rewrites() {
    return [
      {
        source: "/js/script.js",
        destination: "https://plausible.io/js/script.outbound-links.js",
      },
      {
        source: "/api/event", // Or '/api/event/' if you have `trailingSlash: true` in this config
        destination: "https://plausible.io/api/event",
      },
    ];
  },
};

module.exports = nextConfig
