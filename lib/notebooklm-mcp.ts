// lib/notebooklm-mcp.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface NotebookInfo {
  id: string;
  title: string;
  sourceCount: number;
  lastModified: string;
  url: string;
}

class NotebookLMMCP extends EventEmitter {
  private mcpProcess: ChildProcess | null = null;
  private isConnected: boolean = false;
  private messageQueue: any[] = [];
  private activeRequests: Map<string, { resolve: Function, reject: Function, timeout: NodeJS.Timeout }> = new Map();

  async connect(): Promise<boolean> {
    try {
      console.log('Starting MCP server process...');

      // Start MCP server process
      this.mcpProcess = spawn('node', ['notebooklm-mcp-server.mjs'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });

      // Handle stdout (JSON responses)
      this.mcpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
       const lines = output.split('\n').filter((line: string) => line.trim());


        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            this.handleMCPMessage(message);
          } catch (error) {
            console.log('Non-JSON output from MCP:', line);
          }
        }
      });

      // Handle stderr (errors)
      this.mcpProcess.stderr?.on('data', (data) => {
        console.error('MCP stderr:', data.toString());
      });

      // Handle process exit
      this.mcpProcess.on('close', (code) => {
        console.log(`MCP process exited with code ${code}`);
        this.isConnected = false;
        this.cleanup();
      });

      // Handle process errors
      this.mcpProcess.on('error', (error) => {
        console.error('MCP process error:', error);
        this.isConnected = false;
        this.cleanup();
      });

      // Wait for connection with shorter timeout
      await this.waitForConnection(15000); // 15 seconds instead of 10
      this.isConnected = true;
      console.log('MCP server connected successfully');
      return true;

    } catch (error) {
      console.error('MCP connection failed:', error);
      this.cleanup();
      return false;
    }
  }

  private async waitForConnection(timeout = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('MCP connection timeout'));
      }, timeout);

      const handleConnected = () => {
        clearTimeout(timer);
        this.off('connected', handleConnected);
        resolve();
      };

      this.once('connected', handleConnected);
    });
  }

  private handleMCPMessage(message: any) {
    console.log('MCP message received:', message.type, message);

    switch (message.type) {
      case 'connected':
        this.emit('connected');
        break;
      case 'authenticated':
        this.emit('authenticated');
        break;
      case 'auth_error':
        this.emit('auth_error', message.error);
        break;
      case 'notebooks':
        this.emit('notebooks', message.notebooks);
        break;
      case 'content':
        this.emit('content', message.content);
        break;
      case 'error':
        this.emit('error', message.error);
        break;
      case 'info':
        console.log(`MCP Info: ${message.message}`);
        break;
    }
  }

  private sendCommand(command: any, timeoutMs = 60000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.mcpProcess?.stdin) {
        reject(new Error('MCP not connected'));
        return;
      }

      // Create unique request ID
      const requestId = `${command.command}_${Date.now()}`;

      // Set up timeout
      const timeout = setTimeout(() => {
        this.activeRequests.delete(requestId);
        reject(new Error(`${command.command} timeout`));
      }, timeoutMs);

      // Store request
      this.activeRequests.set(requestId, { resolve, reject, timeout });

      // Send command
      const commandWithId = { ...command, requestId };
      this.mcpProcess.stdin.write(JSON.stringify(commandWithId) + '\n');

      // Set up response handlers based on command type
      if (command.command === 'authenticate') {
        const handleAuth = () => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('authenticated', handleAuth);
            this.off('auth_error', handleAuthError);
            resolve(true);
          }
        };

        const handleAuthError = (error: string) => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('authenticated', handleAuth);
            this.off('auth_error', handleAuthError);
            reject(new Error(error));
          }
        };

        this.once('authenticated', handleAuth);
        this.once('auth_error', handleAuthError);

      } else if (command.command === 'list_notebooks') {
        const handleNotebooks = (notebooks: any) => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('notebooks', handleNotebooks);
            this.off('error', handleError);
            resolve(notebooks);
          }
        };

        const handleError = (error: string) => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('notebooks', handleNotebooks);
            this.off('error', handleError);
            reject(new Error(error));
          }
        };

        this.once('notebooks', handleNotebooks);
        this.once('error', handleError);

      } else if (command.command === 'extract_content') {
        const handleContent = (content: any) => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('content', handleContent);
            this.off('error', handleError);
            resolve(content);
          }
        };

        const handleError = (error: string) => {
          const request = this.activeRequests.get(requestId);
          if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.off('content', handleContent);
            this.off('error', handleError);
            reject(new Error(error));
          }
        };

        this.once('content', handleContent);
        this.once('error', handleError);
      }
    });
  }

  async authenticate(tokens: any): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('MCP not connected');
    }

    try {
      console.log('Authenticating with NotebookLM...');
      const result = await this.sendCommand({
        command: 'authenticate',
        tokens: tokens
      }, 30000); // 30 second timeout for auth

      return result;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  async getNotebooks(): Promise<NotebookInfo[]> {
    if (!this.isConnected) {
      throw new Error('MCP not connected');
    }

    try {
      console.log('Fetching notebooks from NotebookLM...');
      const notebooks = await this.sendCommand({
        command: 'list_notebooks'
      }, 45000); // 45 second timeout for notebook listing

      return notebooks || [];
    } catch (error) {
      console.error('Failed to get notebooks:', error);
      throw error;
    }
  }

  async extractNotebookContent(notebookId: string): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('MCP not connected');
    }

    try {
      console.log(`Extracting content from notebook: ${notebookId}`);
      const content = await this.sendCommand({
        command: 'extract_content',
        notebookId: notebookId
      }, 90000); // 90 second timeout for content extraction

      return content || [];
    } catch (error) {
      console.error('Failed to extract content:', error);
      throw error;
    }
  }

  private cleanup() {
    // Clear all active requests
    for (const [requestId, request] of this.activeRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('MCP connection closed'));
    }
    this.activeRequests.clear();
  }

  disconnect(): void {
    this.cleanup();

    if (this.mcpProcess) {
      this.mcpProcess.kill('SIGTERM');

      // Force kill after 5 seconds if still alive
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          this.mcpProcess.kill('SIGKILL');
        }
      }, 5000);

      this.mcpProcess = null;
    }
    this.isConnected = false;
  }
}

export default NotebookLMMCP;
export type { NotebookInfo, MCPResponse };
