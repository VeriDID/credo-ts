import type { AgentContext } from '@credo-ts/core'
import { IssueCredentialV2Action } from '..'
import type { ActionCtx, ActionDef, WorkflowInstanceData, WorkflowTemplate } from '..'

describe('IssueCredentialV2Action', () => {
  test('missing profile and connection errors, and wraps thrown errors', async () => {
    const action = new IssueCredentialV2Action()
    const template = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: { credential_profiles: {} },
    } as unknown as WorkflowTemplate
    const baseCtx = {
      agentContext: { dependencyManager: { resolve: () => ({}) } } as unknown as AgentContext,
      template,
      instance: { connection_id: 'c1', participants: {} } as unknown as WorkflowInstanceData,
    }
    // missing profile
    await expect(
      action.execute({
        ...(baseCtx as unknown as ActionCtx),
        action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.missing' } as ActionDef,
      })
    ).rejects.toHaveProperty('code', 'action_error')
    // missing connection id
    await expect(
      action.execute({
        ...(baseCtx as unknown as ActionCtx),
        instance: { participants: {} } as unknown as WorkflowInstanceData,
        action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.missing' } as ActionDef,
      })
    ).rejects.toHaveProperty('code', 'action_error')
    // wrap thrown error from creds api
    const tpl2 = {
      template_id: 't',
      version: '1',
      title: 'T',
      catalog: { credential_profiles: { test: { cred_def_id: 'C', attribute_plan: {}, to_ref: 'holder' } } },
    } as unknown as WorkflowTemplate
    const credsApi = {
      offerCredential: jest.fn(async () => {
        throw new Error('boom')
      }),
    }
    const ctx2: ActionCtx = {
      agentContext: { dependencyManager: { resolve: () => credsApi } } as unknown as AgentContext,
      template: tpl2,
      instance: { connection_id: 'c1', participants: {} } as unknown as WorkflowInstanceData,
      action: { key: 'a', typeURI: action.typeUri, profile_ref: 'cp.test' } as ActionDef,
    }
    await expect(action.execute(ctx2)).rejects.toHaveProperty('code', 'action_error')
  })
})
