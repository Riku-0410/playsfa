import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ~/package-lock.json(Claude Code等のホーム直下インストール)に
  // ワークスペースルートを誤検出されないよう明示
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
