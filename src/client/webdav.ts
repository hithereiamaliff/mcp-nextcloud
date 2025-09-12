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

  /**
   * Recursively list all files from a directory
   */
  public async listDirectoryRecursive(
    path: string,
    maxDepth: number = 10
  ): Promise<any[]> {
    const allFiles: any[] = [];
    await this.listDirectoryRecursiveInternal(path, allFiles, 0, maxDepth);
    return allFiles;
  }

  /**
   * Get detailed file metadata using PROPFIND
   */
  public async getFileMetadata(path: string): Promise<any> {
    return this.makeRequest<any>({
      method: 'PROPFIND',
      url: `/remote.php/dav/files/{username}/${path}`,
      headers: {
        'Depth': '0'
      }
    });
  }

  /**
   * Check if file exists
   */
  public async fileExists(path: string): Promise<boolean> {
    try {
      await this.makeRequest<any>({
        method: 'HEAD',
        url: `/remote.php/dav/files/{username}/${path}`,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file content with size limits for search
   */
  public async readFileForSearch(
    path: string,
    maxSize: number = 1024 * 1024
  ): Promise<string> {
    try {
      // First check file size if possible
      const metadata = await this.getFileMetadata(path);
      
      // If we can get size info and it's too large, throw error
      if (metadata && metadata.size && metadata.size > maxSize) {
        throw new Error(`File too large for search: ${metadata.size} bytes`);
      }
      
      // Read the file content
      return await this.readFile(path);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Internal recursive directory listing
   */
  private async listDirectoryRecursiveInternal(
    path: string,
    allFiles: any[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    try {
      const contents = await this.listDirectory(path);
      
      // Handle different response formats
      let items: any[] = [];
      if (Array.isArray(contents)) {
        items = contents;
      } else if (contents && typeof contents === 'object') {
        if (contents.items && Array.isArray(contents.items)) {
          items = contents.items;
        } else {
          items = [contents];
        }
      }

      for (const item of items) {
        allFiles.push({
          ...item,
          depth: currentDepth
        });

        // If it's a directory and we haven't reached max depth, recurse
        if (item.isDirectory && currentDepth < maxDepth) {
          const itemPath = item.path || item.href || `${path}/${item.name}`;
          await this.listDirectoryRecursiveInternal(
            itemPath,
            allFiles,
            currentDepth + 1,
            maxDepth
          );
        }
      }
    } catch (error) {
      console.warn(`Failed to list directory ${path}:`, error);
      // Continue with other directories even if one fails
    }
  }
}