/**
 * Baby Activity Controller
 * Custom API endpoints for baby activity sync and management
 * Supports Offline-first with Soft Delete mechanism
 */

import { factories } from '@strapi/strapi';
import { Context } from 'koa';

// Activity type definitions
type ActivityType = 'feeding' | 'sleep' | 'pee' | 'poop' | 'weight' | 'solid';

interface FeedingData {
  amountMl: number;
  feedingType: 'breast' | 'bottle' | 'formula';
  duration?: number;
  notes?: string;
}

interface SleepData {
  endTime?: string;
  durationMinutes?: number;
  sleepType: 'night' | 'nap';
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  notes?: string;
}

interface PeeData {
  wetLevel: 'light' | 'normal' | 'heavy';
  notes?: string;
}

interface PoopData {
  color: 'yellow' | 'green' | 'brown' | 'black' | 'red' | 'white';
  consistency: 'watery' | 'soft' | 'normal' | 'hard';
  amount: 'small' | 'normal' | 'large';
  notes?: string;
}

interface WeightData {
  weightKg: number;
  notes?: string;
}

interface SolidData {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodItems: string[];
  amount?: 'small' | 'medium' | 'large';
  notes?: string;
}

type ActivityData = FeedingData | SleepData | PeeData | PoopData | WeightData | SolidData;

// Activity entry from client (push)
interface ActivityEntryFromClient {
  local_id: string;
  id?: number;  // Server ID if exists
  type: ActivityType;
  timestamp: string;
  data: ActivityData;
  deleted_at?: string | null;
  client_updated_at?: string;
}

interface SyncPushRequestBody {
  baby_profile_id: string;
  activities: ActivityEntryFromClient[];
}

interface SyncPullQueryParams {
  baby_profile_id?: string;
  since?: string;
  limit?: string;
  offset?: string;
}

interface BulkDeleteRequestBody {
  local_ids: string[];
}

interface ActivityRecord {
  id: number;
  documentId: string;
  local_id: string;
  type: ActivityType;
  timestamp: string;
  data: ActivityData;
  synced_at?: string;
  deleted_at?: string | null;
  client_updated_at?: string;
  updatedAt?: string;
  baby_profile?: {
    id: number;
    documentId: string;
  };
  user?: {
    id: number;
    documentId: string;
  };
}

interface BabyProfileRecord {
  id: number;
  documentId: string;
  user?: {
    id: number;
    documentId: string;
  };
}

const BABY_ACTIVITY_UID = 'api::baby-activity.baby-activity' as const;
const BABY_PROFILE_UID = 'api::baby-profile.baby-profile' as const;

// Validation functions for each activity type
function validateFeedingData(data: any): string | null {
  if (typeof data.amountMl !== 'number' || data.amountMl < 0) {
    return 'amountMl must be a non-negative number';
  }
  if (!['breast', 'bottle', 'formula'].includes(data.feedingType)) {
    return 'feedingType must be breast, bottle, or formula';
  }
  return null;
}

function validateSleepData(data: any): string | null {
  if (!['night', 'nap'].includes(data.sleepType)) {
    return 'sleepType must be night or nap';
  }
  if (data.quality && !['poor', 'fair', 'good', 'excellent'].includes(data.quality)) {
    return 'quality must be poor, fair, good, or excellent';
  }
  return null;
}

function validatePeeData(data: any): string | null {
  if (!['light', 'normal', 'heavy'].includes(data.wetLevel)) {
    return 'wetLevel must be light, normal, or heavy';
  }
  return null;
}

function validatePoopData(data: any): string | null {
  if (!['yellow', 'green', 'brown', 'black', 'red', 'white'].includes(data.color)) {
    return 'color must be yellow, green, brown, black, red, or white';
  }
  if (!['watery', 'soft', 'normal', 'hard'].includes(data.consistency)) {
    return 'consistency must be watery, soft, normal, or hard';
  }
  if (!['small', 'normal', 'large'].includes(data.amount)) {
    return 'amount must be small, normal, or large';
  }
  return null;
}

