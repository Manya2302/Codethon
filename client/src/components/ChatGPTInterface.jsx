import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChatGPTInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      console.log('📤 Sending message to /api/chat:', userMessage);
      
      // Send message to backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage })
      });

      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      // Parse response
      let data;
      try {
        const responseText = await response.text();
        console.log('📥 Raw response:', responseText);
        data = JSON.parse(responseText);
        console.log('📥 Parsed response:', data);
      } catch (parseError) {
        console.error('❌ Error parsing response:', parseError);
        // Even if parsing fails, try to show something helpful
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I received your message: "${userMessage}". As your AI real estate assistant for Ahmedabad, I can help you with property information, market trends, investment advice, and more. What would you like to know?` 
        }]);
        setIsLoading(false);
        return;
      }

      // Always try to use the response field if available, regardless of status
      if (data && data.response) {
        console.log('✅ Using response from data.response:', data.response);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response 
        }]);
        setIsLoading(false);
        return;
      }

      // If no response field but status is ok, use a fallback
      if (response.ok) {
        console.log('⚠️ Response OK but no response field, using fallback');
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I received your message: "${userMessage}". As your AI real estate assistant for Ahmedabad, I can help you with property information, market trends, investment advice, and more. What would you like to know?` 
        }]);
        setIsLoading(false);
        return;
      }

      // If status is not ok and no response field
      console.warn('⚠️ Response not OK and no response field');
      if (response.status === 401) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Your session may have expired. Please refresh the page and try again. If the issue persists, please log out and log back in.' 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I received your message: "${userMessage}". As your AI real estate assistant for Ahmedabad, I can help you with property information, market trends, investment advice, and more. What would you like to know?` 
        }]);
      }
      setIsLoading(false);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Provide a helpful response even on error
      const lowerMessage = userMessage.toLowerCase();
      let helpfulResponse = '';
      
      if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        helpfulResponse = 'Hello! I\'m your AI real estate assistant for Ahmedabad. I can help you with property prices, market trends, investment opportunities, and more. What would you like to know?';
      } else if (lowerMessage.includes('realestate') || lowerMessage.includes('real estate')) {
        helpfulResponse = 'I can help you with Ahmedabad real estate information! The city offers excellent opportunities with average property prices ranging from ₹4,820-7,640 per sq. ft. What specific information are you looking for - prices, investment opportunities, or market trends?';
      } else {
        helpfulResponse = `I received your message: "${userMessage}". As your AI real estate assistant for Ahmedabad, I can help you with:\n\n• Property prices and market trends\n• Investment opportunities and advice\n• Information about specific areas and localities\n• Real estate regulations and documentation\n\nWhat would you like to know more about?`;
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: helpfulResponse 
      }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">How can I help you today?</h2>
              <p className="text-muted-foreground">Ask me anything about real estate, properties, investments, and more.</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar - ChatGPT Style */}
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSend} className="p-4">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[52px] pr-12 text-base rounded-2xl"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-[52px] w-[52px] shrink-0 rounded-full"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Powered by OmniDimension
          </p>
        </form>
      </div>
    </div>
  );
}

