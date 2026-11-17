import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const GiteaInstanceConnect = z.object({
  baseUrl: requiredString('Missing instance URL'),
  token: requiredString('Missing token')
})

export const GiteaInstanceDisconnect = z.object({
  instanceId: requiredString('Missing instance id')
})
