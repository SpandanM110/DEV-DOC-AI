import axios, { AxiosRequestConfig, ResponseType } from 'axios';

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
   responseType: 'json', // No need for 'as ResponseType', 'json' is a valid ResponseType
};

// Your axios request
const response = await axios.get(url, fetchConfig);
