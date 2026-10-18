import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // 🔥 YEH LINE SABSE ZAROORI HAI MOBILE APP KE LIYE!
  images: {
    unoptimized: true, // Server-side image optimization mobile me nahi chalta
  },
  typescript: {
    ignoreBuildErrors: true, 
  },
  trailingSlash: true, // 🔥 Mobile app me routing errors se bachne ke liye
};

export default nextConfig;