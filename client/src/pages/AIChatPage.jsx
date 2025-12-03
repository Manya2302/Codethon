import DashboardLayout from '@/components/DashboardLayout';
import { useUser } from '@/contexts/UserContext';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ChatGPTInterface from '@/components/ChatGPTInterface';

export default function AIChatPage() {
  const { user } = useUser();
  const role = user?.role || 'user';

  useEffect(() => {
    // Hide the OmniDimension widget completely
    const hideWidget = () => {
      const styleId = 'hide-omnidimension-widget';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          /* Hide all OmniDimension widget elements */
          [id*="omni"],
          [class*="omni"],
          [class*="chat-widget"],
          iframe[src*="omnidim"],
          div[style*="position: fixed"][style*="bottom"],
          div[style*="position: fixed"][style*="right"],
          button[class*="omni"],
          button[id*="omni"],
          [data-omni] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
          }
        `;
        document.head.appendChild(style);
      }
    };

    hideWidget();
    
    // Continuously hide any widget elements that appear
    const hideInterval = setInterval(() => {
      hideWidget();
      // Also directly hide any elements
      const selectors = [
        '[id*="omni"]',
        '[class*="omni"]',
        '[class*="chat-widget"]',
        'iframe[src*="omnidim"]',
        'button[class*="omni"]',
        'button[id*="omni"]'
      ];
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.style.position = 'absolute';
            el.style.left = '-9999px';
            el.style.top = '-9999px';
          });
        } catch (e) {}
      });
    }, 500);

    return () => clearInterval(hideInterval);
  }, []);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 h-full">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Chat Assistant</h1>
          <p className="text-muted-foreground">Get instant answers and assistance from our AI-powered chat assistant.</p>
        </div>
        
        <Card className="flex-1 min-h-[600px]">
          <CardContent className="p-0 h-full flex flex-col">
            {/* ChatGPT-style Interface */}
            <div className="flex-1 flex flex-col min-h-[600px]">
              <ChatGPTInterface />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
