/**
 * Baby Profile Routes
 * Custom routes for baby profile management
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/baby-profiles/me',
      handler: 'baby-profile.me',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get current user\'s baby profiles',
        tag: {
          plugin: 'baby-profile',
          name: 'Baby Profile',
        },
      },
    },
    {
      method: 'POST',
      path: '/baby-profiles',
      handler: 'baby-profile.create',
      config: {
        policies: [],
        middlewares: [],
        description: 'Create a baby profile for current user',
        tag: {
          plugin: 'baby-profile',
          name: 'Baby Profile',
        },
      },
    },
    {
      method: 'PUT',
      path: '/baby-profiles/:id',
      handler: 'baby-profile.update',
      config: {
        policies: [],
        middlewares: [],
        description: 'Update a baby profile',
        tag: {
          plugin: 'baby-profile',
          name: 'Baby Profile',
        },
      },
    },
    {
      method: 'DELETE',
      path: '/baby-profiles/:id',
      handler: 'baby-profile.delete',
      config: {
        policies: [],
        middlewares: [],
        description: 'Delete a baby profile',
        tag: {
          plugin: 'baby-profile',
          name: 'Baby Profile',
        },
      },
    },
    {
      method: 'GET',
      path: '/baby-profiles/:id',
      handler: 'baby-profile.findOne',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get a specific baby profile',
        tag: {
          plugin: 'baby-profile',
          name: 'Baby Profile',
        },
      },
    },
  ],
};
