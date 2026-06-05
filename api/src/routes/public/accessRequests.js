import { Router } from 'express'
import { createPublicAccessRequest } from '../../controllers/public/accessRequestsController.js'

const router = Router()

router.post('/projects/:slug/access-requests', createPublicAccessRequest)

export default router
