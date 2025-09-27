import 'reflect-metadata'
import { IssueCredentialV2Action } from '..'

describe('to_ref recipient DID enforcement', () => {
  test('forbidden when theirDid mismatches participants[to_ref].did', async () => {
    const action = new IssueCredentialV2Action()
    const template: any = {
      template_id: 't',
      version: '1.0.0',
      title: 'T',
      catalog: { credential_profiles: { test: { cred_def_id: 'cd', attribute_plan: {}, to_ref: 'holder' } } },
    }
    const instance: any = {
      connection_id: 'c1',
      participants: { holder: { did: 'did:example:holder' } },
      context: {},
      state: 's',
      artifacts: {},
      history: [],
    }
    const actionDef: any = {
      key: 'k',
      typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential',
      profile_ref: 'cp.test',
    }
    const ctx: any = {
      agentContext: {
        dependencyManager: {
          resolve: (ctor: any) => {
            const name = ctor?.name || ''
            if (name.includes('ConnectionService'))
              return { getById: async () => ({ theirDid: 'did:example:someone-else' }) }
            if (name.includes('CredentialsApi'))
              return {
                offerCredential: async () => {
                  throw new Error('should-not-send')
                },
              }
            return {}
          },
        },
      },
      template,
      instance,
      action: actionDef,
    }
    await expect(action.execute(ctx)).rejects.toHaveProperty('code', 'forbidden')
  })
})
