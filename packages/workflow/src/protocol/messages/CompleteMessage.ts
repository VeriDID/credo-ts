import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class CompleteMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/complete')

  @IsValidMessageType(CompleteMessage.type)
  public type = CompleteMessage.type.messageTypeUri

  public body!: { instance_id: string; reason?: string }

  public constructor(options?: { id?: string; body: CompleteMessage['body']; thid?: string }) {
    super()
    this.type = CompleteMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
