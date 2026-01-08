/**
 * Voucher Actions Controller
 * Custom API endpoints for voucher redemption with RevenueCat integration
 */

import type { Core } from '@strapi/strapi';
import { Context } from 'koa';

interface RedeemRequest {
  voucherCode: string;
  appUserId: string;
}

interface RevenueCatEntitlement {
  duration: 'daily' | 'three_day' | 'weekly' | 'two_week' | 'monthly' | 'two_month' | 'three_month' | 'six_month' | 'yearly' | 'lifetime';
  start_time_ms?: number;
}

interface VoucherEntry {
  id: number;
  documentId: string;
  code: string;
  type: 'free_trial' | 'discount';
  duration_months: number;
  is_used: boolean;
  expiry_date: string;
  assigned_to: {
    id: number;
    revenuecat_customer_id: string;
  } | null;
  redeemed_at: string | null;
  max_uses: number;
  current_uses: number;
}

export default {
  /**
   * Redeem a voucher code and grant premium access via RevenueCat
   * POST /api/voucher-actions/redeem
   * 
   * @param ctx - Koa context with request body containing voucherCode and appUserId
   * @returns Success or error response
   */
  async redeem(ctx: Context) {
    const strapi = (ctx as any).strapi as Core.Strapi;
    const { voucherCode, appUserId }: RedeemRequest = ctx.request.body as RedeemRequest;

    // Validate input
    if (!voucherCode || !appUserId) {
      return ctx.badRequest('Missing required fields: voucherCode and appUserId are required');
    }

    try {
      // Step 1: Find the voucher in database
      const vouchers = await strapi.documents('api::voucher.voucher').findMany({
        filters: { code: { $eq: voucherCode } },
        populate: ['assigned_to'],
      });

      if (!vouchers || vouchers.length === 0) {
        return ctx.notFound('Voucher not found');
      }

      const voucher = vouchers[0] as unknown as VoucherEntry;

      // Step 2: Validate voucher status
      const validationError = validateVoucher(voucher, appUserId);
      if (validationError) {
        return ctx.badRequest(validationError);
      }

      // Step 3: Call RevenueCat Promotional Grant API
      const revenueCatResult = await grantRevenueCatEntitlement(
        appUserId,
        voucher.duration_months,
        strapi
      );

      if (!revenueCatResult.success) {
        strapi.log.error('RevenueCat API Error:', revenueCatResult.error);
        return ctx.internalServerError('Failed to activate premium subscription. Please try again.');
      }

      // Step 4: Update voucher status in Strapi
      await strapi.documents('api::voucher.voucher').update({
        documentId: voucher.documentId,
        data: {
          is_used: true,
          redeemed_at: new Date().toISOString(),
          current_uses: (voucher.current_uses || 0) + 1,
        } as any,
      });

      // Step 5: Update user's premium status
      await updateUserPremiumStatus(strapi, appUserId, true);

      // Log successful redemption
      strapi.log.info(`Voucher ${voucherCode} redeemed by user ${appUserId}`);

      return ctx.send({
        success: true,
        message: 'Voucher redeemed successfully! Premium access has been activated.',
        data: {
          duration_months: voucher.duration_months,
          voucher_type: voucher.type,
          activated_at: new Date().toISOString(),
        },
      });

    } catch (error) {
      strapi.log.error('Voucher redemption error:', error);
      return ctx.internalServerError('An unexpected error occurred during voucher redemption');
    }
  },

  /**
   * Validate a voucher code without redeeming
   * POST /api/voucher-actions/validate
   */
  async validate(ctx: Context) {
    const strapi = (ctx as any).strapi as Core.Strapi;
    const { voucherCode }: { voucherCode: string } = ctx.request.body as { voucherCode: string };

    if (!voucherCode) {
      return ctx.badRequest('Missing required field: voucherCode');
    }

    try {
      const vouchers = await strapi.documents('api::voucher.voucher').findMany({
        filters: { code: { $eq: voucherCode } },
      });

      if (!vouchers || vouchers.length === 0) {
        return ctx.send({
          valid: false,
          error: 'Voucher not found',
        });
      }

      const voucher = vouchers[0] as unknown as VoucherEntry;
      const validationError = validateVoucher(voucher);

      return ctx.send({
        valid: !validationError,
        error: validationError || null,
        data: validationError ? null : {
          type: voucher.type,
          duration_months: voucher.duration_months,
          expiry_date: voucher.expiry_date,
        },
      });

    } catch (error) {
      strapi.log.error('Voucher validation error:', error);
      return ctx.internalServerError('An error occurred during voucher validation');
    }
  },

  /**
   * Generate batch voucher codes (Admin only)
   * POST /api/voucher-actions/generate
   */
  async generate(ctx: Context) {
    const strapi = (ctx as any).strapi as Core.Strapi;
    const {
      count = 1,
      type = 'free_trial',
      duration_months = 1,
      expiry_days = 30,
      prefix = 'BV',
    }: {
      count?: number;
      type?: 'free_trial' | 'discount';
      duration_months?: number;
      expiry_days?: number;
      prefix?: string;
    } = ctx.request.body as any;

    // Validate count
    if (count < 1 || count > 100) {
      return ctx.badRequest('Count must be between 1 and 100');
    }

    try {
      const generatedVouchers: string[] = [];
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiry_days);

      for (let i = 0; i < count; i++) {
        const code = generateVoucherCode(prefix);
        
        await strapi.documents('api::voucher.voucher').create({
          data: {
            code,
            type,
            duration_months,
            is_used: false,
            expiry_date: expiryDate.toISOString(),
            max_uses: 1,
            current_uses: 0,
          },
        });

        generatedVouchers.push(code);
      }

      return ctx.send({
        success: true,
        message: `Generated ${count} voucher(s) successfully`,
        vouchers: generatedVouchers,
        expiry_date: expiryDate.toISOString(),
      });

    } catch (error) {
      strapi.log.error('Voucher generation error:', error);
      return ctx.internalServerError('Failed to generate vouchers');
    }
  },
};

