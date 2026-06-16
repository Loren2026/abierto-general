const { config } = require('../config/env');

function getOptionsStatus() {
  return {
    enabled: config.optionsEnabled,
    status: config.optionsEnabled ? 'enabled_pending_provider' : 'blocked_no_permission',
    message: config.optionsEnabled
      ? 'OPTIONS_ENABLED=true, pero no hay integración IBKR activa en este backend.'
      : 'Opciones bloqueadas: Loren debe solicitar Nivel 2 en cuenta CASH para comprar calls/puts y coberturas, sin venta descubierta. No se llama a IBKR ni se simulan datos.',
    allowedScope: 'Compra de calls/puts y coberturas en cuenta CASH; sin venta descubierta.',
    irreversiblePending: ['Activar permisos IBKR Nivel 2', 'Configurar credenciales reales IBKR', 'Cambiar OPTIONS_ENABLED=true tras autorización']
  };
}

async function getOptionsChain() {
  const status = getOptionsStatus();
  if (!config.optionsEnabled) {
    const error = new Error(status.message);
    error.status = 403;
    error.payload = status;
    throw error;
  }
  const error = new Error('Integración IBKR no implementada: no se devuelven datos simulados.');
  error.status = 501;
  error.payload = status;
  throw error;
}

module.exports = { getOptionsStatus, getOptionsChain };
