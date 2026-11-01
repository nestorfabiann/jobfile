/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Photos are shrunk in the browser first, one per request. Vercel caps request bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
