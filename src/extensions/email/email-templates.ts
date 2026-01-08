import fs from 'fs';
import path from 'path';

interface RegistrationEmailData {
  firstName: string;
  email: string;
  verificationLink: string;
  appStoreLink?: string;
  playStoreLink?: string;
  unsubscribeLink?: string;
}

/**
 * Email template utilities for BabyVision
 * 
 * Usage:
 * const { renderRegistrationEmail } = require('./email-templates');
 * const html = renderRegistrationEmail({
 *   firstName: 'John',
 *   email: 'john@example.com',
 *   verificationLink: 'https://...'
 * });
 */

const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Replace all placeholders in a template string
 */
const replacePlaceholders = (template: string, data: Record<string, string>): string => {
  let result = template;
  
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, value || '');
  }
  
  return result;
};

/**
 * Load and render the registration confirmation email template
 */
export const renderRegistrationEmail = (data: RegistrationEmailData): string => {
  const templatePath = path.join(TEMPLATES_DIR, 'registration-confirmation.html');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templatePath}`);
  }
  
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  const placeholders: Record<string, string> = {
    firstName: data.firstName || 'Parent',
    email: data.email,
    verificationLink: data.verificationLink,
    appStoreLink: data.appStoreLink || 'https://apps.apple.com/app/babyvision',
    playStoreLink: data.playStoreLink || 'https://play.google.com/store/apps/details?id=com.babyvision',
    unsubscribeLink: data.unsubscribeLink || '#',
    year: new Date().getFullYear().toString(),
  };
  
  return replacePlaceholders(template, placeholders);
};

/**
 * Get plain text version for email clients that don't support HTML
 */
export const getRegistrationEmailPlainText = (data: RegistrationEmailData): string => {
  return `
Welcome to BabyVision, ${data.firstName || 'Parent'}!

You're joining 100,000+ parents on an amazing journey.

Please verify your email address (${data.email}) by clicking the link below:
${data.verificationLink}

🌟 What's waiting for you:
• Vision Simulator - See exactly how your baby perceives the world
• AI Sleep Coach - Predicts optimal nap times with 90% accuracy  
• Hazard Detection - AI-powered safety scanning for your home

🚀 Getting Started:
1. Verify your email by clicking the link above
2. Download the app from App Store or Google Play
3. Try the Vision Simulator - Point your camera and see through your baby's eyes!

Download the app:
• App Store: ${data.appStoreLink || 'https://apps.apple.com/app/babyvision'}
• Google Play: ${data.playStoreLink || 'https://play.google.com/store/apps/details?id=com.babyvision'}

Questions? Contact us at hello@babyvision.app

---
© ${new Date().getFullYear()} BabyVision. Made with love for parents everywhere.

Unsubscribe: ${data.unsubscribeLink || '#'}
  `.trim();
};

export default {
  renderRegistrationEmail,
  getRegistrationEmailPlainText,
};
