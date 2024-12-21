export class TimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TimeoutError';
    }
  }
  
  export function createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms)
    );
  }