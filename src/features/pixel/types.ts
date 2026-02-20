export type PixelChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type InitPixelChatResponse = {
  messages: PixelChatMessage[];
  conversationId: number;
  maxContentSize: number;
};

export type ContinuePixelChatResponse = {
  response: string;
  conversationId: number;
};
