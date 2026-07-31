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
  experimental: {
    // Tree-shake barrel files from heavy libs — reduces JS bundle sent to client
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      'framer-motion',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'react-icons',
      '@fullcalendar/react',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/list',
      '@fullcalendar/interaction',
    ],
  },
  webpack: (config) => {
    // Required for @pdfslick/react — resolves canvas dependency used by pdfjs-dist
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
