import { Tokens } from 'src/commons/application/types/SessionTypes';
import { request } from 'src/commons/utils/RequestHelper';

import { ContinuePixelChatResponse, InitPixelChatResponse } from './types';

export async function initPixelChat(tokens: Tokens): Promise<InitPixelChatResponse> {
  const response = await request('pixel', 'POST', {
    ...tokens,
    body: {}
  });
  if (!response) {
    throw new Error('Unknown error occurred.');
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to initialize Pixel chat: ${message}`);
  }
  return await response.json();
}

export async function continuePixelChat(
  tokens: Tokens,
  userMessage: string,
  pageContext: string,
  pageType: string
): Promise<ContinuePixelChatResponse> {
  const response = await request('pixel/message', 'POST', {
    ...tokens,
    body: {
      message: userMessage,
      pageContext,
      pageType
    }
  });
  if (!response) {
    throw new Error('Unknown error occurred.');
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to chat with Pixel: ${message}`);
  }
  return await response.json();
}
