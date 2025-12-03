import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function AIChatAssistant() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    // Check if script is already loaded (from index.html or previous load)
    // First check for the specific ID, then fallback to src search
    const existingScript = document.querySelector('#omnidimension-web-widget') || 
                          document.querySelector('script[src*="omnidim.io"]');
    if (existingScript) {
      setScriptLoaded(true);
      console.log('✅ OmniDimension script found in DOM');
      
      // Wait for widget to initialize
      const checkWidget = setInterval(() => {
        // Check for various possible widget selectors
        const selectors = [
          '[id*="omni"]',
          '[class*="omni"]',
          '[class*="chat"]',
          '[class*="widget"]',
          'button[class*="chat"]',
          'div[class*="chat"]',
          '#omni-widget-container',
          '[data-omni]'
        ];
        
        let widgetFound = false;
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && (element.offsetWidth > 0 || element.offsetHeight > 0)) {
              widgetFound = true;
              console.log('✅ Widget element found:', selector, element);
              break;
            }
          } catch (e) {
            // Ignore selector errors
          }
        }
        
        if (widgetFound) {
          setWidgetReady(true);
          clearInterval(checkWidget);
          console.log('✅ OmniDimension widget is visible');
        }
      }, 500);
      
      // Stop checking after 15 seconds
      setTimeout(() => {
        clearInterval(checkWidget);
        // Check if widget is ready at timeout
        const selectors = [
          '[id*="omni"]',
          '[class*="omni"]',
          '[class*="chat"]',
          '[class*="widget"]',
          'button[class*="chat"]',
          'div[class*="chat"]',
          '#omni-widget-container',
          '[data-omni]'
        ];
        let found = false;
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && (element.offsetWidth > 0 || element.offsetHeight > 0)) {
              found = true;
              break;
            }
          } catch (e) {}
        }
        if (!found) {
          console.warn('⚠️ Widget not detected after 15 seconds. It may still be loading or require manual initialization.');
        }
      }, 15000);
      
      return () => clearInterval(checkWidget);
    } else {
      // Script not found, try to load it
      console.log('📦 Loading OmniDimension widget script...');
      const script = document.createElement('script');
      script.id = 'omnidimension-web-widget';
      script.src = 'https://backend.omnidim.io/web_widget.js?secret_key=81624846b4b52b11a8b4789a72ee0942';
      script.async = true;
      script.type = 'text/javascript';
      
      script.onload = () => {
        setScriptLoaded(true);
        console.log('✅ OmniDimension AI Chat widget script loaded successfully');
        
        // Wait for widget to initialize
        setTimeout(() => {
          const checkWidget = setInterval(() => {
            const selectors = [
              '[id*="omni"]',
              '[class*="omni"]',
              '[class*="chat"]',
              '[class*="widget"]',
              'button[class*="chat"]',
              'div[class*="chat"]',
              '#omni-widget-container',
              '[data-omni]'
            ];
            
            let widgetFound = false;
            for (const selector of selectors) {
              try {
                const element = document.querySelector(selector);
                if (element && (element.offsetWidth > 0 || element.offsetHeight > 0)) {
                  widgetFound = true;
                  console.log('✅ Widget element found:', selector);
                  break;
                }
              } catch (e) {
                // Ignore selector errors
              }
            }
            
            if (widgetFound) {
              setWidgetReady(true);
              clearInterval(checkWidget);
              console.log('✅ OmniDimension widget initialized and visible');
            }
          }, 500);
          
          // Stop checking after 15 seconds
          setTimeout(() => clearInterval(checkWidget), 15000);
        }, 2000);
      };
      
      script.onerror = (error) => {
        console.error('❌ Failed to load OmniDimension widget:', error);
        setScriptLoaded(false);
      };
      
      // Add script to document body
      document.body.appendChild(script);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>AI Chat Assistant</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Powered by OmniDimension</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Get instant answers to your questions about real estate, properties, investments, and more. 
              Our AI assistant is available 24/7 to help you.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Ask about property prices and trends</li>
              <li>Get investment advice and insights</li>
              <li>Learn about real estate regulations</li>
              <li>Find answers to your property questions</li>
            </ul>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {widgetReady 
                  ? 'Chat widget is active and ready' 
                  : scriptLoaded 
                    ? 'Chat widget is loading...' 
                    : 'Initializing chat widget...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {widgetReady 
                  ? 'Look for the chat button in the bottom-right corner of your screen' 
                  : scriptLoaded
                    ? 'The widget script has loaded. Waiting for initialization...'
                    : 'Please wait while we load the AI assistant'}
              </p>
            </div>
          </div>
          {!widgetReady && (
            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check browser console (F12) for any errors</li>
                <li>Try refreshing the page</li>
                <li>Check if pop-up blockers are enabled</li>
                <li>The widget may appear in the bottom-right corner after a few seconds</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

