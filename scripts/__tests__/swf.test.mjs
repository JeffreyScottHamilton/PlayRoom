// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseSwfHeader, SwfError } from '../lib/swf.mjs'
import { buildSwf } from './fixtures.mjs'

describe('parseSwfHeader', () => {
  it('reads version, stage size and frame data from an uncompressed FWS file', () => {
    const header = parseSwfHeader(buildSwf({ sig: 'FWS', version: 10, width: 550, height: 400, frameRate: 24, frames: 3 }))
    expect(header).toMatchObject({
      signature: 'FWS',
      version: 10,
      width: 550,
      height: 400,
      frameRate: 24,
      frameCount: 3,
      needsReview: false,
    })
  })

  it('reads the stage RECT from a zlib-compressed CWS file', () => {
    const header = parseSwfHeader(buildSwf({ sig: 'CWS', version: 8, width: 550, height: 400 }))
    expect(header).toMatchObject({ signature: 'CWS', version: 8, width: 550, height: 400, needsReview: false })
  })

  it('still reads the RECT when the compressed body is larger than the inflate bound', () => {
    const header = parseSwfHeader(buildSwf({ sig: 'CWS', version: 9, width: 800, height: 600, padBytes: 200 * 1024 }))
    expect(header).toMatchObject({ signature: 'CWS', version: 9, width: 800, height: 600 })
  })

  it('marks ZWS (LZMA) files as needs-review without a stage size', () => {
    const zws = buildSwf({ sig: 'FWS', version: 13 })
    zws.write('ZWS', 0, 'latin1')
    const header = parseSwfHeader(zws)
    expect(header).toMatchObject({ signature: 'ZWS', version: 13, needsReview: true, width: null, height: null })
  })

  it('rejects bytes that are not an SWF', () => {
    expect(() => parseSwfHeader(Buffer.from('PNG-not-a-swf-file'))).toThrow(SwfError)
    expect(() => parseSwfHeader(Buffer.from('FWS'))).toThrow(/too short/)
  })

  it('rejects a truncated uncompressed header', () => {
    const full = buildSwf({ sig: 'FWS' })
    expect(() => parseSwfHeader(full.subarray(0, 10))).toThrow(SwfError)
  })

  it('rejects a corrupt CWS body', () => {
    const bad = Buffer.concat([Buffer.from('CWS'), Buffer.from([8, 0, 0, 0, 0]), Buffer.from('not zlib data at all')])
    expect(() => parseSwfHeader(bad)).toThrow(/corrupt zlib/)
  })
})
