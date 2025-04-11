/**
 * Debug utility for consistent logging across the application
 * Enabled by setting DEBUG=true in environment variables
 */

const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

export const debug = {
  log: (area: string, message: string, data?: any) => {
    if (isDebugMode) {
      console.log(`[DEBUG:${area}]`, message, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  
  error: (area: string, message: string, error?: any) => {
    if (isDebugMode) {
      console.error(`[ERROR:${area}]`, message);
      if (error) {
        if (error instanceof Error) {
          console.error(`- Name: ${error.name}`);
          console.error(`- Message: ${error.message}`);
          console.error(`- Stack: ${error.stack}`);
        } else {
          console.error('- Details:', error);
        }
      }
    }
  },
  
  info: (area: string, message: string, data?: any) => {
    if (isDebugMode) {
      console.info(`[INFO:${area}]`, message, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  
  warn: (area: string, message: string, data?: any) => {
    if (isDebugMode) {
      console.warn(`[WARN:${area}]`, message, data ? JSON.stringify(data, null, 2) : '');
    }
  },
  
  // Helper to log API request details
  request: (method: string, url: string, body?: any) => {
    if (isDebugMode) {
      console.log(`[API:REQUEST] ${method} ${url}`);
      if (body) {
        console.log('- Body:', JSON.stringify(body, null, 2));
      }
    }
  },
  
  // Helper to log API response details
  response: (method: string, url: string, status: number, data?: any) => {
    if (isDebugMode) {
      console.log(`[API:RESPONSE] ${method} ${url} → ${status}`);
      if (data) {
        console.log('- Data:', JSON.stringify(data, null, 2));
      }
    }
  },
  
  // Is debug mode enabled
  isEnabled: isDebugMode
};

export default debug;