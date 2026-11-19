import { describe, expect, it } from 'vitest'
import { resolveConfiguredDefaultTaskProvider, type TaskProvider } from './task-providers'

const ALL: TaskProvider[] = ['github', 'gitlab', 'gitea', 'linear', 'jira']

describe('resolveConfiguredDefaultTaskProvider', () => {
  it('moves off an unconfigured GitHub default to the first configured provider', () => {
    expect(resolveConfiguredDefaultTaskProvider('github', ALL, new Set(['gitea', 'jira']))).toBe(
      'gitea'
    )
  })

  it('keeps GitHub when it is configured', () => {
    expect(resolveConfiguredDefaultTaskProvider('github', ALL, new Set(['github', 'gitea']))).toBe(
      'github'
    )
  })

  it('keeps GitHub while provider status is unknown', () => {
    expect(resolveConfiguredDefaultTaskProvider('github', ALL, null)).toBe('github')
  })

  it('keeps GitHub when nothing is configured', () => {
    expect(resolveConfiguredDefaultTaskProvider('github', ALL, new Set())).toBe('github')
  })

  it('skips configured providers that are hidden', () => {
    expect(
      resolveConfiguredDefaultTaskProvider(
        'github',
        ['github', 'linear'],
        new Set(['gitea', 'linear'])
      )
    ).toBe('linear')
  })

  it('never overrides a non-GitHub default', () => {
    expect(resolveConfiguredDefaultTaskProvider('linear', ALL, new Set(['gitea']))).toBe('linear')
  })
})
