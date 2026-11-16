import type { NextConfig } from "next";

/**
 * Sandbox preview only: the dev server receives dev-asset and HMR requests whose
 * Origin is the public preview host (https://3000-<suffix>). Next 15 validates that
 * origin, so it must be allow-listed or the page loads without styles/HMR.
 * Gated on BASE44_PREVIEW_MODE === "1"; normal deployments are unaffected.
 */
const previewOrigins =
  process.env.BASE44_PREVIEW_MODE === "1" && process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? [`3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`]
    : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: previewOrigins,
  experimental: {
    serverActions: {
      // The preview proxy forwards the public Origin while rewriting Host, so Next's
      // server-action origin check would reject every mutation ("Invalid Server Actions
      // request"). Allow-list the preview host only, and only in preview mode.
      allowedOrigins: previewOrigins,
      // Candidate CV-less pilot: no file uploads in the MVP.
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
