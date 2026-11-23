import { describe, expect, it } from 'vitest'
import { createRsBuildVersion, pickLatestStableVersion } from './build-mac-local.mjs'

describe('Orca RS build version', () => {
  it('picks the numerically highest stable tag and ignores RCs and other tags', () => {
    const lsRemote = [
      'a\trefs/tags/v1.4.9',
      'b\trefs/tags/v1.4.272',
      'c\trefs/tags/v1.4.273-rc.2',
      'd\trefs/tags/v1.10.0',
      'e\trefs/tags/mobile-ios-v9.9.9'
    ].join('\n')
    expect(pickLatestStableVersion(lsRemote)).toBe('1.10.0')
    expect(pickLatestStableVersion('x\trefs/tags/v1.4.273-rc.2')).toBeNull()
  })

  it('suffixes the base version with -rs and rejects non-stable bases', () => {
    expect(createRsBuildVersion('1.4.272')).toBe('1.4.272-rs')
    expect(() => createRsBuildVersion('1.4.272-rc.1')).toThrow()
  })
})
