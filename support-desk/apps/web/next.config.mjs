import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two lockfiles exist (repo root and apps/web); pin the workspace root
  // explicitly so Next doesn't guess wrong and break the "@/..." alias.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
