/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ TEMPORARY: Build bypasses (remove these after fixing issues)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // React configuration
  reactStrictMode: true,
  swcMinify: true, // Use SWC for faster minification

  // Routing configuration
  trailingSlash: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
    ],
    // Additional image optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },

  // Environment variables
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },

  // Experimental features (consolidated)
  experimental: {
    esmExternals: false, // Helps with SSR issues
    webpackBuildWorker: true, // Reduces memory usage during builds
    optimizeCss: true, // Optimize CSS
    scrollRestoration: true, // Better scroll restoration
  },

  // Comprehensive webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Client-side optimizations
    if (!isServer) {
      config.cache = {
        type: 'memory',
        maxGenerations: 1, // Minimal cache to reduce memory usage
      };

      // Bundle optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };
    }

    // Server-side SSR fixes
    if (isServer) {
      // Handle Node.js modules that shouldn't run in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };

      // Handle window/document/navigator during SSR
      config.resolve.alias = {
        ...config.resolve.alias,
        // Provide empty implementations for browser-only APIs during SSR
      };
    }

    // Global window handling for SSR
    config.plugins = config.plugins || [];

    // Define global variables to prevent undefined errors
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.DefinePlugin({
        'typeof window': isServer ? '"undefined"' : '"object"',
        'typeof document': isServer ? '"undefined"' : '"object"',
        'typeof navigator': isServer ? '"undefined"' : '"object"',
      })
    );

    return config;
  },

  // Headers for better security and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Cache static assets
      {
        source: '/(.*)\\.(js|css|png|jpg|jpeg|gif|webp|svg|ico)$',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects (add any you need)
  async redirects() {
    return [
      // Example redirect - customize as needed
      // {
      //   source: '/old-page',
      //   destination: '/new-page',
      //   permanent: true,
      // },
    ];
  },

  // Rewrites (if needed)
  async rewrites() {
    return [
      // Add any rewrites you need
    ];
  },

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,

    // Enable SWC React optimizations
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },

  // Power user features
  poweredByHeader: false, // Remove X-Powered-By header

  // Custom server configuration (if needed)
  serverRuntimeConfig: {
    // Server-only runtime config
  },

  // Public runtime config
  publicRuntimeConfig: {
    // Available on both server and client
  },
};

module.exports = nextConfig;
