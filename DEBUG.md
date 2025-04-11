# Debug Mode for LabLab

This document explains how to use debug mode in the LabLab application for both local development and Vercel deployments.

## Overview

Debug mode provides:

- Detailed logging for database connections
- Performance metrics for API calls
- Visual debugging monitor in the UI
- Source maps for better error tracing
- Unminified code for easier debugging
- Full error stack traces

## Enabling Debug Mode

### Local Development

1. **Use the debug-specific development script:**

   ```bash
   npm run dev:debug
   ```

2. **Or add to your `.env.local` file:**

   ```
   DEBUG=true
   NODE_ENV=development
   ```

### Vercel Deployment

Debug mode is configured in the `vercel.json` file:

```json
{
  "env": {
    "DEBUG": "true",
    "NODE_ENV": "development"
  }
}
```

**Important:** Using `NODE_ENV=development` in production can have performance implications. Consider using a separate preview deployment for debugging.

## Debugging Tools

### Debug Utility

The `@/lib/debug.ts` utility provides consistent logging across the application:

```typescript
import { debug } from '@/lib/debug';

// Log levels
debug.log('area', 'message', data);
debug.info('area', 'message', data);
debug.warn('area', 'message', data);
debug.error('area', 'message', error);

// API logging
debug.request('GET', '/api/endpoint', requestBody);
debug.response('GET', '/api/endpoint', 200, responseData);

// Check if debug is enabled
if (debug.isEnabled) {
  // Do additional debug-only work
}
```

### Debug Monitor

A visual debug monitor is included in the UI when debug mode is enabled. Look for the 🐞 icon in the bottom right corner.

Features:
- Environment information
- Console log counter
- Toggle visibility

### API Debugging

API routes can use the debug middleware:

```typescript
import { withDebug } from '@/middleware/debugMiddleware';

async function handler(req, res) {
  // API logic here
}

export default withDebug(handler);
```

This provides:
- Request logging
- Response logging
- Performance metrics
- Error handling

### Database Debugging

Database connections include detailed logging in debug mode:
- Connection status
- Connection errors with detailed diagnostics
- Performance metrics

### Verifying Debug Status

Run the debug check script to verify your debug configuration:

```bash
npm run debug
```

This will check:
- Environment variables
- Vercel configuration
- Debug utility existence
- Provide recommendations

## Best Practices

1. **Keep debug mode disabled in production** for optimal performance
2. **Use area tags** in debug messages for easier filtering
3. **Log sensitive data carefully** - avoid logging passwords, tokens, etc.
4. **Check debug.isEnabled** before expensive operations used only for debugging
5. **Use performance marks** for timing critical operations

## Troubleshooting

If you're not seeing debug output:

1. Verify debug mode is enabled with `npm run debug`
2. Check your browser console for logs
3. Make sure `.env.local` has the correct values
4. Restart your development server after changing configuration

## Security Considerations

Debug mode can expose sensitive information. Never enable it in production environments accessible to users.

For Vercel deployments, consider using branch-specific environment variables or create a separate debug deployment.