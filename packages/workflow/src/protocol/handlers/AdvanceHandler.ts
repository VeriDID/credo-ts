import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { AdvanceMessage } from '../messages/AdvanceMessage'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { StatusMessage } from '../messages/StatusMessage'

@injectable()
export class AdvanceHandler implements DidCommMessageHandler {
  public supportedMessages = [AdvanceMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<AdvanceHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    const thid = messageContext.message.threadId || messageContext.message.id
    const { instance_id, event } = messageContext.message.body || {}
    logger.info('[Workflow] advance received', { instance_id, event, thid })
    try {
      const _th = messageContext.message.threadId
      const _id = messageContext.message.body?.instance_id
      if (_id && _th && _id !== _th) {
        logger.warn('[Workflow] threadId does not match instance_id', { thid: _th, instance_id: _id })
      }
    } catch {}
    try {
      await this.service.advance(messageContext.agentContext, messageContext.message.body)
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
