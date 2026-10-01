import type { NextConfig } from "next";

const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  output: isCapacitor ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: isCapacitor,
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbrgvuxvmfvnfbweznri.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "www.recipetineats.com",
      },
    ],
  },
};

export default nextConfig;
