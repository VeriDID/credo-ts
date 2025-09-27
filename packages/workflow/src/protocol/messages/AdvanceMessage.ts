import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class AdvanceMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/advance')

  @IsValidMessageType(AdvanceMessage.type)
  public type = AdvanceMessage.type.messageTypeUri

  public body!: { instance_id: string; event: string; idempotency_key?: string }

  public constructor(options?: { id?: string; body: AdvanceMessage['body']; thid?: string }) {
    super()
    this.type = AdvanceMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
