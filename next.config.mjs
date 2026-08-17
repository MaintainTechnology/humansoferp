/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Markup fidelity matters more than Next's <Image> pipeline here: the site's
  // own CSS targets Elementor's img classes, so we serve plain <img>.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // WordPress served the homepage at /home as well as /.
      { source: '/home', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
