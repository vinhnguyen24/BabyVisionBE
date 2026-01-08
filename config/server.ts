export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  proxy: env.bool('PROXY', false),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    // Allow higher timeout for webhooks
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Cron tasks configuration
  cron: {
    enabled: env.bool('CRON_ENABLED', true),
  },
});
