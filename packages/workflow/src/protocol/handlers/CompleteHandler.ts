import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { CompleteMessage } from '../messages/CompleteMessage'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { StatusMessage } from '../messages/StatusMessage'

@injectable()
export class CompleteHandler implements DidCommMessageHandler {
  public supportedMessages = [CompleteMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<CompleteHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    const instId = messageContext.message.body?.instance_id
    const thid = messageContext.message.threadId || messageContext.message.id
    logger.info('[Workflow] complete received', { instance_id: instId, thid })
    try {
      await this.service.complete(messageContext.agentContext, messageContext.message.body)
      const status = await this.service.status(messageContext.agentContext, { instance_id: instId })
      const reply = new StatusMessage({ thid, body: status })
      return new DidCommOutboundMessageContext(reply, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
      })
    } catch (e) {
      // If the receiving agent doesn't host the instance, ignore silently (no problem-report)
      if ((e as { code?: string })?.code === 'invalid_event') {
        logger.info('[Workflow] complete ignored (no local instance)', { instance_id: instId })
        return undefined
      }
      if (config.enableProblemReport && messageContext.connection) {
        const pr = new ProblemReportMessage({
          thid,
          body: { code: (e as { code?: string }).code || 'action_error', comment: (e as Error).message },
        })
        return new DidCommOutboundMessageContext(pr, {
          agentContext: messageContext.agentContext,
          connection: messageContext.connection,
        })
      }
      throw e
    }
  }
}
