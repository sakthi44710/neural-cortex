/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  // Ensure CSS is always bundled properly
  experimental: {
    optimizeCss: false,
    serverComponentsExternalPackages: ['unpdf'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these — they need native Node.js resolution
      config.externals = config.externals || [];
      config.externals.push({
        'unpdf': 'commonjs unpdf',
        'canvas': 'commonjs canvas',
      });
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
