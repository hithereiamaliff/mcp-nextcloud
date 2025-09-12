import { WebDAVClient } from '../client/webdav.js';
import { getClient } from './client-manager.js';
import {
  FileMetadata,
  FileIndex,
  SearchConfig,
  DEFAULT_SEARCH_CONFIG,
  FILE_TYPE_MAPPINGS,
  MIME_TYPE_MAPPINGS,
  SupportedFileTypes
} from '../models/webdav-search.js';

/**
 * Service for indexing files in the WebDAV file system
 */
export class FileIndexer {
  private indexCache = new Map<string, FileIndex>();
  private config: SearchConfig;

  constructor(config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
    this.config = config;
  }

  /**
   * Recursively index files from a starting path with timeout and size limits
   */
  async indexDirectory(basePath: string = '/', maxDepth?: number, timeoutMs: number = 30000): Promise<FileIndex> {
    const cacheKey = this.getCacheKey(basePath);
    const cached = this.indexCache.get(cacheKey);
    
    // Return cached index if still valid
    if (cached && this.isCacheValid(cached)) {
      console.log(`Using cached index for ${basePath} with ${cached.fileCount} files`);
      return cached;
    }

    console.log(`Starting file indexing for path: ${basePath} (timeout: ${timeoutMs}ms)`);
    
    const startTime = Date.now();
    
    try {
      // Use Promise.race for timeout handling
      const indexPromise = this.performIndexing(basePath, maxDepth ?? this.config.maxDepth);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Indexing timeout')), timeoutMs)
      );
      
      const index = await Promise.race([indexPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`Indexing completed in ${duration}ms: ${index.fileCount} files, ${index.directoryCount} directories`);
      
      return index;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Error indexing directory ${basePath} after ${duration}ms:`, error);
      
      // Return partial index if we have some data
      const partialIndex = this.indexCache.get(cacheKey + '_partial');
      if (partialIndex) {
        console.log(`Returning partial index with ${partialIndex.fileCount} files`);
        return partialIndex;
      }
      
      throw new Error(`Failed to index directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform the actual indexing work
   */
  private async performIndexing(basePath: string, actualMaxDepth: number): Promise<FileIndex> {
    const webdavClient = getClient(WebDAVClient);
    const files: FileMetadata[] = [];

    await this.indexDirectoryRecursive(
      webdavClient,
      basePath,
      files,
      0,
      actualMaxDepth
    );

    const index: FileIndex = {
      basePath,
      lastUpdated: new Date(),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      directoryCount: files.filter(f => f.isDirectory).length,
      fileCount: files.filter(f => !f.isDirectory).length
    };

    // Cache the index
    this.indexCache.set(this.getCacheKey(basePath), index);
    
    // Clean up old cache entries if needed
    this.cleanupCache();
    
    return index;
  }

  /**
   * Update index for specific path
   */
  async updateIndex(path: string): Promise<void> {
    console.log(`Updating index for path: ${path}`);
    
    // Find the best base path for this update
    const basePath = this.findBestBasePath(path);
    
    // Remove cached index to force refresh
    const cacheKey = this.getCacheKey(basePath);
    this.indexCache.delete(cacheKey);
    
    // Re-index the directory
    await this.indexDirectory(basePath);
  }

  /**
   * Get cached index or create new one with smart path handling
   */
  async getIndex(basePath: string = '/', quickMode: boolean = false): Promise<FileIndex> {
    // For root path searches, limit depth and use quick mode
    if (basePath === '/' && quickMode) {
      console.log('Using quick mode for root path search');
      return await this.indexDirectory(basePath, 2, 15000); // Max 2 levels, 15s timeout
    }
    
    // For specific directories, use normal indexing
    const maxDepth = basePath === '/' ? 3 : this.config.maxDepth; // Limit root searches
    const timeout = basePath === '/' ? 20000 : 30000; // Shorter timeout for root
    
    return await this.indexDirectory(basePath, maxDepth, timeout);
  }

  /**
   * Clear all cached indexes
   */
  clearCache(): void {
    this.indexCache.clear();
    console.log('File index cache cleared');
  }

  /**
   * Get index statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.indexCache.size,
      keys: Array.from(this.indexCache.keys())
    };
  }

  /**
   * Recursively index directory contents with performance optimizations
   */
  private async indexDirectoryRecursive(
    client: WebDAVClient,
    currentPath: string,
    files: FileMetadata[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    // Stop if we've reached max depth
    if (currentDepth > maxDepth) {
      console.log(`Stopping indexing at depth ${currentDepth} for path: ${currentPath}`);
      return;
    }

    // Early termination checks
    if (files.length >= this.config.maxIndexSize) {
      console.warn(`Reached maximum index size (${this.config.maxIndexSize}), stopping indexing`);
      return;
    }

    try {
      // Get directory contents with timeout
      const directoryContents = await Promise.race([
        client.listDirectory(currentPath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Directory listing timeout')), 10000)
        )
      ]);
      
      const parsedContents = this.parseWebDAVResponse(directoryContents, currentPath, currentDepth);

      // Sort contents to prioritize files over directories for faster results
      const sortedContents = parsedContents.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return 1;
        if (!a.isDirectory && b.isDirectory) return -1;
        return 0;
      });

      // Process files first
      for (const file of sortedContents) {
        files.push(file);

        // Check limits periodically
        if (files.length >= this.config.maxIndexSize) {
          console.warn(`Reached maximum index size (${this.config.maxIndexSize}), stopping indexing`);
          break;
        }
      }

      // Then process directories if we haven't hit limits
      if (files.length < this.config.maxIndexSize && currentDepth < maxDepth) {
        const directories = sortedContents.filter(f => f.isDirectory);
        
        // Process directories in parallel but with concurrency limit
        const concurrencyLimit = 3;
        for (let i = 0; i < directories.length; i += concurrencyLimit) {
          const batch = directories.slice(i, i + concurrencyLimit);
          
          await Promise.allSettled(
            batch.map(dir =>
              this.indexDirectoryRecursive(
                client,
                dir.path,
                files,
                currentDepth + 1,
                maxDepth
              )
            )
          );

          // Check if we should continue
          if (files.length >= this.config.maxIndexSize) {
            console.warn(`Reached maximum index size during recursive indexing, stopping`);
            break;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to index directory ${currentPath} (depth ${currentDepth}):`, error);
      // Continue with other directories even if one fails
    }
  }

  /**
   * Parse WebDAV PROPFIND response into FileMetadata array
   */
  private parseWebDAVResponse(response: any, basePath: string, depth: number): FileMetadata[] {
    const files: FileMetadata[] = [];
    
    try {
      // Handle different response formats
      let items: any[] = [];
      
      if (typeof response === 'string') {
        // Parse XML response
        const xmlItems = this.parseXMLResponse(response);
        items = xmlItems;
      } else if (Array.isArray(response)) {
        items = response;
      } else if (response && typeof response === 'object') {
        // Handle single item or wrapped response
        if (response.items && Array.isArray(response.items)) {
          items = response.items;
        } else {
          items = [response];
        }
      }

      for (const item of items) {
        try {
          const fileMetadata = this.createFileMetadata(item, basePath, depth);
          if (fileMetadata) {
            files.push(fileMetadata);
          }
        } catch (error) {
          console.warn('Failed to parse file item:', error, item);
          // Continue with other items
        }
      }
    } catch (error) {
      console.error('Failed to parse WebDAV response:', error);
    }

    return files;
  }

  /**
   * Parse XML WebDAV response (basic implementation)
   */
  private parseXMLResponse(xmlString: string): any[] {
    const items: any[] = [];
    
    try {
      // Simple regex-based XML parsing for WebDAV responses
      const responseRegex = /<d:response[^>]*>(.*?)<\/d:response>/gs;
      const hrefRegex = /<d:href[^>]*>(.*?)<\/d:href>/i;
      const propsRegex = /<d:propstat[^>]*>.*?<d:prop[^>]*>(.*?)<\/d:prop>.*?<\/d:propstat>/is;
      
      let match;
      while ((match = responseRegex.exec(xmlString)) !== null) {
        const responseContent = match[1];
        
        const hrefMatch = hrefRegex.exec(responseContent);
        const propsMatch = propsRegex.exec(responseContent);
        
        if (hrefMatch && propsMatch) {
          const href = decodeURIComponent(hrefMatch[1]);
          const propsContent = propsMatch[1];
          
          // Extract properties
          const sizeMatch = /<d:getcontentlength[^>]*>(\d+)<\/d:getcontentlength>/i.exec(propsContent);
          const modifiedMatch = /<d:getlastmodified[^>]*>(.*?)<\/d:getlastmodified>/i.exec(propsContent);
          const contentTypeMatch = /<d:getcontenttype[^>]*>(.*?)<\/d:getcontenttype>/i.exec(propsContent);
          const isDirectoryMatch = /<d:resourcetype[^>]*>.*?<d:collection[^>]*\/?>.*?<\/d:resourcetype>/is.test(propsContent);
          
          items.push({
            href,
            size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
            lastModified: modifiedMatch ? new Date(modifiedMatch[1]) : new Date(),
            contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
            isDirectory: isDirectoryMatch
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse XML response:', error);
    }
    
    return items;
  }

  /**
   * Create FileMetadata from WebDAV response item
   */
  private createFileMetadata(item: any, basePath: string, depth: number): FileMetadata | null {
    try {
      // Extract path from href or use provided path
      let path = item.href || item.path || '';
      
      // Clean up path
      if (path.startsWith('/remote.php/dav/files/')) {
        // Extract the actual file path from WebDAV URL
        const pathParts = path.split('/');
        const userIndex = pathParts.findIndex((part: string) => part === 'files') + 2; // Skip username
        path = '/' + pathParts.slice(userIndex).join('/');
      }
      
      // Remove trailing slash for directories
      if (path.endsWith('/') && path !== '/') {
        path = path.slice(0, -1);
      }
      
      // Skip the current directory entry
      if (path === basePath) {
        return null;
      }

      const name = path.split('/').pop() || '';
      const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
      const size = item.size || item.contentLength || 0;
      const lastModified = item.lastModified ? new Date(item.lastModified) : new Date();
      const mimeType = item.contentType || item.mimeType || this.getMimeTypeFromExtension(extension);
      const isDirectory = item.isDirectory || item.resourceType === 'collection' || false;

      return {
        path,
        name,
        size,
        lastModified,
        mimeType,
        extension,
        isDirectory,
        depth
      };
    } catch (error) {
      console.warn('Failed to create file metadata:', error, item);
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    // Check if we have a mapping for this file type
    const fileType = FILE_TYPE_MAPPINGS[extension];
    
    switch (fileType) {
      case SupportedFileTypes.TEXT:
        return 'text/plain';
      case SupportedFileTypes.CODE:
        if (extension === 'js') return 'application/javascript';
        if (extension === 'html' || extension === 'htm') return 'text/html';
        if (extension === 'css') return 'text/css';
        return 'text/plain';
      case SupportedFileTypes.CONFIG:
        if (extension === 'json') return 'application/json';
        if (extension === 'xml') return 'application/xml';
        if (extension === 'yaml' || extension === 'yml') return 'application/x-yaml';
        return 'text/plain';
      case SupportedFileTypes.DOCUMENT:
        if (extension === 'pdf') return 'application/pdf';
        return 'application/octet-stream';
      case SupportedFileTypes.MEDIA:
        if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
        if (extension === 'png') return 'image/png';
        if (extension === 'gif') return 'image/gif';
        if (extension === 'svg') return 'image/svg+xml';
        if (extension === 'mp4') return 'video/mp4';
        if (extension === 'mp3') return 'audio/mpeg';
        return 'application/octet-stream';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Generate cache key for a path
   */
  private getCacheKey(path: string): string {
    return path.replace(/\/$/, '') || '/';
  }

  /**
   * Check if cached index is still valid
   */
  private isCacheValid(index: FileIndex): boolean {
    const age = Date.now() - index.lastUpdated.getTime();
    return age < this.config.indexTTL;
  }

  /**
   * Find best base path for a given path
   */
  private findBestBasePath(path: string): string {
    // Find the deepest cached path that contains this path
    const possiblePaths = Array.from(this.indexCache.keys())
      .filter(cachedPath => path.startsWith(cachedPath))
      .sort((a, b) => b.length - a.length);
    
    return possiblePaths[0] || '/';
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    if (this.indexCache.size <= this.config.maxIndexSize / 10) {
      return; // No cleanup needed
    }

    // Remove expired entries
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, index] of this.indexCache.entries()) {
      const age = now - index.lastUpdated.getTime();
      if (age > this.config.indexTTL) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.indexCache.delete(key));
    
    console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
  }
}