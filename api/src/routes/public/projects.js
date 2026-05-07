import { Router } from 'express'
import {
  getPublicProject,
  getPublicProjectVersion,
  listPublicProjects,
} from '../../controllers/public/projectsController.js'

const router = Router()

router.get('/projects', listPublicProjects)
router.get('/projects/:slug', getPublicProject)
router.get('/projects/:slug/version', getPublicProjectVersion)

export default router
