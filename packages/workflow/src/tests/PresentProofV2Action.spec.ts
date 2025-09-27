import { PresentProofV2Action } from '..'

describe('PresentProofV2Action', () => {
  test('builds predicates and wraps errors', async () => {
    const action = new PresentProofV2Action()
    const template: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: {
        proof_profiles: {
          test: {
            schema_id: 'S',
            requested_attributes: ['name'],
            requested_predicates: [{ name: 'age', p_type: '>=', p_value: 18 }],
            to_ref: 'holder',
          },
        },
      },
    }
    const okApi = {
      requestProof: jest.fn(async () => ({ id: 'r1' })),
      findRequestMessage: jest.fn(async () => ({ message: { id: 'm1' } })),
    }
    const ctxOk: any = {
      agentContext: { dependencyManager: { resolve: () => okApi } },
      template,
      instance: { connection_id: 'c1', participants: {} },
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' },
    }
    const res = await action.execute(ctxOk)
    expect(res.artifacts?.proofRecordId).toBe('r1')

    const badApi = {
      requestProof: jest.fn(async () => {
        throw new Error('nope')
      }),
    }
    const ctxBad: any = {
      agentContext: { dependencyManager: { resolve: () => badApi } },
      template,
      instance: { connection_id: 'c1', participants: {} },
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' },
    }
    await expect(action.execute(ctxBad)).rejects.toHaveProperty('code', 'action_error')
  })

  test('without restriction (no schema_id/cred_def_id)', async () => {
    const action = new PresentProofV2Action()
    const template: any = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: {
        proof_profiles: { test: { requested_attributes: ['name'], requested_predicates: [], to_ref: 'holder' } },
      },
    }
    const proofsApi = {
      requestProof: jest.fn(async () => ({ id: 'r2' })),
      findRequestMessage: jest.fn(async () => ({ message: { id: 'm2' } })),
    }
    const ctx: any = {
      agentContext: { dependencyManager: { resolve: () => proofsApi } },
      template,
      instance: { connection_id: 'c1', participants: {} },
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' },
    }
    const res = await action.execute(ctx)
    expect(res.artifacts?.proofRecordId).toBe('r2')
    expect(proofsApi.requestProof).toHaveBeenCalled()
  })
})
