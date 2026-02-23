// Vercel serverless: forward all /api and /api/* to the backend request handler
const handler = require('../backend/server');

module.exports = (req, res) => {
    // Reconstruct path for backend (e.g. /api, /api/health, /api/auth/login)
    const pathSegments = req.query.path;
    const path = Array.isArray(pathSegments) ? pathSegments.join('/') : (pathSegments || '');
    req.url = '/api' + (path ? '/' + path : '');
    return handler(req, res);
};