function validateWeightData(data: any): string | null {
  if (typeof data.weightKg !== 'number' || data.weightKg <= 0) {
    return 'weightKg must be a positive number';
  }
  return null;
}

function validateSolidData(data: any): string | null {
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(data.mealType)) {
    return 'mealType must be breakfast, lunch, dinner, or snack';
  }
  if (!Array.isArray(data.foodItems)) {
    return 'foodItems must be an array';
  }
  if (data.amount && !['small', 'medium', 'large'].includes(data.amount)) {
    return 'amount must be small, medium, or large';
  }
  return null;
}

function validateActivityData(type: ActivityType, data: any): string | null {
  if (!data || typeof data !== 'object') {
    return 'data must be an object';
  }

  switch (type) {
    case 'feeding':
      return validateFeedingData(data);
    case 'sleep':
      return validateSleepData(data);
    case 'pee':
      return validatePeeData(data);
    case 'poop':
      return validatePoopData(data);
    case 'weight':
      return validateWeightData(data);
    case 'solid':
      return validateSolidData(data);
    default:
      return 'Invalid activity type';
  }
}

export default factories.createCoreController(BABY_ACTIVITY_UID as any, ({ strapi }) => ({
  /**
   * GET /api/baby-activities/sync - Pull activities for sync
   * 
   * Query params:
   *   - baby_profile_id: (required) Document ID of the baby profile
   *   - since: ISO timestamp (optional) - only get activities updated after this time
   *   - limit: (optional, default 500) - max items per request
   *   - offset: (optional, default 0) - pagination offset
   * 
   * IMPORTANT: Returns ALL activities including soft-deleted ones (deleted_at IS NOT NULL)
   * so that client can sync deletions across devices.
   */
  async getSync(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { 
      baby_profile_id, 
      since,
      limit: limitStr = '500',
      offset: offsetStr = '0'
    } = ctx.query as SyncPullQueryParams;

    if (!baby_profile_id) {
      return ctx.badRequest('baby_profile_id is required');
    }

    // Parse pagination params
    const limit = Math.min(500, Math.max(1, parseInt(limitStr, 10) || 500));
    const offset = Math.max(0, parseInt(offsetStr, 10) || 0);

    try {
      // Verify baby profile ownership
      const babyProfile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: baby_profile_id,
        populate: ['user'],
      }) as BabyProfileRecord | null;

      if (!babyProfile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!babyProfile.user || babyProfile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to access this baby profile');
      }

      // Build query using Strapi's db.query for more control
      // This includes ALL records (including soft-deleted ones)
      const knex = strapi.db.connection;
      
      let query = knex('baby_activities')
        .select('baby_activities.*')
        .leftJoin('baby_activities_user_lnk', 'baby_activities.id', 'baby_activities_user_lnk.baby_activity_id')
        .leftJoin('baby_activities_baby_profile_lnk', 'baby_activities.id', 'baby_activities_baby_profile_lnk.baby_activity_id')
        .where('baby_activities_user_lnk.user_id', user.id)
        .where('baby_activities_baby_profile_lnk.baby_profile_id', babyProfile.id);

      // Add since filter if provided - use updatedAt for sync
      if (since) {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          return ctx.badRequest('Invalid since timestamp format. Use ISO format.');
        }
        query = query.where('baby_activities.updated_at', '>', sinceDate.toISOString());
      }

      // Get total count for pagination info
      const countQuery = query.clone();
      const countResult = await countQuery.count('baby_activities.id as count').first();
      const total = parseInt((countResult as any)?.count || '0', 10);

      // Apply pagination and ordering
      const activities = await query
        .orderBy('baby_activities.updated_at', 'asc')
        .limit(limit)
        .offset(offset);

      // Transform the raw results to include proper field names
      const transformedActivities = activities.map((activity: any) => ({
        id: activity.id,
        documentId: activity.document_id,
        local_id: activity.local_id,
        type: activity.type,
        timestamp: activity.timestamp,
        data: typeof activity.data === 'string' ? JSON.parse(activity.data) : activity.data,
        synced_at: activity.synced_at,
        deleted_at: activity.deleted_at,
        client_updated_at: activity.client_updated_at,
        createdAt: activity.created_at,
        updatedAt: activity.updated_at,
      }));

      const hasMore = offset + activities.length < total;
      const serverTime = new Date().toISOString();

      return ctx.send({
        data: transformedActivities,
        meta: {
          pagination: {
            offset,
            limit,
            total,
            hasMore,
          },
          serverTime,
          // Use this as 'since' for next sync
          lastSyncedAt: serverTime,
        },
      });
    } catch (error) {
      strapi.log.error('Error fetching activities for sync:', error);
      return ctx.internalServerError('Failed to fetch activities');
    }
  },

  /**
   * POST /api/baby-activities/sync - Push activities for sync (Upsert with Transaction)
   * 
   * Body: { baby_profile_id: string, activities: ActivityEntry[] }
   * 
   * Features:
   * - Uses Database Transaction for atomicity (all or nothing)
   * - Upsert based on local_id (or id if provided)
   * - Handles soft delete (deleted_at field)
   * - Server overwrites updatedAt for time consistency
   */
  async sync(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { baby_profile_id, activities } = ctx.request.body as SyncPushRequestBody;

    // Validate request body
    if (!baby_profile_id) {
      return ctx.badRequest('baby_profile_id is required');
    }

    if (!activities || !Array.isArray(activities)) {
      return ctx.badRequest('activities must be an array');
    }

    if (activities.length === 0) {
      return ctx.send({
        success: true,
        created: 0,
        updated: 0,
        deleted: 0,
        syncedAt: new Date().toISOString(),
      });
    }

    // Limit batch size
    if (activities.length > 500) {
      return ctx.badRequest('Maximum 500 activities per sync request');
    }

    try {
      // Verify baby profile ownership
      const babyProfile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: baby_profile_id,
        populate: ['user'],
      }) as BabyProfileRecord | null;

      if (!babyProfile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!babyProfile.user || babyProfile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to sync to this baby profile');
      }

      // Validate all activities before starting transaction
      const validationErrors: { index: number; local_id: string; error: string }[] = [];
      
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];

        if (!activity.local_id) {
          validationErrors.push({ index: i, local_id: 'missing', error: 'local_id is required' });
          continue;
        }

        if (!activity.type || !['feeding', 'sleep', 'pee', 'poop', 'weight', 'solid'].includes(activity.type)) {
          validationErrors.push({ index: i, local_id: activity.local_id, error: 'Invalid activity type' });
          continue;
        }

        if (!activity.timestamp) {
          validationErrors.push({ index: i, local_id: activity.local_id, error: 'timestamp is required' });
          continue;
        }

        // Only validate data if not a delete operation
        if (!activity.deleted_at) {
          const dataValidationError = validateActivityData(activity.type, activity.data);
          if (dataValidationError) {
            validationErrors.push({ index: i, local_id: activity.local_id, error: dataValidationError });
          }
        }
      }

      // Return validation errors if any
      if (validationErrors.length > 0) {
        return ctx.badRequest({
          message: 'Validation failed',
          errors: validationErrors,
        });
      }

      // Use Strapi's database transaction
      const knex = strapi.db.connection;
      const syncedAt = new Date().toISOString();
      
      let created = 0;
      let updated = 0;
      let softDeleted = 0;

      await knex.transaction(async (trx) => {
        for (const activity of activities) {
          // Find existing activity by local_id for this user
          const existingRecords = await trx('baby_activities')
            .select('baby_activities.*')
            .leftJoin('baby_activities_user_lnk', 'baby_activities.id', 'baby_activities_user_lnk.baby_activity_id')
            .where('baby_activities.local_id', activity.local_id)
            .where('baby_activities_user_lnk.user_id', user.id)
            .first();

          if (existingRecords) {
            // UPDATE existing record
            const updateData: any = {
              type: activity.type,
              timestamp: activity.timestamp,
              data: JSON.stringify(activity.data),
              synced_at: syncedAt,
              updated_at: syncedAt, // Server time as canonical
            };

            // Handle soft delete
            if (activity.deleted_at !== undefined) {
              updateData.deleted_at = activity.deleted_at;
              if (activity.deleted_at) {
                softDeleted++;
              }
            }

            // Store client's update time for conflict detection
            if (activity.client_updated_at) {
              updateData.client_updated_at = activity.client_updated_at;
            }

            await trx('baby_activities')
              .where('id', existingRecords.id)
              .update(updateData);

            updated++;
          } else {
            // CREATE new record
            // Generate a new document_id (Strapi v5 style)
            const documentId = generateDocumentId();
            
            const insertData: any = {
              document_id: documentId,
              local_id: activity.local_id,
              type: activity.type,
              timestamp: activity.timestamp,
              data: JSON.stringify(activity.data),
              synced_at: syncedAt,
              created_at: syncedAt,
              updated_at: syncedAt,
              published_at: syncedAt, // Required for Strapi v5
              locale: null,
            };

            // Handle soft delete for new records (edge case: deleted before first sync)
            if (activity.deleted_at) {
              insertData.deleted_at = activity.deleted_at;
              softDeleted++;
            }

            if (activity.client_updated_at) {
              insertData.client_updated_at = activity.client_updated_at;
            }

            // Insert the activity
            const [insertedId] = await trx('baby_activities').insert(insertData).returning('id');
            const activityId = typeof insertedId === 'object' ? insertedId.id : insertedId;

            // Create relationship to user
            await trx('baby_activities_user_lnk').insert({
              baby_activity_id: activityId,
              user_id: user.id,
            });

            // Create relationship to baby profile
            await trx('baby_activities_baby_profile_lnk').insert({
              baby_activity_id: activityId,
              baby_profile_id: babyProfile.id,
            });

            created++;
          }
        }
      });

      strapi.log.info(
        `Sync completed for user ${user.id}: ${created} created, ${updated} updated, ${softDeleted} soft-deleted`
      );

      return ctx.send({
        success: true,
        created,
        updated,
        softDeleted,
        syncedAt,
      });
    } catch (error) {
      strapi.log.error('Error during activity sync:', error);
      
      // Transaction automatically rolled back on error
      return ctx.internalServerError({
        message: 'Failed to sync activities. Transaction rolled back.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Delete a single activity (Hard delete - use soft delete via sync instead)
   * DELETE /api/baby-activities/:id
   */
  async delete(ctx: Context) {
    const user = (ctx.state as any).user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Find the activity and verify ownership
      const activity = await (strapi.documents as any)(BABY_ACTIVITY_UID).findOne({
        documentId: id,
        populate: ['user'],
      }) as ActivityRecord | null;

      if (!activity) {
        return ctx.notFound('Activity not found');
      }

      if (!activity.user || activity.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to delete this activity');
      }

      await (strapi.documents as any)(BABY_ACTIVITY_UID).delete({
        documentId: id,
      });

      strapi.log.info(`Activity ${id} hard-deleted by user ${user.id}`);

      return ctx.send({
        data: null,
        meta: {
          deletedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      strapi.log.error('Error deleting activity:', error);
      return ctx.internalServerError('Failed to delete activity');
    }
  },

  /**
   * Bulk delete activities by local_id (Hard delete)
   * POST /api/baby-activities/bulk-delete
   * Body: { local_ids: string[] }
   */
  async bulkDelete(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { local_ids } = ctx.request.body as BulkDeleteRequestBody;

    if (!local_ids || !Array.isArray(local_ids)) {
      return ctx.badRequest('local_ids must be an array');
    }

    if (local_ids.length === 0) {
      return ctx.send({
        success: true,
        deleted: 0,
      });
    }

    if (local_ids.length > 100) {
      return ctx.badRequest('Maximum 100 local_ids per bulk delete request');
    }

    try {
      let deleted = 0;
      const notFound: string[] = [];

      for (const localId of local_ids) {
        // Find activities by local_id for this user
        const activities = await (strapi.documents as any)(BABY_ACTIVITY_UID).findMany({
          filters: {
            local_id: { $eq: localId },
            user: { id: { $eq: user.id } },
          },
        }) as ActivityRecord[];

        if (activities && activities.length > 0) {
          for (const activity of activities) {
            await (strapi.documents as any)(BABY_ACTIVITY_UID).delete({
              documentId: activity.documentId,
            });
            deleted++;
          }
        } else {
          notFound.push(localId);
        }
      }

      strapi.log.info(`Bulk delete completed for user ${user.id}: ${deleted} deleted, ${notFound.length} not found`);

      return ctx.send({
        success: true,
        deleted,
        ...(notFound.length > 0 && { notFound }),
      });
    } catch (error) {
      strapi.log.error('Error during bulk delete:', error);
      return ctx.internalServerError('Failed to bulk delete activities');
    }
  },

  /**
   * Get a single activity (with ownership check)
   * GET /api/baby-activities/:id
   */
  async findOne(ctx: Context) {
    const user = (ctx.state as any).user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      const activity = await (strapi.documents as any)(BABY_ACTIVITY_UID).findOne({
        documentId: id,
        populate: ['user', 'baby_profile'],
      }) as ActivityRecord | null;

      if (!activity) {
        return ctx.notFound('Activity not found');
      }

      if (!activity.user || activity.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to view this activity');
      }

      // Remove user data from response
      const { user: _, ...activityData } = activity as any;

      return ctx.send({
        data: activityData,
      });
    } catch (error) {
      strapi.log.error('Error fetching activity:', error);
      return ctx.internalServerError('Failed to fetch activity');
    }
  },

  /**
   * Find all activities for a baby profile (with ownership check)
   * GET /api/baby-activities
   * Query params:
   *   - baby_profile_id: (required) ID of the baby profile
   *   - type: (optional) filter by activity type
   *   - from: (optional) start date filter
   *   - to: (optional) end date filter
   *   - include_deleted: (optional) include soft-deleted records
   */
  async find(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { 
      baby_profile_id, 
      type, 
      from, 
      to, 
      page = '1', 
      pageSize = '25',
      include_deleted = 'false'
    } = ctx.query as {
      baby_profile_id?: string;
      type?: string;
      from?: string;
      to?: string;
      page?: string;
      pageSize?: string;
      include_deleted?: string;
    };

    if (!baby_profile_id) {
      return ctx.badRequest('baby_profile_id is required');
    }

    try {
      // Verify baby profile ownership
      const babyProfile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: baby_profile_id,
        populate: ['user'],
      }) as BabyProfileRecord | null;

      if (!babyProfile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!babyProfile.user || babyProfile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to access this baby profile');
      }

      // Build filters
      const filters: any = {
        baby_profile: { documentId: { $eq: baby_profile_id } },
        user: { id: { $eq: user.id } },
      };

      // Exclude soft-deleted by default
      if (include_deleted !== 'true') {
        filters.deleted_at = { $null: true };
      }

      // Add type filter
      if (type && ['feeding', 'sleep', 'pee', 'poop', 'weight', 'solid'].includes(type)) {
        filters.type = { $eq: type };
      }

      // Add date range filters
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          filters.timestamp = { ...(filters.timestamp || {}), $gte: from };
        }
      }

      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          filters.timestamp = { ...(filters.timestamp || {}), $lte: to };
        }
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

      const activities = await (strapi.documents as any)(BABY_ACTIVITY_UID).findMany({
        filters,
        sort: { timestamp: 'desc' },
        limit: pageSizeNum,
        offset: (pageNum - 1) * pageSizeNum,
      });

      // Get total count for pagination
      const allActivities = await (strapi.documents as any)(BABY_ACTIVITY_UID).findMany({
        filters,
      });
      const total = allActivities.length;

      return ctx.send({
        data: activities,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            pageCount: Math.ceil(total / pageSizeNum),
            total,
          },
        },
      });
    } catch (error) {
      strapi.log.error('Error fetching activities:', error);
      return ctx.internalServerError('Failed to fetch activities');
    }
  },
}));

/**
 * Generate a unique document ID (Strapi v5 style)
 */
function generateDocumentId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
