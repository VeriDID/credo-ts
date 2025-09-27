import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { StartMessage } from '../messages/StartMessage'
import { StatusMessage } from '../messages/StatusMessage'

@injectable()
export class StartHandler implements DidCommMessageHandler {
  public supportedMessages = [StartMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<StartHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    const thid = messageContext.message.threadId || messageContext.message.id
    const iid = messageContext.message.body?.instance_id
    logger.info('[Workflow] start received', {
      template_id: messageContext.message.body?.template_id,
      instance_id: iid,
      thid,
    })
    try {
      const _th = messageContext.message.threadId
      const _id = messageContext.message.body?.instance_id
      if (_id && _th && _id !== _th) {
        logger.warn('[Workflow] threadId does not match instance_id', { thid: _th, instance_id: _id })
      }
    } catch {}
    try {
      const rec = await this.service.start(messageContext.agentContext, messageContext.message.body)
      const status = await this.service.status(messageContext.agentContext, { instance_id: rec.instanceId })
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
          body: { code: (e as any).code || 'action_error', comment: (e as Error).message },
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
