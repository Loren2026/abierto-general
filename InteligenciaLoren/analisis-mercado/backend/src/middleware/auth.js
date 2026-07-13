const { config } = require('../config/env');

function requirePersistenceAuth(req, res, next) {
  if (!config.persistenceAuthToken) {
    return res.status(503).json({ status: 'error', message: 'Endpoint no configurado: falta ANALISIS_PERSISTENCE_TOKEN.' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-analisis-token'];

  if (!token || token !== config.persistenceAuthToken) {
    return res.status(401).json({ status: 'error', message: 'No autorizado.' });
  }

  next();
}

module.exports = { requirePersistenceAuth };
