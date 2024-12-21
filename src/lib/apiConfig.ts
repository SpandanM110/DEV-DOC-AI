import axios, { AxiosRequestConfig, ResponseType } from 'axios';

// Create an Axios request config
const fetchConfig: AxiosRequestConfig = {
   timeout: 5000,
   headers: {
     'User-Agent': 'your-user-agent',
     Accept: 'application/json',
     'Accept-Language': 'en-US',
     Referer: 'your-referer',
     DNT: '1',
     'Sec-Fetch-Dest': 'document',
     'Sec-Fetch-Mode': 'navigate',
     'Sec-Fetch-Site': 'same-origin',
   },
   validateStatus: () => true,
   maxRedirects: 5,
   responseType: ResponseType.json, // Use ResponseType.json directly
};

// Your axios request
const response = await axios.get(url, fetchConfig);
