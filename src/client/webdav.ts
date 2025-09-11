import { BaseNextcloudClient } from './base';

export class WebDAVClient extends BaseNextcloudClient {
  public async listDirectory(path: string): Promise<any> {
    return this.makeRequest<any>({
      method: 'PROPFIND',
      url: `/remote.php/dav/files/{username}/${path}`,
    });
  }

  public async readFile(path: string): Promise<string> {
    return this.makeRequest<string>({
      method: 'GET',
      url: `/remote.php/dav/files/{username}/${path}`,
    });
  }

  public async writeFile(path: string, content: string): Promise<void> {
    await this.makeRequest<void>({
      method: 'PUT',
      url: `/remote.php/dav/files/{username}/${path}`,
      data: content,
    });
  }

  public async createDirectory(path: string): Promise<void> {
    await this.makeRequest<void>({
      method: 'MKCOL',
      url: `/remote.php/dav/files/{username}/${path}`,
    });
  }

  public async deleteResource(path: string): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/remote.php/dav/files/{username}/${path}`,
    });
  }
}