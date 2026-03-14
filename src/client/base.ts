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
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const responseData = error.response?.data;
        
        // Provide more detailed error information, especially for 412 Precondition Failed
        if (status === 412) {
          throw new Error(`Nextcloud API request failed: ${error.message} (Status: ${status} ${statusText}) - This usually indicates an ETag mismatch. Response: ${JSON.stringify(responseData)}`);
        }
        
        throw new Error(`Nextcloud API request failed: ${error.message} (Status: ${status} ${statusText})`);
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
      
      const response = await this.client.request<string>(webdavConfig);
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Return the response data even for non-2xx status codes, as WebDAV can return useful data
        if (error.response?.data) {
          return error.response.data as string;
        }
        throw new Error(`Nextcloud WebDAV request failed: ${error.message} (Status: ${error.response?.status})`);
      } else {
        throw new Error(`An unexpected error occurred: ${error}`);
      }
    }
  }
}