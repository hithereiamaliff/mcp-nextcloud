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
}