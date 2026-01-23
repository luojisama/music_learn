import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['NeteaseCloudMusicApi'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.music.126.net',
      },
      {
        protocol: 'http',
        hostname: '**.music.126.net',
      },
      {
        protocol: 'https',
        hostname: '**.126.net',
      },
      {
        protocol: 'http',
        hostname: '**.126.net',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
