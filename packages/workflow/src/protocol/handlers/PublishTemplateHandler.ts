import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommOutboundMessageContext } from '@credo-ts/didcomm'
import { WorkflowModuleConfig } from '../../WorkflowModuleConfig'
import { WorkflowService } from '../../services/WorkflowService'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'
import { PublishTemplateMessage } from '../messages/PublishTemplateMessage'

@injectable()
export class PublishTemplateHandler implements DidCommMessageHandler {
  public supportedMessages = [PublishTemplateMessage]
  public constructor(private readonly service: WorkflowService) {}
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<PublishTemplateHandler>) {
    const dm = messageContext.agentContext.dependencyManager
    const logger = dm.resolve(AgentConfig).logger
    const config = dm.resolve(WorkflowModuleConfig)
    logger.info('[Workflow] publish-template received')
    try {
      await this.service.publishTemplate(messageContext.agentContext, messageContext.message.body.template)
      return
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
