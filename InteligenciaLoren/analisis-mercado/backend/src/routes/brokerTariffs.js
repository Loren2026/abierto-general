const express = require('express');
const multer = require('multer');
const { extractBrokerTariffs } = require('../services/brokerTariffService');

const router = express.Router();
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Tipo de archivo no permitido. Sube PDF, JPG o PNG.');
      error.status = 400;
      error.code = 'UNSUPPORTED_MEDIA_TYPE';
      callback(error);
      return;
    }

    callback(null, true);
  }
});

router.post('/tariffs', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      const status = uploadError.status || (uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      const message = uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite de 20 MB.'
        : uploadError.message || 'No se pudo recibir el documento de tarifas.';

      console.error('[broker-tariffs] upload rejected', {
        message,
        status,
        code: uploadError.code,
        contentLength: req.get('content-length')
      });

      res.status(status).json({ status: 'error', message, provider: 'broker-tariffs' });
      return;
    }

    if (!req.file) {
      console.error('[broker-tariffs] missing file field', {
        contentLength: req.get('content-length')
      });
      res.status(400).json({ status: 'error', message: 'Falta el archivo en el campo file.', provider: 'broker-tariffs' });
      return;
    }

    console.log('[broker-tariffs] file received', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    try {
      const tariffs = await extractBrokerTariffs(req.file);
      console.log('[broker-tariffs] extraction completed', {
        originalname: req.file.originalname,
        keys: Object.keys(tariffs || {}).length
      });
      res.json({ status: 'ok', tariffs });
    } catch (error) {
      console.error('[broker-tariffs] POST /api/broker/tariffs failed', {
        message: error.message,
        stack: error.stack,
        status: error.status,
        code: error.code,
        provider: error.provider,
        providerStatus: error.providerStatus,
        providerBody: truncateProviderBody(error.providerBody),
        file: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });

      res.status(error.status || 502).json({
        status: 'error',
        message: error.message || 'Error leyendo tarifas del broker.',
        provider: error.provider || 'broker-tariffs'
      });
    }
  });
});

function truncateProviderBody(value) {
  if (!value) return value;
  if (typeof value === 'string') return value.slice(0, 1200);
  return JSON.stringify(value).slice(0, 1200);
}

module.exports = router;
