/**
 * Email Service for BabyVision
 * 
 * This service provides methods to send various transactional emails
 * using Strapi's email plugin with Resend provider.
 * 
 * Usage in controllers/services:
 * 
 * const emailService = strapi.service('api::email.email');
 * await emailService.sendRegistrationEmail({
 *   to: 'user@example.com',
 *   firstName: 'John',
 *   verificationLink: 'https://...'
 * });
 */

import { renderRegistrationEmail, getRegistrationEmailPlainText } from '../../../extensions/email/email-templates';

interface SendRegistrationEmailParams {
  to: string;
  firstName: string;
  verificationLink: string;
  appStoreLink?: string;
  playStoreLink?: string;
  unsubscribeLink?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export default {
  /**
   * Send registration confirmation email with verification link
   */
  async sendRegistrationEmail(params: SendRegistrationEmailParams): Promise<SendEmailResult> {
    const { to, firstName, verificationLink, appStoreLink, playStoreLink, unsubscribeLink } = params;

    try {
      // Render the HTML template
      const html = renderRegistrationEmail({
        firstName,
        email: to,
        verificationLink,
        appStoreLink,
        playStoreLink,
        unsubscribeLink,
      });

      // Get plain text version
      const text = getRegistrationEmailPlainText({
        firstName,
        email: to,
        verificationLink,
        appStoreLink,
        playStoreLink,
        unsubscribeLink,
      });

      // Send the email using Strapi's email plugin
      await strapi.plugins['email'].services.email.send({
        to,
        subject: `Welcome to BabyVision, ${firstName} — Please verify your email`,
        html,
        text,
      });

      strapi.log.info(`Registration email sent successfully to ${to}`);
      
      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      strapi.log.error(`Failed to send registration email to ${to}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Send a test email to verify email configuration
   */
  async sendTestEmail(to: string): Promise<SendEmailResult> {
    try {
      await strapi.plugins['email'].services.email.send({
        to,
        subject: 'BabyVision Email Test ✅',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #8B5CF6;">Email Configuration Working! 🎉</h1>
            <p>Your BabyVision email service is properly configured with Resend.</p>
            <p style="color: #6B7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
          </div>
        `,
        text: 'BabyVision email configuration is working correctly!',
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },
};
