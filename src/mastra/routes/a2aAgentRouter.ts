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
                kind: 'message',
                role: 'agent',
                parts: [
                  {
                    kind: 'text',
                    text: 'No message provided',
                    data: null,
                    file_url: null
                  }
                ],
                messageId: randomUUID(),
                taskId: null,
                metadata: null
              }
            },
            artifacts: [],
            history: [],
            kind: 'task'
          },
          error: null
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

      // Build artifacts array with complete part structure
      const artifacts: any[] = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ 
            kind: 'text', 
            text: agentText,
            data: null,
            file_url: null
          }]
        }
      ];

      // Add tool results as artifacts if available
      if (response.toolResults && response.toolResults.length > 0) {
        artifacts.push({
          artifactId: randomUUID(),
          name: 'ToolResults',
          parts: response.toolResults.map((result) => ({
            kind: 'data',
            data: result,
            text: null,
            file_url: null
          }))
        });
      }

      // Build conversation history with complete structure
      const history = [
        ...messagesList.map((msg, index) => {
          // Normalize parts structure
          const normalizedParts = (msg.parts || [{ kind: 'text', text: msg.content || '' }]).map((part: any) => ({
            kind: part.kind || 'text',
            text: part.text || null,
            data: part.data || null,
            file_url: part.file_url || null
          }));

          return {
            kind: 'message',
            role: msg.role || 'user',
            parts: normalizedParts,
            messageId: msg.messageId || randomUUID(),
            taskId: index === 0 ? null : (msg.taskId || finalTaskId), // First user message has null taskId
            metadata: msg.metadata || null
          };
        }),
        {
          kind: 'message',
          role: 'agent',
          parts: [{ 
            kind: 'text', 
            text: agentText,
            data: null,
            file_url: null
          }],
          messageId: randomUUID(),
          taskId: finalTaskId,
          metadata: null
        }
      ];

      // Return A2A-compliant response with error field
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
              kind: 'message',
              role: 'agent',
              parts: [{ 
                kind: 'text', 
                text: agentText,
                data: null,
                file_url: null
              }],
              messageId: randomUUID(),
              taskId: finalTaskId,
              metadata: null
            }
          },
          artifacts,
          history,
          kind: 'task'
        },
        error: null
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