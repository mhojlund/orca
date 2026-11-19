import { describe, expect, it } from 'vitest'
import { parseGiteaIssueOrPRLink } from './gitea-links'

const KNOWN = new Set(['code.example.com'])

describe('parseGiteaIssueOrPRLink', () => {
  it('accepts /pulls/N on any host', () => {
    expect(parseGiteaIssueOrPRLink('https://git.other.org/team/app/pulls/12', new Set())).toEqual({
      slug: { host: 'git.other.org', owner: 'team', repo: 'app' },
      number: 12,
      type: 'pr'
    })
  })

  it('accepts /issues/N only on a connected host', () => {
    expect(parseGiteaIssueOrPRLink('https://code.example.com/team/app/issues/3', KNOWN)).toEqual({
      slug: { host: 'code.example.com', owner: 'team', repo: 'app' },
      number: 3,
      type: 'issue'
    })
    expect(parseGiteaIssueOrPRLink('https://ghe.corp.com/team/app/issues/3', KNOWN)).toBeNull()
  })

  it('matches hosts case-insensitively and keeps the port', () => {
    expect(
      parseGiteaIssueOrPRLink(
        'https://Code.Example.com:3000/a/b/issues/1',
        new Set(['code.example.com:3000'])
      )?.slug.host
    ).toBe('code.example.com:3000')
  })

  it('ignores GitHub-style /pull/N and non-http links', () => {
    expect(parseGiteaIssueOrPRLink('https://github.com/a/b/pull/1', KNOWN)).toBeNull()
    expect(parseGiteaIssueOrPRLink('ssh://code.example.com/a/b/issues/1', KNOWN)).toBeNull()
  })
})
