export default ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  // Security middleware with CSP configuration
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  // CORS configuration for Web (Next.js) and Mobile (React Native) clients
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      // Get allowed origins from environment or use defaults
      origin: env.array('CORS_ORIGINS', [
        // Development origins
        'http://localhost:3000',  // Next.js dev server
        'http://localhost:3001',
        'http://localhost:8081',  // Metro bundler
        'http://127.0.0.1:3000',
        // Production origins (add your domains here)
        'https://babyvision.vn',
        'https://www.babyvision.vn',
        'https://app.babyvision.vn',
        // React Native mobile apps
        'capacitor://localhost',   // Capacitor apps
        'ionic://localhost',       // Ionic apps  
        'http://localhost',        // Android emulator
        // Allow custom origins from environment
      ]),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      credentials: true,
      maxAge: 86400, // 24 hours
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
