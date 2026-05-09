import { Router } from 'express'
import {
  getPublicProject,
  listPublicProjects,
} from '../../controllers/public/projectsController.js'

const router = Router()

router.get('/projects', listPublicProjects)
router.get('/projects/:slug', getPublicProject)

export default router
