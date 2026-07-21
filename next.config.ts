import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    // Required for @pdfslick/react — resolves canvas dependency used by pdfjs-dist
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
