/**
 * Baby Profile Controller
 * Custom API endpoints for baby profile management
 */

import { factories } from '@strapi/strapi';
import { Context } from 'koa';

interface BabyProfileData {
  name: string;
  birthdate: string;
  avatar_url?: string;
  is_premature?: boolean;
  premature_weeks?: number;
}

interface BabyProfileEntry {
  id: number;
  documentId: string;
  name: string;
  birthdate: string;
  avatar_url?: string;
  is_premature?: boolean;
  premature_weeks?: number;
  user?: {
    id: number;
    documentId: string;
  };
}

const BABY_PROFILE_UID = 'api::baby-profile.baby-profile' as const;
const BABY_ACTIVITY_UID = 'api::baby-activity.baby-activity' as const;

export default factories.createCoreController(BABY_PROFILE_UID as any, ({ strapi }) => ({
  /**
   * Get current user's baby profile(s)
   * GET /api/baby-profiles/me
   */
  async me(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      const profiles = await (strapi.documents as any)(BABY_PROFILE_UID).findMany({
        filters: { user: { id: { $eq: user.id } } },
      });

      return ctx.send({
        data: profiles,
        meta: {
          count: profiles.length,
        },
      });
    } catch (error) {
      strapi.log.error('Error fetching baby profiles:', error);
      return ctx.internalServerError('Failed to fetch baby profiles');
    }
  },

  /**
   * Create a baby profile for the current user
   * POST /api/baby-profiles
   */
  async create(ctx: Context) {
    const user = (ctx.state as any).user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { name, birthdate, avatar_url, is_premature, premature_weeks } = ctx.request.body as BabyProfileData;

    // Validate required fields
    if (!name || !birthdate) {
      return ctx.badRequest('Name and birthdate are required');
    }

    // Validate birthdate format
    const parsedDate = new Date(birthdate);
    if (isNaN(parsedDate.getTime())) {
      return ctx.badRequest('Invalid birthdate format. Use YYYY-MM-DD');
    }

    // Validate premature_weeks if is_premature is true
    if (is_premature && (!premature_weeks || premature_weeks < 0 || premature_weeks > 20)) {
      return ctx.badRequest('premature_weeks must be between 0 and 20 when is_premature is true');
    }

    try {
      const profile = await (strapi.documents as any)(BABY_PROFILE_UID).create({
        data: {
          name,
          birthdate,
          avatar_url: avatar_url || null,
          is_premature: is_premature || false,
          premature_weeks: is_premature ? premature_weeks : null,
          user: user.documentId,
        },
      });

      strapi.log.info(`Baby profile created for user ${user.id}: ${name}`);

      return ctx.send({
        data: profile,
        meta: {
          createdAt: new Date().toISOString(),
        },
      }, 201);
    } catch (error) {
      strapi.log.error('Error creating baby profile:', error);
      return ctx.internalServerError('Failed to create baby profile');
    }
  },

  /**
   * Update a baby profile
   * PUT /api/baby-profiles/:id
   */
  async update(ctx: Context) {
    const user = (ctx.state as any).user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Find the profile and verify ownership
      const profile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: id,
        populate: ['user'],
      }) as BabyProfileEntry | null;

      if (!profile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!profile.user || profile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to update this profile');
      }

      const { name, birthdate, avatar_url, is_premature, premature_weeks } = ctx.request.body as Partial<BabyProfileData>;

      // Validate birthdate if provided
      if (birthdate) {
        const parsedDate = new Date(birthdate);
        if (isNaN(parsedDate.getTime())) {
          return ctx.badRequest('Invalid birthdate format. Use YYYY-MM-DD');
        }
      }

      // Build update data (only include provided fields)
      const updateData: Partial<BabyProfileData> = {};
      if (name !== undefined) updateData.name = name;
      if (birthdate !== undefined) updateData.birthdate = birthdate;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (is_premature !== undefined) updateData.is_premature = is_premature;
      if (premature_weeks !== undefined) updateData.premature_weeks = premature_weeks;

      const updatedProfile = await (strapi.documents as any)(BABY_PROFILE_UID).update({
        documentId: id,
        data: updateData,
      });

      strapi.log.info(`Baby profile ${id} updated by user ${user.id}`);

      return ctx.send({
        data: updatedProfile,
        meta: {
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      strapi.log.error('Error updating baby profile:', error);
      return ctx.internalServerError('Failed to update baby profile');
    }
  },

  /**
   * Delete a baby profile
   * DELETE /api/baby-profiles/:id
   */
  async delete(ctx: Context) {
    const user = (ctx.state as any).user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      // Find the profile and verify ownership
      const profile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: id,
        populate: ['user'],
      }) as BabyProfileEntry | null;

      if (!profile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!profile.user || profile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to delete this profile');
      }

      // Delete associated activities first
      const activities = await (strapi.documents as any)(BABY_ACTIVITY_UID).findMany({
        filters: { baby_profile: { documentId: { $eq: id } } },
      });

      for (const activity of activities) {
        await (strapi.documents as any)(BABY_ACTIVITY_UID).delete({
          documentId: activity.documentId,
        });
      }

      // Delete the profile
      await (strapi.documents as any)(BABY_PROFILE_UID).delete({
        documentId: id,
      });

      strapi.log.info(`Baby profile ${id} and ${activities.length} activities deleted by user ${user.id}`);

      return ctx.send({
        data: null,
        meta: {
          deletedAt: new Date().toISOString(),
          activitiesDeleted: activities.length,
        },
      });
    } catch (error) {
      strapi.log.error('Error deleting baby profile:', error);
      return ctx.internalServerError('Failed to delete baby profile');
    }
  },

  /**
   * Find one baby profile (with ownership check)
   * GET /api/baby-profiles/:id
   */
  async findOne(ctx: Context) {
    const user = (ctx.state as any).user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      const profile = await (strapi.documents as any)(BABY_PROFILE_UID).findOne({
        documentId: id,
        populate: ['user'],
      }) as BabyProfileEntry | null;

      if (!profile) {
        return ctx.notFound('Baby profile not found');
      }

      if (!profile.user || profile.user.id !== user.id) {
        return ctx.forbidden('You are not authorized to view this profile');
      }

      // Remove user data from response
      const { user: _, ...profileData } = profile as any;

      return ctx.send({
        data: profileData,
      });
    } catch (error) {
      strapi.log.error('Error fetching baby profile:', error);
      return ctx.internalServerError('Failed to fetch baby profile');
    }
  },
}));
