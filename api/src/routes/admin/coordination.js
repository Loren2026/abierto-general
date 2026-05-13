import { Router } from 'express'
import {
  createThread,
  createThreadConsultation,
  createThreadMessage,
  getThread,
  listThreadConsultations,
  listThreadMessages,
  listThreads,
  respondConsultation,
} from '../../controllers/admin/coordinationController.js'

const router = Router()

router.get('/coordination/threads', listThreads)
router.post('/coordination/threads', createThread)
router.get('/coordination/threads/:threadId', getThread)
router.get('/coordination/threads/:threadId/messages', listThreadMessages)
router.post('/coordination/threads/:threadId/messages', createThreadMessage)
router.get('/coordination/threads/:threadId/consultations', listThreadConsultations)
router.post('/coordination/threads/:threadId/consultations', createThreadConsultation)
router.post('/coordination/consultations/:consultationId/respond', respondConsultation)

export default router
