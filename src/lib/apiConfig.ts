const createFetchConfig = (): AxiosRequestConfig => ({
    timeout: 30000, // 30 seconds
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/',
      'DNT': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
    },
    validateStatus: () => true, // Accept all status codes
    maxRedirects: 5,
    responseType: 'text' as const, // Ensure responseType is of type 'text'
  });
  