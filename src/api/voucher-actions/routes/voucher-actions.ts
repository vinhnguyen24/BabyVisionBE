/**
 * Voucher Actions Routes
 * Custom routes for voucher redemption API
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/voucher-actions/redeem',
      handler: 'voucher-actions.redeem',
      config: {
        auth: false, // Set to true if you want to require authentication
        policies: [],
        middlewares: [],
        description: 'Redeem a voucher code and grant premium access',
        tag: {
          plugin: 'voucher-actions',
          name: 'Voucher Actions',
        },
      },
    },
    {
      method: 'POST',
      path: '/voucher-actions/validate',
      handler: 'voucher-actions.validate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Validate a voucher code without redeeming',
        tag: {
          plugin: 'voucher-actions',
          name: 'Voucher Actions',
        },
      },
    },
    {
      method: 'POST',
      path: '/voucher-actions/generate',
      handler: 'voucher-actions.generate',
      config: {
        auth: {
          scope: ['admin::isAuthenticatedAdmin'],
        },
        policies: [],
        middlewares: [],
        description: 'Generate batch voucher codes (Admin only)',
        tag: {
          plugin: 'voucher-actions',
          name: 'Voucher Actions',
        },
      },
    },
  ],
};
