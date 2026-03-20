
'use server';

import twilio from 'twilio';

interface SendMessageParams {
  to: string;
  body?: string;
  template?: string;
  templateVariables?: Record<string, string>;
}

export async function sendWhatsAppMessage(params: SendMessageParams): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
      !fromNumber && "TWILIO_WHATSAPP_FROM"
    ].filter(Boolean).join(', ');
    console.warn(`Twilio credentials (${missing}) are not defined. Twilio functionality will be disabled.`);
    return { success: false, error: 'Las credenciales de Twilio no están completamente configuradas en el servidor.' };
  }
  
  const client = twilio(accountSid, authToken);
  
  try {
    const { to, body, template, templateVariables } = params;

    if (!template && !body) {
        throw new Error('Debe proporcionar un `body` o un `template`.');
    }

    let messageOptions: any = {
        to: `whatsapp:${to.replace(/\D/g, '')}`,
        from: `whatsapp:${fromNumber.replace(/\D/g, '')}`
    };

    if (template && process.env.TWILIO_WHATSAPP_TEMPLATE_SID) {
        messageOptions.contentSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
        if (templateVariables) {
          messageOptions.contentVariables = JSON.stringify(templateVariables);
        }
    } else if (body) {
        messageOptions.body = body;
    } else {
        throw new Error("Se especificó una plantilla pero TWILIO_WHATSAPP_TEMPLATE_SID no está configurado.");
    }
    
    const message = await client.messages.create(messageOptions);

    return { success: true, sid: message.sid };

  } catch (error: any) {
    console.error('[Twilio Service Error]', error);
    return { success: false, error: error.message };
  }
}
