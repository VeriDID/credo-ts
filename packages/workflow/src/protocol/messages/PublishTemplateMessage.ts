import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import type { WorkflowTemplate } from '../../model/types'

export class PublishTemplateMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/publish-template')

  @IsValidMessageType(PublishTemplateMessage.type)
  public type = PublishTemplateMessage.type.messageTypeUri

  public body!: { template: WorkflowTemplate; mode?: 'upsert' }

  public constructor(options?: { id?: string; body: { template: WorkflowTemplate; mode?: 'upsert' } }) {
    super()
    this.type = PublishTemplateMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
    }
  }
}
