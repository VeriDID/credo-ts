import { IssueCredentialV2Action } from '..'

describe('IssueCredentialV2Action', () => {
  test('missing profile and connection errors, and wraps thrown errors', async () => {
    const action = new IssueCredentialV2Action()
    const template: any = { template_id: 't', version: '1', title: 'T', catalog: { credential_profiles: {} } }
    const baseCtx: any = {
      agentContext: { dependencyManager: { resolve: () => ({}) } },
      template,
      instance: { connection_id: 'c1', participants: {} },
    }
    // missing profile
    await expect(
      action.execute({ ...baseCtx, action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.missing' } } as any)
    ).rejects.toHaveProperty('code', 'action_error')
    // missing connection id
    await expect(
      action.execute({
        ...baseCtx,
        instance: { participants: {} },
        action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.missing' },
      } as any)
    ).rejects.toHaveProperty('code', 'action_error')
    // wrap thrown error from creds api
    const tpl2: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: { credential_profiles: { test: { cred_def_id: 'C', attribute_plan: {}, to_ref: 'holder' } } },
    }
    const credsApi = {
      offerCredential: jest.fn(async () => {
        throw new Error('boom')
      }),
    }
    const ctx2: any = {
      agentContext: { dependencyManager: { resolve: () => credsApi } },
      template: tpl2,
      instance: { connection_id: 'c1', participants: {} },
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.test' },
    }
    await expect(action.execute(ctx2)).rejects.toHaveProperty('code', 'action_error')
  })
})
