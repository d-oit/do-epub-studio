import type { Env } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

class LoggingEmailTransport implements EmailTransport {
  send(message: EmailMessage): Promise<void> {
    console.log(JSON.stringify({
      type: 'email',
      to: message.to,
      subject: message.subject,
      textPreview: message.text.slice(0, 200),
    }));
    return Promise.resolve();
  }
}

class SendEmailTransport implements EmailTransport {
  private readonly sender: string;

  constructor(private readonly env: Env) {
    this.sender = this.env.EMAIL_SENDER ?? 'noreply@do-epub-studio.example.com';
  }

  async send(message: EmailMessage): Promise<void> {
    const send = this.env.EMAIL_SEND;
    if (!send) throw new Error('EMAIL_SEND binding not configured');
    await send.send({
      from: this.sender,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

export function createEmailTransport(env: Env): EmailTransport {
  if (env.EMAIL_SEND) {
    return new SendEmailTransport(env);
  }
  return new LoggingEmailTransport();
}
