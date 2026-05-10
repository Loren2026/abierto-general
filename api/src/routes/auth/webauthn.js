import { Router } from 'express';
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  verifyRegistration,
} from '../../controllers/auth/webauthnController.js';
import { requireSession } from '../../middleware/requireSession.js';

const router = Router();

router.post('/register/options', requireSession, createRegistrationOptions);
router.post('/register/verify', requireSession, verifyRegistration);
router.post('/authenticate/options', requireSession, createAuthenticationOptions);

export default router;
