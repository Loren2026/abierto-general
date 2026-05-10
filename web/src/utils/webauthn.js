function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '==='.slice((base64.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

export function browserSupportsWebAuthn() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

export function publicKeyOptionsFromJSON(options) {
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: options.user
      ? {
          ...options.user,
          id: fromBase64Url(options.user.id),
        }
      : undefined,
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: fromBase64Url(credential.id),
    })),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: fromBase64Url(credential.id),
    })),
  }
}

export function credentialToJSON(credential) {
  if (!credential) return null

  const response = {}

  if (credential.response?.clientDataJSON) {
    response.clientDataJSON = toBase64Url(credential.response.clientDataJSON)
  }

  if (credential.response?.attestationObject) {
    response.attestationObject = toBase64Url(credential.response.attestationObject)
  }

  if (credential.response?.authenticatorData) {
    response.authenticatorData = toBase64Url(credential.response.authenticatorData)
  }

  if (credential.response?.signature) {
    response.signature = toBase64Url(credential.response.signature)
  }

  if (credential.response?.userHandle) {
    response.userHandle = toBase64Url(credential.response.userHandle)
  }

  if (typeof credential.response?.getTransports === 'function') {
    response.transports = credential.response.getTransports()
  }

  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
    response,
  }
}

export async function createCredentialFromOptions(options) {
  return navigator.credentials.create({
    publicKey: publicKeyOptionsFromJSON(options),
  })
}

export async function getCredentialFromOptions(options) {
  return navigator.credentials.get({
    publicKey: publicKeyOptionsFromJSON(options),
  })
}
