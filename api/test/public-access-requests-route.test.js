import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import publicAccessRequestRoutes from '../src/routes/public/accessRequests.js'
import publicProjectRoutes from '../src/routes/public/projects.js'

function buildTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', publicAccessRequestRoutes)
  app.use('/api', publicProjectRoutes)
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
  return app
}

function routeExists(app, method, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const { port } = server.address()
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        resolve(response.status !== 404)
      } catch (error) {
        reject(error)
      } finally {
        server.close()
      }
    })
  })
}

test('POST /api/projects/:slug/access-requests reaches a mounted route', async () => {
  const app = buildTestApp()
  const exists = await routeExists(app, 'POST', '/api/projects/fit-loren/access-requests')
  assert.equal(exists, true)
})
