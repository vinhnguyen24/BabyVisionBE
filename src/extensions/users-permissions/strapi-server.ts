
export default (plugin) => {
  // We handle email configuration (domain and templates) in src/index.ts bootstrap
  // to ensure consistency and fix the "strapi.io" domain error.
  
  return plugin;
};
