import { describe, expect, it } from 'vitest'
import { getOptionalGiteaIssueFlag, mergeGiteaIssueIntoLinkedItems } from './worktree-gitea-link'

const flags = (value: string | boolean) =>
  new Map<string, string | boolean>([['gitea-issue', value]])

describe('getOptionalGiteaIssueFlag', () => {
  it('turns a number or #number into a numberless-URL Gitea issue attachment', () => {
    expect(getOptionalGiteaIssueFlag(flags('42'))).toEqual({
      provider: 'gitea',
      type: 'issue',
      number: 42
    })
    expect(getOptionalGiteaIssueFlag(flags('#7'))).toEqual({
      provider: 'gitea',
      type: 'issue',
      number: 7
    })
  })

  it('reads a self-hosted issue URL as Gitea, not GitHub', () => {
    expect(getOptionalGiteaIssueFlag(flags('https://git.example.com/acme/api/issues/9'))).toEqual({
      provider: 'gitea',
      type: 'issue',
      number: 9,
      url: 'https://git.example.com/acme/api/issues/9'
    })
  })

  it('rejects pull request URLs, junk and zero', () => {
    expect(() =>
      getOptionalGiteaIssueFlag(flags('https://git.example.com/acme/api/pulls/9'))
    ).toThrow(/Gitea or Forgejo issue/)
    expect(() => getOptionalGiteaIssueFlag(flags('abc'))).toThrow(/Gitea or Forgejo issue/)
    expect(() => getOptionalGiteaIssueFlag(flags('0'))).toThrow(/Gitea or Forgejo issue/)
  })

  it('allows null only when clearing', () => {
    expect(getOptionalGiteaIssueFlag(flags('null'), { allowNull: true })).toBeNull()
    expect(() => getOptionalGiteaIssueFlag(flags('null'))).toThrow(/Omit --gitea-issue on create/)
    expect(getOptionalGiteaIssueFlag(new Map())).toBeUndefined()
  })
})

describe('mergeGiteaIssueIntoLinkedItems', () => {
  it('adds the issue beside other references without duplicating it', () => {
    const issue = { provider: 'gitea', type: 'issue', number: 3 } as const
    const pr = { provider: 'gitea', type: 'pr', number: 5 } as const
    expect(mergeGiteaIssueIntoLinkedItems([pr, issue], issue)).toEqual([pr, issue])
    expect(mergeGiteaIssueIntoLinkedItems([pr], issue)).toEqual([pr, issue])
    expect(mergeGiteaIssueIntoLinkedItems(undefined, undefined)).toBeUndefined()
  })
})
