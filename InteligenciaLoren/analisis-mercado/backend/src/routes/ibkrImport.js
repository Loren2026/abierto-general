const express = require('express');
const multer = require('multer');
const { importIbkrReport } = require('../services/ibkrImportService');

const router = express.Router();
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1
  },
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

router.post('/import', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      const status = uploadError.status || (uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      const message = uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite de 20 MB.'
        : uploadError.message || 'No se pudo recibir el archivo IBKR.';

      console.error('[ibkr-import] upload rejected', {
        message,
        status,
        code: uploadError.code,
        contentLength: req.get('content-length')
      });

      res.status(status).json({ status: 'error', message, provider: 'ibkr-import' });
      return;
    }

    if (!req.file) {
      console.error('[ibkr-import] missing file field', {
        contentLength: req.get('content-length')
      });
      res.status(400).json({ status: 'error', message: 'Falta el archivo en el campo file.', provider: 'ibkr-import' });
      return;
    }

    console.log('[ibkr-import] file received', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    try {
      const result = await importIbkrReport(req.file);

      console.log('[ibkr-import] import completed', {
        positions: result.positions.length,
        cash: result.cash.length,
        reportDate: result.reportDate
      });

      res.json({ status: 'ok', ...result });
    } catch (error) {
      console.error('[ibkr-import] POST /api/ibkr/import failed', {
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
        message: error.message || 'Error importando informe IBKR.',
        provider: error.provider || 'ibkr-import'
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
