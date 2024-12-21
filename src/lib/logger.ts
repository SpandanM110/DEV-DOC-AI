export function logError(error: unknown, context?: string) {
    console.error('Error Logging:', {
      context: context || 'Unknown Context',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: typeof error,
      timestamp: new Date().toISOString()
    });
  }