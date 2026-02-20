import { Button } from '@blueprintjs/core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTokens } from 'src/commons/utils/Hooks';
import { continuePixelChat, initPixelChat } from 'src/features/pixel/api';
import { PixelChatMessage } from 'src/features/pixel/types';
import classes from 'src/styles/PixelChatbot.module.scss';
import { v4 as uuid } from 'uuid';

import ChatbotCodeSnippet from '../../pages/sicp/subcomponents/chatbot/ChatbotCodeSnippet';
import usePageContext from './usePageContext';

type Props = {
  activeSnippetId: string;
  setActiveSnippetId: (id: string) => void;
  isExpanded: boolean;
  toggleExpanded: () => void;
};

const createInitialMessage = (): PixelChatMessage => ({
  id: uuid(),
  content: "Hi! I'm Pixel, your Source Academy assistant. How can I help you today?",
  role: 'assistant'
});

const createErrorMessage = (): PixelChatMessage => ({
  id: uuid(),
  content: 'Sorry, something went wrong. Please try again later.',
  role: 'assistant'
});

const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
  ref.current?.scrollTo({ top: ref.current?.scrollHeight });
};

const PixelChatBox: React.FC<Props> = ({
  activeSnippetId,
  setActiveSnippetId,
  isExpanded,
  toggleExpanded
}) => {
  const chatRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<PixelChatMessage[]>(() => [createInitialMessage()]);
  const [userInput, setUserInput] = useState('');
  const [maxContentSize, setMaxContentSize] = useState(1000);
  const tokens = useTokens();
  const { pageContext, pageType } = usePageContext();

  const handleUserInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(event.target.value);
  };

  const sendMessage = useCallback(() => {
    if (userInput.trim() === '') {
      return;
    }
    setUserInput('');
    setMessages(prev => [...prev, { id: uuid(), role: 'user', content: userInput }]);
    setIsLoading(true);

    continuePixelChat(tokens, userInput, pageContext, pageType)
      .then(resp => {
        setMessages(prev => [...prev, { id: uuid(), role: 'assistant', content: resp.response }]);
      })
      .catch(() => {
        setMessages(prev => [...prev, createErrorMessage()]);
      })
      .finally(() => setIsLoading(false));
  }, [tokens, userInput, pageContext, pageType]);

  const keyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
    e => {
      if (e.key === 'Enter' && !isLoading) {
        sendMessage();
      }
    },
    [isLoading, sendMessage]
  );

  const resetChat = useCallback(() => {
    initPixelChat(tokens).then(resp => {
      const conversationMessages = resp.messages;
      const maxMessageSize = resp.maxContentSize;
      if (conversationMessages && conversationMessages.length > 0) {
        const messagesWithIds = conversationMessages.map(msg => ({
          ...msg,
          id: msg.id || uuid()
        }));
        setMessages(messagesWithIds);
      } else {
        setMessages([createInitialMessage()]);
      }
      setMaxContentSize(maxMessageSize);
      setUserInput('');
    });
  }, [tokens]);

  // Run once when component is mounted
  useEffect(() => {
    resetChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom(chatRef);
  }, [messages, isLoading]);

  return (
    <div
      className={`${classes['pixel-chat-container']} ${isExpanded ? classes['pixel-chat-container-expanded'] : ''}`}
    >
      <div className={classes['pixel-chat-header']}>
        <Button
          size="small"
          variant="minimal"
          icon={isExpanded ? 'minimize' : 'maximize'}
          onClick={toggleExpanded}
          title={isExpanded ? 'Shrink chat' : 'Expand chat'}
          className={classes['pixel-expand-button']}
        />
      </div>
      <div className={classes['pixel-chat-message']} ref={chatRef}>
        {messages.map(message => (
          <div
            key={message.id}
            className={classes[`pixel-${message.role}`]}
            style={{ whiteSpace: 'pre-line' }}
          >
            <MessageRenderer
              message={message}
              activeSnippetId={activeSnippetId}
              setActiveSnippetId={setActiveSnippetId}
            />
          </div>
        ))}
        {isLoading && <p>loading...</p>}
      </div>
      <div className={classes['pixel-control-container']}>
        <input
          type="text"
          disabled={isLoading}
          className={classes['pixel-user-input']}
          placeholder={isLoading ? 'Waiting for response...' : 'Ask Pixel anything...'}
          value={userInput}
          onChange={handleUserInput}
          onKeyDown={keyDown}
          maxLength={maxContentSize}
        />
        <div className={classes['pixel-input-count-container']}>
          <div
            className={classes['pixel-input-count']}
          >{`${userInput.length}/${maxContentSize}`}</div>
        </div>

        <div className={classes['pixel-button-container']}>
          <Button
            disabled={isLoading}
            className={classes['pixel-button-send']}
            onClick={sendMessage}
          >
            Send
          </Button>
          <Button className={classes['pixel-button-clean']} onClick={resetChat}>
            Clean
          </Button>
        </div>
      </div>
    </div>
  );
};

// Message renderer — renders code blocks with interactive snippets (reuses ChatbotCodeSnippet)
type MessageRendererProps = {
  message: PixelChatMessage;
  activeSnippetId: string;
  setActiveSnippetId: (id: string) => void;
};

const MessageRenderer: React.FC<MessageRendererProps> = ({
  message,
  activeSnippetId,
  setActiveSnippetId
}) => {
  const content = message.content;
  const messageId = message.id;

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let codeBlockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(
        <div key={`${messageId}-text-${lastIndex}`} style={{ marginBottom: '0.5em' }}>
          {text.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </div>
      );
    }

    const lang = match[1] || 'javascript';
    const code = match[2];
    const snippetId = `${messageId}-code-${codeBlockIndex}`;
    codeBlockIndex++;

    if (lang === 'javascript' || lang === 'js') {
      parts.push(
        <ChatbotCodeSnippet
          key={snippetId}
          id={snippetId}
          code={code}
          activeSnippetId={activeSnippetId}
          setActiveSnippet={setActiveSnippetId}
          language={lang}
        />
      );
    } else {
      parts.push(
        <div
          key={snippetId}
          className="chatbot-code-block-static"
          style={{
            margin: '0.5em 0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <ChatbotCodeSnippet
            key={snippetId}
            id={snippetId}
            code={code}
            activeSnippetId={activeSnippetId}
            setActiveSnippet={setActiveSnippetId}
            language={lang}
          />
        </div>
      );
    }

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    parts.push(
      <div key={`${messageId}-text-end`} style={{ marginBottom: '0.5em' }}>
        {text.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </div>
    );
  }

  return <>{parts}</>;
};

export default PixelChatBox;
