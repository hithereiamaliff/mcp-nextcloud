import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class BaseNextcloudClient {
  protected readonly client: AxiosInstance;
  protected readonly username: string;

  constructor(baseURL: string, username: string, authToken: string) {
    this.username = username;
    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${authToken}`).toString('base64')}`,
        'OCS-APIRequest': 'true',
      },
    });
  }

  protected async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      // Replace {username} placeholder in URL with actual username
      if (config.url) {
        config.url = config.url.replace('{username}', this.username);
      }
      
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Nextcloud API request failed: ${error.message}`);
      } else {
        throw new Error(`An unexpected error occurred: ${error}`);
      }
    }
  }

  protected async makeWebDAVRequest(config: AxiosRequestConfig): Promise<string> {
    try {
      // Replace {username} placeholder in URL with actual username
      if (config.url) {
        config.url = config.url.replace('{username}', this.username);
      }
      
      // Set WebDAV specific headers
      const webdavConfig = {
        ...config,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': config.headers?.['Depth'] || '1',
          ...config.headers,
        },
        responseType: 'text' as const,
      };
      
      console.log('Making WebDAV request:', {
        method: webdavConfig.method,
        url: webdavConfig.url,
        headers: webdavConfig.headers,
        data: webdavConfig.data ? 'XML data provided' : 'No data'
      });
      
      const response = await this.client.request<string>(webdavConfig);
      
      console.log('WebDAV response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataLength: response.data?.length || 0,
        dataPreview: response.data?.substring(0, 500) || 'No data'
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('WebDAV request failed:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          headers: error.response?.headers,
          data: error.response?.data,
          message: error.message
        });
        
        // Return the response data even for non-2xx status codes, as WebDAV can return useful data
        if (error.response?.data) {
          return error.response.data as string;
        }
        throw new Error(`Nextcloud WebDAV request failed: ${error.message} (Status: ${error.response?.status})`);
      } else {
        console.error('Unexpected error:', error);
        throw new Error(`An unexpected error occurred: ${error}`);
      }
    }
  }
}