import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';

export const a2aAgentRoute = registerApiRoute('/a2a/agent/:agentId', {
  method: 'POST',
  handler: async (c) => {
    let requestId = null;
    
    try {
      const mastra = c.get('mastra');
      const agentId = c.req.param('agentId');

      // Parse JSON-RPC 2.0 request
      const body = await c.req.json();
      
      // Log the incoming request for debugging
      console.log('=== A2A Request Received ===');
      console.log('Agent ID:', agentId);
      console.log('Body:', JSON.stringify(body, null, 2));
      
      const { jsonrpc, id, method, params } = body;
      requestId = id;

      // Validate JSON-RPC 2.0 format
      if (jsonrpc !== '2.0' || !requestId) {
        return c.json({
          jsonrpc: '2.0',
          id: requestId || null,
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0" and id is required'
          }
        }, 400);
      }

      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json({
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32602,
            message: `Agent '${agentId}' not found`
          }
        }, 404);
      }

      // Extract messages from params
      const { message, messages, contextId, taskId, metadata } = params || {};
      
      let messagesList = [];
      if (message) {
        messagesList = [message];
      } else if (messages && Array.isArray(messages)) {
        messagesList = messages;
      }

      // Validate we have messages
      if (messagesList.length === 0) {
        return c.json({
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32602,
            message: 'Invalid params: message or messages array is required'
          }
        }, 400);
      }

      // Convert A2A messages to Mastra format
      const mastraMessages = messagesList.map((msg) => {
        const parts = msg.parts || [];
        
        // Process parts, extracting text and handling nested data
        const contentParts: string[] = [];
        
        for (const part of parts) {
          if (part.kind === 'text') {
            contentParts.push(part.text);
          } else if (part.kind === 'data' && Array.isArray(part.data)) {
            // Handle nested conversation history in data part
            // Extract only user messages from history for context
            const historyTexts = part.data
              .filter((item: any) => item.kind === 'text' && item.text)
              .map((item: any) => item.text)
              .filter((text: string) => !text.startsWith('<p>') && text.length > 20); // Filter out HTML and short responses
            
            if (historyTexts.length > 0) {
              // Only include the most recent user message from history if it's different
              const lastHistoryText = historyTexts[historyTexts.length - 1];
              if (lastHistoryText && !contentParts.includes(lastHistoryText)) {
                contentParts.push(lastHistoryText);
              }
            }
          } else if (part.kind === 'data' && typeof part.data === 'object') {
            contentParts.push(JSON.stringify(part.data));
          }
        }
        
        const content = contentParts.join('\n').trim() || msg.content || '';

        return {
          role: msg.role || 'user',
          content: content
        };
      });

      // Execute agent - agent.generate() accepts array of messages directly
      console.log('=== Executing Agent ===');
      console.log('Messages:', JSON.stringify(mastraMessages, null, 2));
      
      const response = await agent.generate(mastraMessages);

      console.log('=== Agent Response ===');
      console.log('Text length:', response.text?.length || 0);
      console.log('Tool results:', response.toolResults?.length || 0);
      
      const agentText = response.text || '';

      // Build artifacts array
      const artifacts : any = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: 'text', text: agentText }]
        }
      ];

      // Add tool results as artifacts
      if (response.toolResults && response.toolResults.length > 0) {
        artifacts.push({
          artifactId: randomUUID(),
          name: 'ToolResults',
          parts: response.toolResults.map((result) => ({
            kind: 'data',
            data: result
          }))
        });
      }

      // Build conversation history
      const history = [
        ...messagesList.map((msg) => ({
          kind: 'message',
          role: msg.role || 'user',
          parts: msg.parts || [{ kind: 'text', text: msg.content || '' }],
          messageId: msg.messageId || randomUUID(),
          taskId: msg.taskId || taskId || randomUUID(),
        })),
        {
          kind: 'message',
          role: 'agent',
          parts: [{ kind: 'text', text: agentText }],
          messageId: randomUUID(),
          taskId: taskId || randomUUID(),
        }
      ];

      // Return A2A-compliant response
      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          id: taskId || randomUUID(),
          contextId: contextId || randomUUID(),
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
            message: {
              messageId: randomUUID(),
              role: 'agent',
              parts: [{ kind: 'text', text: agentText }],
              kind: 'message'
            }
          },
          artifacts,
          history,
          kind: 'task'
        }
      });
    } catch (error: any) {
      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
          data: { 
            stack: error.stack,
            details: error.message 
          }
        }
      }, 500);
    }
  }
});