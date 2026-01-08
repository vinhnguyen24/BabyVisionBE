/**
 * Email Controller
 * 
 * Handles email-related API requests
 */

import { Context } from 'koa';

export default {
  /**
   * Send a test email to verify configuration
   * POST /api/email/send-test
   */
  async sendTest(ctx: Context) {
    const { to } = ctx.request.body as { to?: string };

    if (!to) {
      return ctx.badRequest('Email address is required');
    }

    const result = await strapi.service('api::email.email').sendTestEmail(to);

    if (result.success) {
      ctx.body = {
        success: true,
        message: `Test email sent successfully to ${to}`,
      };
    } else {
      ctx.body = {
        success: false,
        error: result.error,
      };
    }
  },

  /**
   * Send registration confirmation email
   * POST /api/email/send-registration
   */
  async sendRegistration(ctx: Context) {
    const { to, firstName, verificationLink } = ctx.request.body as {
      to?: string;
      firstName?: string;
      verificationLink?: string;
    };

    if (!to || !firstName || !verificationLink) {
      return ctx.badRequest('Missing required fields: to, firstName, verificationLink');
    }

    const result = await strapi.service('api::email.email').sendRegistrationEmail({
      to,
      firstName,
      verificationLink,
    });

    if (result.success) {
      ctx.body = {
        success: true,
        message: `Registration email sent successfully to ${to}`,
      };
    } else {
      ctx.body = {
        success: false,
        error: result.error,
      };
    }
  },
};
