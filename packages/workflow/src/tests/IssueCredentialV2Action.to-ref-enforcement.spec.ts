import 'reflect-metadata'
import { IssueCredentialV2Action, WorkflowTemplate } from '..'

describe('to_ref recipient DID enforcement', () => {
  test('forbidden when theirDid mismatches participants[to_ref].did', async () => {
    const action = new IssueCredentialV2Action()
    const template: WorkflowTemplate = {
      template_id: 't',
      version: '1.0.0',
      title: 'T',
      catalog: { credential_profiles: { test: { cred_def_id: 'cd', attribute_plan: {}, to_ref: 'holder' } } },
      instance_policy: {
        mode: 'singleton_per_connection',
        multiplicity_key: undefined,
      },
      states: [],
      transitions: [],
      actions: [],
    }
    const instance = {
      connection_id: 'c1',
      participants: { holder: { did: 'did:example:holder' } },
      context: {},
      state: 's',
      artifacts: {},
      history: [],
    }
    const actionDef: import('..').ActionDef = {
      key: 'k',
      typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential',
      profile_ref: 'cp.test',
    }
    const ctx = {
      agentContext: {
        dependencyManager: {
          resolve: (ctor: unknown) => {
            const name = (ctor as { name?: string })?.name || ''
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
    } as unknown as import('..').ActionCtx
    await expect(action.execute(ctx)).rejects.toHaveProperty('code', 'forbidden')
  })
})
