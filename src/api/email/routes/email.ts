/**
 * Email API Routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/email/send-test',
      handler: 'email.sendTest',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Set to true in production
      },
    },
    {
      method: 'POST',
      path: '/email/send-registration',
      handler: 'email.sendRegistration',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Set to true in production
      },
    },
  ],
};
