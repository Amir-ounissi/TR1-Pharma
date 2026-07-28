export type WhatsAppMessage = {
  providerEventId?: string;
  providerMessageId: string;
  phone: string;
  type: string;
  text?: string;
};

export type WhatsAppOutbound = {
  to: string;
  text: string;
};

