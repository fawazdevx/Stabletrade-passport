// Vercel serverless entrypoint.
// Reuses the same request handler as the local Node server so the API
// behaves identically in development and on Vercel. Static assets
// (frontend/dist + architecture.html) are served by Vercel's CDN via
// outputDirectory, so this function only handles /api/* routes.
const { createRequestHandler } = require("../server/index.js");

module.exports = createRequestHandler();
