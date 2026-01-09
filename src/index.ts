// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }) {
    try {
      const pluginStore = strapi.store({
        type: 'plugin',
        name: 'users-permissions',
      });

      const settings = await pluginStore.get({ key: 'email' });
      
      const defaultFrom = process.env.EMAIL_DEFAULT_FROM || 'onboarding@resend.dev';
      const defaultReplyTo = process.env.EMAIL_DEFAULT_REPLY_TO || 'onboarding@resend.dev';

      // Load premium template from file
      const fs = require('fs');
      const path = require('path');
      // Use process.cwd() to ensure it works from the project root
      const confirmationTemplatePath = path.join(process.cwd(), 'src', 'extensions', 'email', 'templates', 'registration-confirmation.html');
      const resetPasswordTemplatePath = path.join(process.cwd(), 'src', 'extensions', 'email', 'templates', 'reset-password.html');
      
      let premiumHtml = '';
      let resetPasswordHtml = '';

      // Load confirmation email template
      if (fs.existsSync(confirmationTemplatePath)) {
        strapi.log.info(`Reading premium template from: ${confirmationTemplatePath}`);
        premiumHtml = fs.readFileSync(confirmationTemplatePath, 'utf-8');
        
        // Convert placeholders to Strapi format
        premiumHtml = premiumHtml
          .replace(/{{firstName}}/g, '<%= USER.username %>')
          .replace(/{{email}}/g, '<%= USER.email %>')
          .replace(/{{verificationLink}}/g, '<%= URL %>?confirmation=<%= USER_CONFIRMATION_TOKEN %>')
          .replace(/{{year}}/g, new Date().getFullYear().toString())
          .replace(/{{appStoreLink}}/g, 'https://apps.apple.com/app/babyvision')
          .replace(/{{playStoreLink}}/g, 'https://play.google.com/store/apps/details?id=com.babyvision')
          .replace(/{{unsubscribeLink}}/g, '#');
      } else {
        strapi.log.warn(`Premium template file not found at: ${confirmationTemplatePath}`);
      }

      // Load reset password email template
      if (fs.existsSync(resetPasswordTemplatePath)) {
        strapi.log.info(`Reading reset password template from: ${resetPasswordTemplatePath}`);
        resetPasswordHtml = fs.readFileSync(resetPasswordTemplatePath, 'utf-8');
        
        // Convert placeholders to Strapi format
        resetPasswordHtml = resetPasswordHtml
          .replace(/{{resetLink}}/g, '<%= URL %>?code=<%= TOKEN %>')
          .replace(/{{year}}/g, new Date().getFullYear().toString());
      } else {
        strapi.log.warn(`Reset password template file not found at: ${resetPasswordTemplatePath}`);
      }

      let changed = false;

      // Update Confirmation Email
      if (settings?.email_confirmation?.options) {
        // Force update domain if needed
        if (!settings.email_confirmation.options.from || settings.email_confirmation.options.from.includes('strapi.io')) {
          settings.email_confirmation.options.from = defaultFrom;
          settings.email_confirmation.options.response_email = defaultReplyTo;
          changed = true;
        }
        
        // Always force update the template during this transition to ensure "Wow" factor
        if (premiumHtml && (settings.email_confirmation.options.message !== premiumHtml)) {
          settings.email_confirmation.options.message = premiumHtml;
          settings.email_confirmation.options.object = 'Welcome to BabyVision — Please verify your email';
          changed = true;
          strapi.log.info('Updated email confirmation template to premium version.');
        }
      }

      // Update Reset Password Email
      if (settings?.reset_password?.options) {
        if (!settings.reset_password.options.from || settings.reset_password.options.from.includes('strapi.io')) {
          settings.reset_password.options.from = defaultFrom;
          settings.reset_password.options.response_email = defaultReplyTo;
          changed = true;
        }

        // Update reset password template to match premium style
        if (resetPasswordHtml && (settings.reset_password.options.message !== resetPasswordHtml)) {
          settings.reset_password.options.message = resetPasswordHtml;
          settings.reset_password.options.object = 'Reset Your Password — BabyVision';
          changed = true;
          strapi.log.info('Updated reset password template to premium version.');
        }
      }

      if (changed) {
        await pluginStore.set({ key: 'email', value: settings });
        strapi.log.info('✨ PREMIUM: Email settings and templates updated in Database!');
      }
    } catch (error) {
      strapi.log.error('❌ Failed to update email settings:', error);
    }
  },
};
