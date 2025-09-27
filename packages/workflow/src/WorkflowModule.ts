import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'
import { AgentConfig, EventEmitter } from '@credo-ts/core'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialStateChangedEvent,
  DidCommFeatureRegistry,
  DidCommMessageHandlerRegistry,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProofStateChangedEvent,
  DidCommProtocol,
} from '@credo-ts/didcomm'
import { WorkflowModuleConfig, WorkflowModuleConfigOptions } from './WorkflowModuleConfig'
import { WorkflowApi } from './api/WorkflowApi'
import { AdvanceHandler } from './protocol/handlers/AdvanceHandler'
import { CancelHandler } from './protocol/handlers/CancelHandler'
import { CompleteHandler } from './protocol/handlers/CompleteHandler'
import { PauseHandler } from './protocol/handlers/PauseHandler'
import { ProblemReportHandler } from './protocol/handlers/ProblemReportHandler'
import { PublishTemplateHandler } from './protocol/handlers/PublishTemplateHandler'
import { ResumeHandler } from './protocol/handlers/ResumeHandler'
import { StartHandler } from './protocol/handlers/StartHandler'
import { StatusHandler } from './protocol/handlers/StatusHandler'
import { WorkflowInstanceRepository } from './repository/WorkflowInstanceRepository'
import { WorkflowTemplateRepository } from './repository/WorkflowTemplateRepository'
import { WorkflowService } from './services/WorkflowService'

export const WORKFLOW_PROTOCOL_URI = 'https://didcomm.org/workflow/1.0'
export const WORKFLOW_ROLES = ['processor', 'coordinator'] as const

export class WorkflowModule implements Module {
  public readonly api = WorkflowApi
  public readonly config: WorkflowModuleConfig

  public constructor(options?: WorkflowModuleConfigOptions) {
    this.config = new WorkflowModuleConfig(options)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.resolve(AgentConfig).logger.info('Registering WorkflowModule')
    dependencyManager.registerInstance(WorkflowModuleConfig, this.config)

    dependencyManager.registerSingleton(WorkflowTemplateRepository)
    dependencyManager.registerSingleton(WorkflowInstanceRepository)
    dependencyManager.registerSingleton(WorkflowService)
    dependencyManager.registerSingleton(WorkflowApi)

    dependencyManager.registerSingleton(PublishTemplateHandler)
    dependencyManager.registerSingleton(StartHandler)
    dependencyManager.registerSingleton(AdvanceHandler)
    dependencyManager.registerSingleton(StatusHandler)
    dependencyManager.registerSingleton(ProblemReportHandler)
    dependencyManager.registerSingleton(PauseHandler)
    dependencyManager.registerSingleton(ResumeHandler)
    dependencyManager.registerSingleton(CancelHandler)
    dependencyManager.registerSingleton(CompleteHandler)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const dm = agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const features = dm.resolve(DidCommFeatureRegistry)
    const handlers = dm.resolve(DidCommMessageHandlerRegistry)
    logger.info('Initializing WorkflowModule - registering workflow/1.0 protocol')
    try {
      features.register(new DidCommProtocol({ id: WORKFLOW_PROTOCOL_URI, roles: [...WORKFLOW_ROLES] }))
    } catch {}
    handlers.registerMessageHandler(dm.resolve(PublishTemplateHandler))
    handlers.registerMessageHandler(dm.resolve(StartHandler))
    handlers.registerMessageHandler(dm.resolve(AdvanceHandler))
    handlers.registerMessageHandler(dm.resolve(StatusHandler))
    handlers.registerMessageHandler(dm.resolve(ProblemReportHandler))
    handlers.registerMessageHandler(dm.resolve(PauseHandler))
    handlers.registerMessageHandler(dm.resolve(ResumeHandler))
    handlers.registerMessageHandler(dm.resolve(CancelHandler))
    handlers.registerMessageHandler(dm.resolve(CompleteHandler))
    // Inbound mapping: credentials/proofs → workflow events
    const events = dm.resolve(EventEmitter)
    const service = dm.resolve(WorkflowService)
    events.on<DidCommCredentialStateChangedEvent>(
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      async (e) => {
        const rec = e.payload.credentialExchangeRecord
        const connId = rec.connectionId
        if (!connId) return
        if (rec.state === DidCommCredentialState.RequestReceived) {
          await service.autoAdvanceByConnection(agentContext, connId, 'request_received')
        } else if (rec.state === DidCommCredentialState.Done) {
          await service.autoAdvanceByConnection(agentContext, connId, 'issued_ack')
        }
      }
    )
    events.on<DidCommProofStateChangedEvent>(DidCommProofEventTypes.ProofStateChanged, async (e) => {
      const rec = e.payload.proofRecord
      const connId = rec.connectionId
      if (!connId) return
      if (rec.state === DidCommProofState.PresentationReceived) {
        await service.autoAdvanceByConnection(agentContext, connId, 'presentation_received')
      } else if (rec.state === DidCommProofState.Done) {
        await service.autoAdvanceByConnection(agentContext, connId, 'verified_ack')
      }
    })
  }
}
