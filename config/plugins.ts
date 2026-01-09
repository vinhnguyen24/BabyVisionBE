export default ({ env }) => ({
  email: {
    config: {
      provider: 'strapi-provider-email-resend',
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        defaultFrom: env('EMAIL_DEFAULT_FROM', 'onboarding@resend.dev'),
        defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO', 'onboarding@resend.dev'),
      },
    },
  },
  ckeditor5: {
    enabled: true,
  },
});
