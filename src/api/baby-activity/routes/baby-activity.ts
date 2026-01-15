/**
 * Baby Activity Routes
 * Custom routes for baby activity sync and management
 */

export default {
  routes: [
    // Sync endpoints (must be before parameterized routes)
    {
      method: 'GET',
      path: '/baby-activities/sync',
      handler: 'baby-activity.getSync',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get activities for sync with optional since timestamp',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
    {
      method: 'POST',
      path: '/baby-activities/sync',
      handler: 'baby-activity.sync',
      config: {
        policies: [],
        middlewares: [],
        description: 'Bulk upsert activities (create or update based on local_id)',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
    {
      method: 'POST',
      path: '/baby-activities/bulk-delete',
      handler: 'baby-activity.bulkDelete',
      config: {
        policies: [],
        middlewares: [],
        description: 'Bulk delete activities by local_id',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
    // Standard CRUD routes
    {
      method: 'GET',
      path: '/baby-activities',
      handler: 'baby-activity.find',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get all activities for a baby profile',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
    {
      method: 'GET',
      path: '/baby-activities/:id',
      handler: 'baby-activity.findOne',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get a specific activity',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
    {
      method: 'DELETE',
      path: '/baby-activities/:id',
      handler: 'baby-activity.delete',
      config: {
        policies: [],
        middlewares: [],
        description: 'Delete a specific activity',
        tag: {
          plugin: 'baby-activity',
          name: 'Baby Activity',
        },
      },
    },
  ],
};
