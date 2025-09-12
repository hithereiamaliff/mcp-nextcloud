/**
 * Models and interfaces for WebDAV unified search system
 */

/**
 * Metadata for a file or directory
 */
export interface FileMetadata {
  path: string;              // Full path to file
  name: string;              // Filename only
  size: number;              // File size in bytes
  lastModified: Date;        // Last modification date
  mimeType: string;          // MIME type
  extension: string;         // File extension
  isDirectory: boolean;      // Whether it's a directory
  depth: number;            // Directory depth from root
}

/**
 * Search result containing file metadata and match information
 */
export interface SearchResult {
  file: FileMetadata;
  matchType: 'filename' | 'content' | 'metadata';
  relevanceScore: number;    // 0-100 relevance score
  contentPreview?: string;   // First few lines if content match
  highlights: string[];      // Matching terms
  context?: string;          // Surrounding context for content matches
}

/**
 * Options for configuring search behavior
 */
export interface SearchOptions {
  query: string;                    // Search terms
  searchIn: SearchScope[];          // What to search in
  fileTypes?: string[];             // Filter by extensions
  sizeRange?: { min?: number; max?: number };
  dateRange?: { from?: Date; to?: Date };
  basePath?: string;                // Limit to specific directory
  limit?: number;                   // Max results (default: 50)
  includeContent?: boolean;         // Include content preview
  caseSensitive?: boolean;          // Case sensitive search
}

/**
 * Scope of search - what to search in
 */
export type SearchScope = 'filename' | 'content' | 'metadata';

/**
 * File index containing cached metadata
 */
export interface FileIndex {
  basePath: string;
  lastUpdated: Date;
  files: FileMetadata[];
  totalSize: number;
  directoryCount: number;
  fileCount: number;
}

/**
 * Cache entry for search results
 */
export interface SearchCache {
  query: string;
  options: SearchOptions;
  results: SearchResult[];
  timestamp: Date;
}

/**
 * Supported file types for content extraction
 */
export enum SupportedFileTypes {
  TEXT = 'text',        // .txt, .md, .csv, etc.
  DOCUMENT = 'document', // .pdf, .doc, .docx (metadata only)
  CODE = 'code',        // .js, .ts, .py, .java, etc.
  CONFIG = 'config',    // .json, .xml, .yaml, etc.
  MEDIA = 'media'       // .jpg, .png, .mp4 (metadata only)
}

/**
 * Configuration for the search system
 */
export interface SearchConfig {
  indexTTL: number;          // Index cache time-to-live (milliseconds)
  contentTTL: number;        // Content cache TTL (milliseconds)
  maxIndexSize: number;      // Max files in index cache
  maxContentSize: number;    // Max content cache size (bytes)
  maxFileSize: number;       // Max file size to extract content from
  maxDepth: number;         // Max directory depth to index
}

/**
 * Default search configuration
 */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  indexTTL: 15 * 60 * 1000,      // 15 minutes
  contentTTL: 5 * 60 * 1000,     // 5 minutes
  maxIndexSize: 10000,           // 10,000 files
  maxContentSize: 100 * 1024 * 1024, // 100MB
  maxFileSize: 10 * 1024 * 1024, // 10MB per file
  maxDepth: 10                   // 10 levels deep
};

/**
 * File type mappings for content extraction
 */
