import { describe, expect, it } from 'vitest'
import { filterMobileSupportedTaskProviders } from './mobile-task-provider-support'

describe('filterMobileSupportedTaskProviders', () => {
  it('drops Gitea but keeps the rest in order', () => {
    expect(filterMobileSupportedTaskProviders(['github', 'gitea', 'linear'])).toEqual([
      'github',
      'linear'
    ])
  })

  it('falls back to GitHub when only Gitea was visible', () => {
    expect(filterMobileSupportedTaskProviders(['gitea'])).toEqual(['github'])
  })
})