/**
 * Validate voucher status and eligibility
 */
function validateVoucher(voucher: VoucherEntry, appUserId?: string): string | null {
  // Check if expired
  if (new Date(voucher.expiry_date) < new Date()) {
    return 'Voucher has expired';
  }

  // Check if already used
  if (voucher.is_used) {
    return 'Voucher has already been used';
  }

  // Check max uses
  if (voucher.current_uses >= voucher.max_uses) {
    return 'Voucher has reached maximum uses';
  }

  // Check if assigned to specific user
  if (voucher.assigned_to && appUserId) {
    if (voucher.assigned_to.revenuecat_customer_id !== appUserId) {
      return 'This voucher is assigned to a different user';
    }
  }

  return null;
}

/**
 * Generate a unique voucher code
 */
function generateVoucherCode(prefix: string = 'BV'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Call RevenueCat Promotional Entitlements API
 * @see https://www.revenuecat.com/docs/api-v1#tag/Entitlements/operation/grant_entitlement
 */
async function grantRevenueCatEntitlement(
  appUserId: string,
  durationMonths: number,
  strapi: Core.Strapi
): Promise<{ success: boolean; error?: string; data?: any }> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  const entitlementIdentifier = process.env.REVENUECAT_ENTITLEMENT_IDENTIFIER || 'premium';

  if (!apiKey) {
    return { success: false, error: 'RevenueCat API key not configured' };
  }

  // Map duration months to RevenueCat duration
  const durationMap: Record<number, RevenueCatEntitlement['duration']> = {
    1: 'monthly',
    2: 'two_month',
    3: 'three_month',
    6: 'six_month',
    12: 'yearly',
  };

  const duration = durationMap[durationMonths] || 'monthly';

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${entitlementIdentifier}/promotional`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Platform': 'stripe', // Use stripe for server-side grants
        },
        body: JSON.stringify({
          duration,
          start_time_ms: Date.now(),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      strapi.log.error('RevenueCat API response:', response.status, errorData);
      return { 
        success: false, 
        error: `RevenueCat API error: ${response.status}` 
      };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update user's premium status in the database
 */
async function updateUserPremiumStatus(
  strapi: Core.Strapi,
  revenueCatCustomerId: string,
  isPremium: boolean
): Promise<void> {
  try {
    // Find user by RevenueCat customer ID
    const users = await strapi.documents('plugin::users-permissions.user').findMany({
      filters: { revenuecat_customer_id: { $eq: revenueCatCustomerId } },
    });

    if (users && users.length > 0) {
      const user = users[0];
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: user.documentId,
        data: { is_premium: isPremium } as any,
      });
    }
  } catch (error) {
    strapi.log.warn('Could not update user premium status:', error);
    // Don't throw - voucher was still redeemed successfully
  }
}
