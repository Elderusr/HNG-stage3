import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';

export const a2aAgentRoute = registerApiRoute('/a2a/agent/:agentId', {
  method: 'POST',
  handler: async (c) => {
    let requestId: string | null = null;
    
    try {
      const mastra = c.get('mastra');
      const agentId = c.req.param('agentId');

      // Parse JSON body
      let body: any = {};
      try {
        body = await c.req.json();
      } catch (parseError) {
        // If JSON parsing fails, treat as empty JSON
        body = {};
      }

      // Handle empty JSON - return success with empty result
      if (!body || Object.keys(body).length === 0) {
        return c.json({
          jsonrpc: '2.0',
          id: null,
          result: {
            id: randomUUID(),
            contextId: randomUUID(),
            status: {
              state: 'completed',
              timestamp: new Date().toISOString(),
              message: {
                messageId: randomUUID(),
                role: 'agent',
                parts: [
                  {
                    kind: 'text',
                    text: 'No message provided'
                  }
                ],
                kind: 'message'
              }
            },
            artifacts: [],
            history: [],
            kind: 'task'
          }
        }, 200);
      }

      const { jsonrpc, id, method, params } = body;
      requestId = id;

      // Validate JSON-RPC 2.0 format
      if (jsonrpc !== '2.0') {
        return c.json({
          jsonrpc: '2.0',
          id: requestId || null,
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0"'
          }
        }, 400);
      }

      if (!requestId) {
        return c.json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32600,
            message: 'Invalid Request: id is required'
          }
        }, 400);
      }

      // Get agent
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

      // Extract and validate params
      if (!params) {
        return c.json({
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32602,
            message: 'Invalid params: params object is required'
          }
        }, 400);
      }

      const { message, messages, contextId, taskId, metadata, configuration } = params;

      // Extract messages from params
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
        if (!msg.parts || !Array.isArray(msg.parts)) {
          return {
            role: msg.role || 'user',
            content: msg.content || ''
          };
        }

        const content = msg.parts
          .map((part: any) => {
            if (part.kind === 'text') return part.text || '';
            if (part.kind === 'data') {
              // Handle data parts
              if (typeof part.data === 'string') return part.data;
              if (typeof part.data === 'object') return JSON.stringify(part.data);
              return '';
            }
            return '';
          })
          .filter((text: string) => text.length > 0)
          .join('\n');

        return {
          role: msg.role || 'user',
          content: content || msg.content || ''
        };
      });

      // Validate that we have valid content
      if (mastraMessages.every((msg) => !msg.content || msg.content.trim() === '')) {
        return c.json({
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32602,
            message: 'Invalid params: message content cannot be empty'
          }
        }, 400);
      }

      // Execute agent
      const response = await agent.generate(mastraMessages);
      const agentText = response.text || '';

      // Use provided taskId or generate new one
      const finalTaskId = taskId || randomUUID();
      const finalContextId = contextId || randomUUID();

      // Build artifacts array
      const artifacts: any[] = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: 'text', text: agentText }]
        }
      ];

      // Add tool results as artifacts if available
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
          taskId: msg.taskId || finalTaskId,
        })),
        {
          kind: 'message',
          role: 'agent',
          parts: [{ kind: 'text', text: agentText }],
          messageId: randomUUID(),
          taskId: finalTaskId,
        }
      ];

      // Return A2A-compliant response
      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          id: finalTaskId,
          contextId: finalContextId,
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
      }, 200);

    } catch (error: any) {
      // Comprehensive error handling
      console.error('A2A Agent Route Error:', error);

      // Determine error type and code
      let errorCode = -32603; // Internal error
      let errorMessage = 'Internal error';
      
      if (error.message?.includes('Agent')) {
        errorCode = -32602;
        errorMessage = error.message;
      } else if (error.message?.includes('tool') || error.message?.includes('function')) {
        errorCode = -32603;
        errorMessage = 'Agent execution error: ' + error.message;
      }

      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: errorCode,
          message: errorMessage,
          data: {
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        }
      }, 500);
    }
  }
});