/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    unoptimized: false,
  },
  experimental: {
    serverComponentsExternalPackages: [
      'genkit',
      '@genkit-ai/core',
      '@genkit-ai/google-genai',
      '@opentelemetry/api',
      '@opentelemetry/sdk-node',
      '@opentelemetry/instrumentation',
      'require-in-the-middle',
    ],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externalModules = [
        'require-in-the-middle',
        '@opentelemetry/instrumentation',
        '@opentelemetry/sdk-node',
      ];
      config.externals = config.externals || [];
      config.externals.push(...externalModules);
    }

    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push((warning) => {
      return typeof warning?.message === 'string'
        && warning.message.includes('Critical dependency: require function is used in a way in which dependencies cannot be statically extracted');
    });

    return config;
  },
};

export default nextConfig;
