import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The agreement .docx download reads the brand mark from /public at request
  // time; ship it with that route's serverless function.
  outputFileTracingIncludes: {
    "/admin/billing/agreements/*/docx": ["./public/brand/suloai-mark.png"],
  },
};

export default nextConfig;
