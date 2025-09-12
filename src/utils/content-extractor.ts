import { WebDAVClient } from '../client/webdav.js';
import { getClient } from './client-manager.js';
import {
  FileMetadata,
  SupportedFileTypes,
  FILE_TYPE_MAPPINGS,
  MIME_TYPE_MAPPINGS,
  SearchConfig,
  DEFAULT_SEARCH_CONFIG
} from '../models/webdav-search.js';

/**
 * Content cache entry
 */
interface ContentCacheEntry {
  content: string;
  timestamp: Date;
  size: number;
}

/**
 * Service for extracting searchable content from files
 */
export class ContentExtractor {
  private contentCache = new Map<string, ContentCacheEntry>();
  private config: SearchConfig;
  private totalCacheSize = 0;

  constructor(config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
    this.config = config;
  }

  /**
   * Extract searchable content from file based on type
   */
  async extractContent(file: FileMetadata): Promise<string> {
    // Check cache first
    const cacheKey = this.getCacheKey(file.path);
    const cached = this.contentCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached, file)) {
      return cached.content;
    }

    // Skip if file is too large
    if (file.size > this.config.maxFileSize) {
      console.log(`Skipping content extraction for large file: ${file.path} (${file.size} bytes)`);
      return this.extractMetadataAsText(file);
    }

    try {
      const fileType = this.getFileType(file.mimeType, file.extension);
      let content: string;

      switch (fileType) {
        case SupportedFileTypes.TEXT:
        case SupportedFileTypes.CODE:
        case SupportedFileTypes.CONFIG:
          content = await this.extractTextContent(file.path);
          break;
        case SupportedFileTypes.DOCUMENT:
        case SupportedFileTypes.MEDIA:
          content = this.extractMetadataAsText(file);
          break;
        default:
          content = this.extractMetadataAsText(file);
      }

      // Cache the content
      this.cacheContent(cacheKey, content, file.size);

      return content;
    } catch (error) {
      console.warn(`Failed to extract content from ${file.path}:`, error);
      return this.extractMetadataAsText(file);
    }
  }

  /**
   * Detect file type and determine extraction strategy
   */
  getFileType(mimeType: string, extension: string): SupportedFileTypes {
    // First try MIME type mapping
    if (mimeType && MIME_TYPE_MAPPINGS[mimeType]) {
      return MIME_TYPE_MAPPINGS[mimeType];
    }

    // Then try extension mapping
    if (extension && FILE_TYPE_MAPPINGS[extension]) {
      return FILE_TYPE_MAPPINGS[extension];
    }

    // Default to text if it looks like a text MIME type
    if (mimeType && mimeType.startsWith('text/')) {
      return SupportedFileTypes.TEXT;
    }

    // Default fallback
    return SupportedFileTypes.DOCUMENT;
  }

  /**
   * Check if file is searchable (has extractable content)
   */
  isSearchableContent(file: FileMetadata): boolean {
    const fileType = this.getFileType(file.mimeType, file.extension);
    return [
      SupportedFileTypes.TEXT,
      SupportedFileTypes.CODE,
      SupportedFileTypes.CONFIG
    ].includes(fileType);
  }

  /**
   * Get content preview (first few lines)
   */
  async getContentPreview(file: FileMetadata, maxLines: number = 3): Promise<string> {
    try {
      const content = await this.extractContent(file);
      const lines = content.split('\n').slice(0, maxLines);
      return lines.join('\n');
    } catch (error) {
      console.warn(`Failed to get content preview for ${file.path}:`, error);
      return '';
    }
  }

  /**
   * Clear content cache
   */
  clearCache(): void {
    this.contentCache.clear();
    this.totalCacheSize = 0;
    console.log('Content cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; totalSize: number; keys: string[] } {
    return {
      size: this.contentCache.size,
      totalSize: this.totalCacheSize,
      keys: Array.from(this.contentCache.keys())
    };
  }

  /**
   * Extract content from text files
   */
  private async extractTextContent(path: string): Promise<string> {
    try {
      const webdavClient = getClient(WebDAVClient);
      const content = await webdavClient.readFile(path);
      
      // Basic content cleaning
      return this.cleanTextContent(content);
    } catch (error) {
      console.warn(`Failed to read text content from ${path}:`, error);
      throw error;
    }
  }

  /**
   * Extract metadata as searchable text
   */
  public extractMetadataAsText(file: FileMetadata): string {
    const metadata: string[] = [];
    
    // Add filename (without extension)
    const nameWithoutExt = file.name.replace(new RegExp(`\\.${file.extension}$`), '');
    metadata.push(nameWithoutExt);
    
    // Add extension
    if (file.extension) {
      metadata.push(file.extension);
    }
    
    // Add MIME type description
    metadata.push(this.getMimeTypeDescription(file.mimeType));
    
    // Add size category
    metadata.push(this.getSizeCategory(file.size));
    
    // Add date information
    const dateStr = file.lastModified.toISOString().split('T')[0];
    metadata.push(dateStr);
    metadata.push(file.lastModified.getFullYear().toString());
    
    // Add path components (directories)
    const pathParts = file.path.split('/').filter(part => part.length > 0);
    metadata.push(...pathParts);
    
    return metadata.join(' ');
  }

  /**
   * Clean and normalize text content
   */
  private cleanTextContent(content: string): string {
    return content
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Limit length to prevent memory issues
      .substring(0, 100000) // 100KB limit
      .trim();
  }

  /**
   * Get human-readable MIME type description
   */
  private getMimeTypeDescription(mimeType: string): string {
    const descriptions: Record<string, string> = {
      'text/plain': 'text file',
      'text/markdown': 'markdown document',
      'text/csv': 'spreadsheet data',
      'application/json': 'json data',
      'text/xml': 'xml document',
      'application/xml': 'xml document',
      'text/html': 'web page',
      'text/css': 'stylesheet',
      'application/javascript': 'javascript code',
      'text/javascript': 'javascript code',
      'application/pdf': 'pdf document',
      'image/jpeg': 'jpeg image',
      'image/png': 'png image',
      'video/mp4': 'mp4 video',
      'audio/mpeg': 'mp3 audio'
    };
    
    return descriptions[mimeType] || mimeType.split('/')[0] || 'file';
  }

  /**
   * Get size category description
   */
  private getSizeCategory(size: number): string {
    if (size === 0) return 'empty';
    if (size < 1024) return 'tiny';
    if (size < 10 * 1024) return 'small';
    if (size < 100 * 1024) return 'medium';
    if (size < 1024 * 1024) return 'large';
    if (size < 10 * 1024 * 1024) return 'very large';
    return 'huge';
  }

  /**
   * Generate cache key for content
   */
  private getCacheKey(path: string): string {
    return path;
  }

  /**
   * Check if cached content is still valid
   */
  private isCacheValid(cached: ContentCacheEntry, file: FileMetadata): boolean {
    // Check if cache has expired
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.config.contentTTL) {
      return false;
    }

    // For now, we'll assume content is valid if not expired
    // In a more sophisticated implementation, we could check file modification time
    return true;
  }

  /**
   * Cache extracted content
   */
  private cacheContent(key: string, content: string, fileSize: number): void {
    // Check if we need to make space
    const contentSize = Buffer.byteLength(content, 'utf8');
    
    // Make space if needed
    while (this.totalCacheSize + contentSize > this.config.maxContentSize && this.contentCache.size > 0) {
      this.evictOldestCacheEntry();
    }

    // Don't cache if the content is too large
    if (contentSize > this.config.maxContentSize / 10) {
      console.log(`Not caching large content: ${key} (${contentSize} bytes)`);
      return;
    }

    // Cache the content
    this.contentCache.set(key, {
      content,
      timestamp: new Date(),
      size: contentSize
    });
    
    this.totalCacheSize += contentSize;
  }

  /**
   * Evict the oldest cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.contentCache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.contentCache.get(oldestKey);
      if (entry) {
        this.totalCacheSize -= entry.size;
        this.contentCache.delete(oldestKey);
      }
    }
  }
}

/**
 * Utility functions for content analysis
 */
export class ContentAnalyzer {
  /**
   * Extract keywords from content
   */
  static extractKeywords(content: string, maxKeywords: number = 20): string[] {
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 50)
      .filter(word => !this.isStopWord(word));

    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Sort by frequency and return top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  /**
   * Check if word is a stop word (common words to ignore)
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'as', 'up', 'it', 'is', 'be', 'are', 'was', 'were',
      'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'our',
      'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'from', 'into',
      'about', 'through', 'during', 'before', 'after', 'above', 'below',
      'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
      'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'd', 'll',
      'm', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn',
      'hadn', 'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn',
      'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Find text around search matches (context)
   */
  static findContext(content: string, searchTerm: string, contextSize: number = 50): string[] {
    const contexts: string[] = [];
    const lowerContent = content.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    let index = 0;
    while ((index = lowerContent.indexOf(lowerTerm, index)) !== -1) {
      const start = Math.max(0, index - contextSize);
      const end = Math.min(content.length, index + lowerTerm.length + contextSize);
      const context = content.substring(start, end);
      
      contexts.push(context.trim());
      index += lowerTerm.length;
      
      // Limit contexts to avoid too many results
      if (contexts.length >= 5) {
        break;
      }
    }
    
    return contexts;
  }
}