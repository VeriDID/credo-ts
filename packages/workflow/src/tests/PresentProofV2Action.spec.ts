import type { AgentContext } from '@credo-ts/core'
import { PresentProofV2Action } from '..'
import type { ActionCtx, ActionDef, WorkflowInstanceData, WorkflowTemplate } from '..'

describe('PresentProofV2Action', () => {
  test('builds predicates and wraps errors', async () => {
    const action = new PresentProofV2Action()
    const template = {
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
    } as unknown as WorkflowTemplate
    const okApi = {
      requestProof: jest.fn(async () => ({ id: 'r1' })),
      findRequestMessage: jest.fn(async () => ({ message: { id: 'm1' } })),
    }
    const ctxOk: ActionCtx = {
      agentContext: { dependencyManager: { resolve: () => okApi } } as unknown as AgentContext,
      template,
      instance: { connection_id: 'c1', participants: {} } as unknown as WorkflowInstanceData,
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' } as ActionDef,
    }
    const res = await action.execute(ctxOk)
    expect(res.artifacts?.proofRecordId).toBe('r1')

    const badApi = {
      requestProof: jest.fn(async () => {
        throw new Error('nope')
      }),
    }
    const ctxBad: ActionCtx = {
      agentContext: { dependencyManager: { resolve: () => badApi } } as unknown as AgentContext,
      template,
      instance: { connection_id: 'c1', participants: {} } as unknown as WorkflowInstanceData,
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' } as ActionDef,
    }
    await expect(action.execute(ctxBad)).rejects.toHaveProperty('code', 'action_error')
  })

  test('without restriction (no schema_id/cred_def_id)', async () => {
    const action = new PresentProofV2Action()
    const template = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: {
        proof_profiles: { test: { requested_attributes: ['name'], requested_predicates: [], to_ref: 'holder' } },
      },
    } as unknown as WorkflowTemplate
    const proofsApi = {
      requestProof: jest.fn(async () => ({ id: 'r2' })),
      findRequestMessage: jest.fn(async () => ({ message: { id: 'm2' } })),
    }
    const ctx: ActionCtx = {
      agentContext: { dependencyManager: { resolve: () => proofsApi } } as unknown as AgentContext,
      template,
      instance: { connection_id: 'c1', participants: {} } as unknown as WorkflowInstanceData,
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'pp.test' } as ActionDef,
    }
    const res = await action.execute(ctx)
    expect(res.artifacts?.proofRecordId).toBe('r2')
    expect(proofsApi.requestProof).toHaveBeenCalled()
  })
})
