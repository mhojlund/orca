import { defineFixture } from '../../../component-fixtures/component-fixture'
import { GiteaInstanceDialog } from './gitea-instance-dialog'

export const addInstance = defineFixture({
  width: 640,
  render: () => <GiteaInstanceDialog open onOpenChange={() => {}} />
})

export const replaceToken = defineFixture({
  width: 640,
  render: () => (
    <GiteaInstanceDialog
      open
      lockBaseUrl
      initialBaseUrl="https://codeberg.org"
      onOpenChange={() => {}}
    />
  )
})
