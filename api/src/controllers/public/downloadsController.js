export async function requestProtectedDownload(req, res) {
  return res.status(501).json({ error: 'Not implemented', endpoint: 'requestProtectedDownload' })
}
