/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prisma/client', '@/generated/prisma'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['antd', '@ant-design/icons', 'lodash', 'echarts', 'recharts'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**', '**/prisma/**'],
      };
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '/src',
    };
    
    return config;
  },
};

export default nextConfig;
