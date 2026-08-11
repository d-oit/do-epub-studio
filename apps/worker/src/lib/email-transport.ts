import { logAppInfo } from './observability';
import type { Env } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Optional request trace context (Plan 214 R3). Purely tracing plumbing: the
   * send/fallback logs inherit the initiating request's trace ids instead of
   * minting an unrelated trace. Never changes transport behavior.
   */
  context?: { traceId: string; spanId?: string };
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

class LoggingEmailTransport implements EmailTransport {
  send(message: EmailMessage): Promise<void> {
    logAppInfo(
      'email.send',
      {
        to: message.to,
        subject: message.subject,
        textPreview: message.text.slice(0, 200),
      },
      message.context,
    );
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
  logAppInfo('email.transport.fallback', {
    message: 'EMAIL_SEND binding not configured — emails will be logged but not delivered. Bind an Email Sending integration in the Cloudflare dashboard to enable delivery.',
    hint: 'Set the EMAIL_SEND binding in wrangler.toml or the Cloudflare dashboard under Settings > Bindings.',
  });
  return new LoggingEmailTransport();
}