export const FILE_TYPE_MAPPINGS: Record<string, SupportedFileTypes> = {
  // Text files
  'txt': SupportedFileTypes.TEXT,
  'md': SupportedFileTypes.TEXT,
  'markdown': SupportedFileTypes.TEXT,
  'csv': SupportedFileTypes.TEXT,
  'tsv': SupportedFileTypes.TEXT,
  'log': SupportedFileTypes.TEXT,
  
  // Code files
  'js': SupportedFileTypes.CODE,
  'ts': SupportedFileTypes.CODE,
  'jsx': SupportedFileTypes.CODE,
  'tsx': SupportedFileTypes.CODE,
  'py': SupportedFileTypes.CODE,
  'java': SupportedFileTypes.CODE,
  'c': SupportedFileTypes.CODE,
  'cpp': SupportedFileTypes.CODE,
  'h': SupportedFileTypes.CODE,
  'cs': SupportedFileTypes.CODE,
  'php': SupportedFileTypes.CODE,
  'rb': SupportedFileTypes.CODE,
  'go': SupportedFileTypes.CODE,
  'rs': SupportedFileTypes.CODE,
  'swift': SupportedFileTypes.CODE,
  'kt': SupportedFileTypes.CODE,
  'sql': SupportedFileTypes.CODE,
  'html': SupportedFileTypes.CODE,
  'htm': SupportedFileTypes.CODE,
  'css': SupportedFileTypes.CODE,
  'scss': SupportedFileTypes.CODE,
  'sass': SupportedFileTypes.CODE,
  'less': SupportedFileTypes.CODE,
  
  // Configuration files
  'json': SupportedFileTypes.CONFIG,
  'xml': SupportedFileTypes.CONFIG,
  'yaml': SupportedFileTypes.CONFIG,
  'yml': SupportedFileTypes.CONFIG,
  'toml': SupportedFileTypes.CONFIG,
  'ini': SupportedFileTypes.CONFIG,
  'conf': SupportedFileTypes.CONFIG,
  'config': SupportedFileTypes.CONFIG,
  'properties': SupportedFileTypes.CONFIG,
  'env': SupportedFileTypes.CONFIG,
  
  // Document files (metadata only)
  'pdf': SupportedFileTypes.DOCUMENT,
  'doc': SupportedFileTypes.DOCUMENT,
  'docx': SupportedFileTypes.DOCUMENT,
  'xls': SupportedFileTypes.DOCUMENT,
  'xlsx': SupportedFileTypes.DOCUMENT,
  'ppt': SupportedFileTypes.DOCUMENT,
  'pptx': SupportedFileTypes.DOCUMENT,
  'odt': SupportedFileTypes.DOCUMENT,
  'ods': SupportedFileTypes.DOCUMENT,
  'odp': SupportedFileTypes.DOCUMENT,
  
  // Media files (metadata only)
  'jpg': SupportedFileTypes.MEDIA,
  'jpeg': SupportedFileTypes.MEDIA,
  'png': SupportedFileTypes.MEDIA,
  'gif': SupportedFileTypes.MEDIA,
  'bmp': SupportedFileTypes.MEDIA,
  'svg': SupportedFileTypes.MEDIA,
  'webp': SupportedFileTypes.MEDIA,
  'mp4': SupportedFileTypes.MEDIA,
  'avi': SupportedFileTypes.MEDIA,
  'mov': SupportedFileTypes.MEDIA,
  'mkv': SupportedFileTypes.MEDIA,
  'wmv': SupportedFileTypes.MEDIA,
  'mp3': SupportedFileTypes.MEDIA,
  'wav': SupportedFileTypes.MEDIA,
  'flac': SupportedFileTypes.MEDIA,
  'aac': SupportedFileTypes.MEDIA,
  'ogg': SupportedFileTypes.MEDIA,
};

/**
 * MIME type mappings for file type detection
 */
export const MIME_TYPE_MAPPINGS: Record<string, SupportedFileTypes> = {
  // Text MIME types
  'text/plain': SupportedFileTypes.TEXT,
  'text/markdown': SupportedFileTypes.TEXT,
  'text/csv': SupportedFileTypes.TEXT,
  
  // Code MIME types
  'text/javascript': SupportedFileTypes.CODE,
  'application/javascript': SupportedFileTypes.CODE,
  'text/html': SupportedFileTypes.CODE,
  'text/css': SupportedFileTypes.CODE,
  'text/x-python': SupportedFileTypes.CODE,
  'text/x-java-source': SupportedFileTypes.CODE,
  'text/x-c': SupportedFileTypes.CODE,
  'text/x-c++': SupportedFileTypes.CODE,
  
  // Configuration MIME types
  'application/json': SupportedFileTypes.CONFIG,
  'text/xml': SupportedFileTypes.CONFIG,
  'application/xml': SupportedFileTypes.CONFIG,
  'text/yaml': SupportedFileTypes.CONFIG,
  'application/x-yaml': SupportedFileTypes.CONFIG,
  
  // Document MIME types
  'application/pdf': SupportedFileTypes.DOCUMENT,
  'application/msword': SupportedFileTypes.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': SupportedFileTypes.DOCUMENT,
  'application/vnd.ms-excel': SupportedFileTypes.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': SupportedFileTypes.DOCUMENT,
  
  // Media MIME types
  'image/jpeg': SupportedFileTypes.MEDIA,
  'image/png': SupportedFileTypes.MEDIA,
  'image/gif': SupportedFileTypes.MEDIA,
  'image/svg+xml': SupportedFileTypes.MEDIA,
  'video/mp4': SupportedFileTypes.MEDIA,
  'video/avi': SupportedFileTypes.MEDIA,
  'audio/mpeg': SupportedFileTypes.MEDIA,
  'audio/wav': SupportedFileTypes.MEDIA,
};

/**
 * Search query parser result
 */
export interface ParsedQuery {
  terms: string[];           // Individual search terms
  operators: QueryOperator[]; // Query operators
  filters: QueryFilter[];    // Query filters
  originalQuery: string;     // Original query string
}

/**
 * Query operators (AND, OR, NOT)
 */
export interface QueryOperator {
  type: 'AND' | 'OR' | 'NOT';
  left: string;
  right?: string;
}

/**
 * Query filters (filename:, ext:, size:, etc.)
 */
export interface QueryFilter {
  field: 'filename' | 'content' | 'ext' | 'size' | 'modified';
  operator: '=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: string | number | Date;
}