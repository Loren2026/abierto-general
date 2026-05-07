import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateProjectPassword(length = 8) {
  let password = ''
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, ALPHABET.length)
    password += ALPHABET[index]
  }
  return password
}

export async function hashProjectPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function compareProjectPassword(password, hash) {
  return bcrypt.compare(password, hash)
}
