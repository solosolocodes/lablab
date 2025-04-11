import { NextRequest, NextResponse } from 'next/server';
import { debug } from '@/lib/debug';

/**
 * Debug middleware for Next.js API routes
 * This middleware logs request and response details when debug mode is enabled
 */
export async function debugMiddleware(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Generate a unique request ID for tracking
  const requestId = Math.random().toString(36).substring(2, 9);
  const method = req.method;
  const url = req.url;
  
  // Start time for performance measurement
  const startTime = performance.now();
  
  // Log the incoming request
  debug.info('API', `[${requestId}] ${method} ${url}`);
  
  try {
    // Log request body if available
    if (req.body) {
      try {
        // Clone the request to read the body without consuming it
        const clonedReq = req.clone();
        const body = await clonedReq.text();
        if (body) {
          try {
            const jsonBody = JSON.parse(body);
            debug.info('API', `[${requestId}] Request body:`, jsonBody);
          } catch {
            debug.info('API', `[${requestId}] Request body (text):`, body);
          }
        }
      } catch (error) {
        debug.warn('API', `[${requestId}] Could not read request body:`, error);
      }
    }
    
    // Execute the API handler
    const response = await handler(req);
    
    // Calculate performance metrics
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log the response details
    debug.info('API', `[${requestId}] ${method} ${url} → ${response.status} (${duration.toFixed(2)}ms)`);
    
    // Log response body if in debug mode
    if (debug.isEnabled) {
      try {
        // Clone the response to read the body without consuming it
        const clonedRes = response.clone();
        const body = await clonedRes.text();
        if (body) {
          try {
            const jsonBody = JSON.parse(body);
            debug.info('API', `[${requestId}] Response body:`, jsonBody);
          } catch {
            debug.info('API', `[${requestId}] Response body (text):`, body);
          }
        }
      } catch (error) {
        debug.warn('API', `[${requestId}] Could not read response body:`, error);
      }
    }
    
    // Add debug headers to response if in debug mode
    if (debug.isEnabled) {
      const headers = new Headers(response.headers);
      headers.set('X-Debug-Request-Id', requestId);
      headers.set('X-Debug-Duration-Ms', duration.toFixed(2));
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    
    return response;
  } catch (error) {
    // Log any errors that occurred during API handler execution
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    debug.error('API', `[${requestId}] ${method} ${url} → ERROR (${duration.toFixed(2)}ms)`, error);
    
    // Return an error response
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Request-Id': requestId,
          'X-Debug-Duration-Ms': duration.toFixed(2),
        }
      }
    );
  }
}

// Helper function for wrapping API handlers with debug middleware
export function withDebug(handler: (req: NextRequest) => Promise<NextResponse>) {
  return (req: NextRequest) => debugMiddleware(req, handler);
}

export default withDebug;