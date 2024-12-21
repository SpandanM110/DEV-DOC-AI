import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Cross-Origin policies
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          
          // Security headers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ];
  },

  // Performance and build optimizations
  productionBrowserSourceMaps: false,
  
  // Webpack configurations
  webpack: (config, { isServer }) => {
    // Additional webpack optimizations
    config.optimization.minimize = true;
    
    // Server-side specific optimizations
    if (isServer) {
      config.optimization.concatenateModules = true;
    }

    return config;
  },

  // Experimental features
  experimental: {
    optimizePackageImports: true,
    serverComponentsExternalPackages: ['@google/generative-ai'],
    optimisticClientCache: true,
  },

  // Logging and error reporting
  logging: {
    level: 'error'
  },

  // Runtime configurations
  runtime: 'nodejs',
};

export default nextConfig;