import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { CancelMessage } from '../messages/CancelMessage'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { StatusMessage } from '../messages/StatusMessage'

@injectable()
export class CancelHandler implements DidCommMessageHandler {
  public supportedMessages = [CancelMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<CancelHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    const instId = messageContext.message.body?.instance_id
    const thid = messageContext.message.threadId || messageContext.message.id
    logger.info('[Workflow] cancel received', { instance_id: instId, thid })
    try {
      await this.service.cancel(messageContext.agentContext, messageContext.message.body)
      const instId = messageContext.message.body.instance_id
      const status = await this.service.status(messageContext.agentContext, { instance_id: instId })
      const reply = new StatusMessage({
        thid: messageContext.message.threadId || messageContext.message.id,
        body: status,
      })
      return new DidCommOutboundMessageContext(reply, {
        agentContext: messageContext.agentContext,
        connection: messageContext.connection,
      })
    } catch (e) {
      if ((e as { code?: string })?.code === 'invalid_event') {
        logger.info('[Workflow] cancel ignored (no local instance)', { instance_id: instId })
        return undefined
      }
      if (config.enableProblemReport && messageContext.connection) {
        const pr = new ProblemReportMessage({
          thid: messageContext.message.threadId || messageContext.message.id,
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
