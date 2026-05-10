import { Router } from 'express';
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  exchangeWebAuthnToken,
  verifyAuthentication,
  verifyRegistration,
} from '../../controllers/auth/webauthnController.js';
import { requireSession } from '../../middleware/requireSession.js';

const router = Router();

router.post('/register/options', requireSession, createRegistrationOptions);
router.post('/register/verify', requireSession, verifyRegistration);
router.post('/authenticate/options', requireSession, createAuthenticationOptions);
router.post('/authenticate/verify', verifyAuthentication);
router.post('/exchange', exchangeWebAuthnToken);

export default router;
