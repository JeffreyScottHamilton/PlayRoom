// SWF header parser (Node stdlib only). Reads the signature, version and the
// stage RECT (in twips, 1/20 px) from FWS (uncompressed) and CWS (zlib) files.
// ZWS (LZMA) cannot be decoded without a dependency, so it is reported as
// needs-review with null stage size.
import { constants as zlibConstants, inflateSync } from 'node:zlib'

// The stage RECT and frame rate sit at the very start of the body, so only a
// bounded prefix of the compressed stream needs to be inflated.
const MAX_COMPRESSED_BYTES = 64 * 1024
const SIGNATURES = ['FWS', 'CWS', 'ZWS']

export class SwfError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SwfError'
  }
}

class BitReader {
  constructor(buf) {
    this.buf = buf
    this.bitPos = 0
  }

  read(n) {
    let value = 0
    for (let i = 0; i < n; i++) {
      const byte = this.buf[this.bitPos >> 3]
      if (byte === undefined) throw new SwfError('SWF header is truncated')
      value = value * 2 + ((byte >> (7 - (this.bitPos & 7))) & 1)
      this.bitPos++
    }
    return value
  }

  readSigned(n) {
    if (n === 0) return 0
    const value = this.read(n)
    return value >= 2 ** (n - 1) ? value - 2 ** n : value
  }

  alignedByteOffset() {
    return (this.bitPos + 7) >> 3
  }
}

/**
 * Parses an SWF header from a Buffer (or byte array).
 * Returns { signature, version, fileLength, needsReview, width, height, frameRate, frameCount }.
 * width/height are integer pixels from the stage RECT; null for ZWS.
 * Throws SwfError when the bytes are not an SWF or the header is corrupt.
 */
export function parseSwfHeader(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (buf.length < 8) throw new SwfError('file is too short to be an SWF')

  const signature = buf.toString('latin1', 0, 3)
  if (!SIGNATURES.includes(signature)) {
    throw new SwfError(`not an SWF (signature ${JSON.stringify(signature)})`)
  }
  const version = buf[3]
  const fileLength = buf.readUInt32LE(4)

  if (signature === 'ZWS') {
    return {
      signature,
      version,
      fileLength,
      needsReview: true,
      width: null,
      height: null,
      frameRate: null,
      frameCount: null,
    }
  }

  let body = buf.subarray(8)
  if (signature === 'CWS') {
    try {
      body = inflateSync(body.subarray(0, MAX_COMPRESSED_BYTES), {
        finishFlush: zlibConstants.Z_SYNC_FLUSH,
      })
    } catch (err) {
      throw new SwfError(`corrupt zlib body: ${err.message}`)
    }
  }

  const reader = new BitReader(body)
  const nbits = reader.read(5)
  const xmin = reader.readSigned(nbits)
  const xmax = reader.readSigned(nbits)
  const ymin = reader.readSigned(nbits)
  const ymax = reader.readSigned(nbits)
  const rectEnd = reader.alignedByteOffset()

  // Frame rate is UI16 little-endian 8.8 fixed point; frame count is UI16 LE.
  const hasFrameFields = rectEnd + 4 <= body.length
  const frameRate = hasFrameFields ? body.readUInt16LE(rectEnd) / 256 : null
  const frameCount = hasFrameFields ? body.readUInt16LE(rectEnd + 2) : null

  return {
    signature,
    version,
    fileLength,
    needsReview: false,
    width: Math.round((xmax - xmin) / 20),
    height: Math.round((ymax - ymin) / 20),
    frameRate,
    frameCount,
  }
}
