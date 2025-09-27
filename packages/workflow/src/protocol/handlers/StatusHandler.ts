import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { StatusMessage } from '../messages/StatusMessage'
import { StatusRequestMessage } from '../messages/StatusRequestMessage'

@injectable()
export class StatusHandler implements DidCommMessageHandler {
  public supportedMessages = [StatusRequestMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<StatusHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    const thid = messageContext.message.threadId || messageContext.message.id
    const iid = messageContext.message.body?.instance_id
    logger.info('[Workflow] status request received', {
      instance_id: iid,
      thid,
      include_actions: messageContext.message.body?.include_actions,
      include_ui: messageContext.message.body?.include_ui,
    })
    try {
      const _th = messageContext.message.threadId
      const _id = messageContext.message.body?.instance_id
      if (_id && _th && _id !== _th) {
        logger.warn('[Workflow] threadId does not match instance_id', { thid: _th, instance_id: _id })
      }
    } catch {}
    try {
      const status = await this.service.status(messageContext.agentContext, {
        instance_id: messageContext.message.body.instance_id,
        include_actions: messageContext.message.body.include_actions,
        include_ui: messageContext.message.body.include_ui,
      })
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
