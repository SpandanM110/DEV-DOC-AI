import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  
  // Corrected experimental configuration
  experimental: {
    // Removed incorrect optimizePackageImports
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

  // Webpack configurations
  webpack: (config, { isServer }) => {
    // Optimization configurations
    config.optimization.minimize = true;
    
    if (isServer) {
      config.optimization.concatenateModules = true;
    }

    return config;
  }
};

export default nextConfig;