import { FileIndexer } from './file-indexer.js';
import { ContentExtractor, ContentAnalyzer } from './content-extractor.js';
import { WebDAVClient } from '../client/webdav.js';
import { getClient } from './client-manager.js';
import {
  SearchOptions,
  SearchResult,
  FileMetadata,
  FileIndex,
  ParsedQuery,
  QueryFilter,
  QueryOperator,
  SearchScope,
  SearchConfig,
  DEFAULT_SEARCH_CONFIG
} from '../models/webdav-search.js';

/**
 * Main search engine for WebDAV files
 */
export class SearchEngine {
  private indexer: FileIndexer;
  private extractor: ContentExtractor;
  private config: SearchConfig;
  private resultCache = new Map<string, { results: SearchResult[]; timestamp: Date }>();

  constructor(
    indexer?: FileIndexer,
    extractor?: ContentExtractor,
    config: SearchConfig = DEFAULT_SEARCH_CONFIG
  ) {
    this.indexer = indexer || new FileIndexer(config);
    this.extractor = extractor || new ContentExtractor(config);
    this.config = config;
  }

  /**
   * Main search method
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    console.log('Starting search with options:', options);

    // Parse and validate query outside try block for scope
    const parsedQuery = this.parseQuery(options.query);
    if (parsedQuery.terms.length === 0) {
      return [];
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(options);
      const cached = this.resultCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        console.log('Returning cached search results');
        return cached.results;
      }

      // Get file index with smart mode selection
      const useQuickMode = options.basePath === '/' || !options.basePath;
      const index = await this.indexer.getIndex(options.basePath || '/', useQuickMode);
      console.log(`Searching in index with ${index.fileCount} files (quick mode: ${useQuickMode})`);

      // Apply file type and date filters first to reduce search scope
      let filteredFiles = this.applyPreFilters(index.files, options);
      console.log(`After pre-filtering: ${filteredFiles.length} files`);

      // Perform searches based on scope
      const allResults: SearchResult[] = [];

      if (options.searchIn.includes('filename')) {
        const filenameResults = this.searchFilenames(parsedQuery, filteredFiles);
        allResults.push(...filenameResults);
      }

      if (options.searchIn.includes('metadata')) {
        const metadataResults = this.searchMetadata(parsedQuery, filteredFiles);
        allResults.push(...metadataResults);
      }

      if (options.searchIn.includes('content')) {
        const contentResults = await this.searchContent(parsedQuery, filteredFiles);
        allResults.push(...contentResults);
      }

      // Remove duplicates and merge results
      const mergedResults = this.mergeResults(allResults);

      // Apply additional filters
      const filteredResults = this.applyPostFilters(mergedResults, options);

      // Rank and sort results
      const rankedResults = this.rankResults(filteredResults, parsedQuery);

      // Apply limit
      const finalResults = rankedResults.slice(0, options.limit || 50);

      // Add content previews if requested
      if (options.includeContent) {
        await this.addContentPreviews(finalResults);
      }

      // Cache results
      this.cacheResults(cacheKey, finalResults);

      console.log(`Search completed: ${finalResults.length} results`);
      return finalResults;

    } catch (error) {
      console.error('Search failed:', error);
      // Try fallback search for critical failures
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('index'))) {
        console.log('Attempting fallback search due to indexing issues');
        try {
          return await this.performFallbackSearch(options, parsedQuery);
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError);
        }
      }
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform the main search operation
   */
  private async performSearch(options: SearchOptions, parsedQuery: ParsedQuery): Promise<SearchResult[]> {
    // Get file index with smart mode selection
    const useQuickMode = options.basePath === '/' || !options.basePath;
    const index = await this.indexer.getIndex(options.basePath || '/', useQuickMode);
    console.log(`Searching in index with ${index.fileCount} files (quick mode: ${useQuickMode})`);

    // Apply file type and date filters first to reduce search scope
    let filteredFiles = this.applyPreFilters(index.files, options);
    console.log(`After pre-filtering: ${filteredFiles.length} files`);

    // Perform searches based on scope
    const allResults: SearchResult[] = [];

    if (options.searchIn.includes('filename')) {
      const filenameResults = this.searchFilenames(parsedQuery, filteredFiles);
      allResults.push(...filenameResults);
    }

    if (options.searchIn.includes('metadata')) {
      const metadataResults = this.searchMetadata(parsedQuery, filteredFiles);
      allResults.push(...metadataResults);
    }

    if (options.searchIn.includes('content')) {
      // Limit content search for large datasets
      const contentSearchFiles = useQuickMode ? filteredFiles.slice(0, 100) : filteredFiles;
      const contentResults = await this.searchContent(parsedQuery, contentSearchFiles);
      allResults.push(...contentResults);
    }

    // Remove duplicates and merge results
    const mergedResults = this.mergeResults(allResults);

    // Apply additional filters
    const filteredResults = this.applyPostFilters(mergedResults, options);

    // Rank and sort results
    const rankedResults = this.rankResults(filteredResults, parsedQuery);

    // Apply limit
    const finalResults = rankedResults.slice(0, options.limit || 50);

    // Add content previews if requested
    if (options.includeContent) {
      await this.addContentPreviews(finalResults);
    }

    return finalResults;
  }

  /**
   * Fallback search when full indexing fails or times out
   */
  private async performFallbackSearch(options: SearchOptions, parsedQuery: ParsedQuery): Promise<SearchResult[]> {
    console.log('Performing fallback search with limited scope');
    
    try {
      // Try to get just the immediate directory listing
      const webdavClient = getClient(WebDAVClient);
      const basePath = options.basePath || '/';
      const directoryContents = await webdavClient.listDirectory(basePath);
      
      // Parse the directory contents into file metadata
      const files = this.parseDirectoryContents(directoryContents, basePath);
      console.log(`Fallback search: found ${files.length} files in immediate directory`);
      
      // Apply filters
      const filteredFiles = this.applyPreFilters(files, options);
      
      // Search only in filenames and metadata (skip content search for fallback)
      const results: SearchResult[] = [];
      
      if (options.searchIn.includes('filename')) {
        const filenameResults = this.searchFilenames(parsedQuery, filteredFiles);
        results.push(...filenameResults);
      }
      
      if (options.searchIn.includes('metadata')) {
        const metadataResults = this.searchMetadata(parsedQuery, filteredFiles);
        results.push(...metadataResults);
      }
      
      // Merge, filter, and rank results
      const mergedResults = this.mergeResults(results);
      const filteredResults = this.applyPostFilters(mergedResults, options);
      const rankedResults = this.rankResults(filteredResults, parsedQuery);
      
      const finalResults = rankedResults.slice(0, options.limit || 20); // Smaller limit for fallback
      
      console.log(`Fallback search completed: ${finalResults.length} results`);
      return finalResults;
      
    } catch (error) {
      console.error('Fallback search failed:', error);
      return []; // Return empty results rather than failing completely
    }
  }

  /**
   * Parse directory contents into FileMetadata array (simplified)
   */
  private parseDirectoryContents(contents: any, basePath: string): FileMetadata[] {
    const files: FileMetadata[] = [];
    
    try {
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
        try {
          const path = item.path || item.href || `${basePath}/${item.name}`;
          const name = item.name || path.split('/').pop() || '';
          const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
          
          files.push({
            path,
            name,
            size: item.size || 0,
            lastModified: item.lastModified ? new Date(item.lastModified) : new Date(),
            mimeType: item.mimeType || item.contentType || 'application/octet-stream',
            extension,
            isDirectory: item.isDirectory || false,
            depth: 0
          });
        } catch (error) {
          console.warn('Failed to parse directory item:', error, item);
        }
      }
    } catch (error) {
      console.warn('Failed to parse directory contents:', error);
    }
    
    return files;
  }

  /**
   * Search in filenames
   */
  private searchFilenames(query: ParsedQuery, files: FileMetadata[]): SearchResult[] {
    const results: SearchResult[] = [];

    for (const file of files) {
      const relevance = this.calculateFilenameRelevance(file.name, query.terms);
      if (relevance > 0) {
        results.push({
          file,
          matchType: 'filename',
          relevanceScore: relevance,
          highlights: this.findHighlights(file.name, query.terms),
          context: file.name
        });
      }
    }

    return results;
  }

  /**
   * Search in file metadata
   */
  private searchMetadata(query: ParsedQuery, files: FileMetadata[]): SearchResult[] {
    const results: SearchResult[] = [];

    for (const file of files) {
      const metadataText = this.extractor.extractMetadataAsText(file);
      const relevance = this.calculateContentRelevance(metadataText, query.terms);
      
      if (relevance > 0) {
        results.push({
          file,
          matchType: 'metadata',
          relevanceScore: relevance * 0.7, // Lower weight for metadata matches
          highlights: this.findHighlights(metadataText, query.terms),
          context: metadataText.substring(0, 200)
        });
      }
    }

    return results;
  }

  /**
   * Search in file content
   */
  private async searchContent(query: ParsedQuery, files: FileMetadata[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Only search content for files that can have extractable content
    const searchableFiles = files.filter(file => 
      this.extractor.isSearchableContent(file) && 
      file.size <= this.config.maxFileSize
    );

    console.log(`Searching content in ${searchableFiles.length} files`);

    // Process files in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < searchableFiles.length; i += batchSize) {
      const batch = searchableFiles.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file): Promise<SearchResult | null> => {
        try {
          const content = await this.extractor.extractContent(file);
          const relevance = this.calculateContentRelevance(content, query.terms);
          
          if (relevance > 0) {
            const contexts = ContentAnalyzer.findContext(content, query.terms.join(' '));
            return {
              file,
              matchType: 'content' as const,
              relevanceScore: relevance,
              highlights: this.findHighlights(content, query.terms),
              context: contexts[0] || content.substring(0, 200)
            };
          }
        } catch (error) {
          console.warn(`Failed to search content in ${file.path}:`, error);
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as SearchResult[]);
    }

    return results;
  }

  /**
   * Parse search query into components
   */
  private parseQuery(query: string): ParsedQuery {
    // Simple query parsing - can be enhanced with more sophisticated parsing
    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0)
      .filter(term => !this.isStopWord(term));

    return {
      terms,
      operators: [], // TODO: Implement operator parsing
      filters: [], // TODO: Implement filter parsing
      originalQuery: query
    };
  }

  /**
   * Calculate filename relevance score
   */
  private calculateFilenameRelevance(filename: string, searchTerms: string[]): number {
    const lowerFilename = filename.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      
      // Exact match gets highest score
      if (lowerFilename === lowerTerm) {
        score += 100;
      }
      // Exact word match
      else if (lowerFilename.includes(` ${lowerTerm} `) || 
               lowerFilename.startsWith(`${lowerTerm} `) ||
               lowerFilename.endsWith(` ${lowerTerm}`)) {
        score += 80;
      }
      // Contains term
      else if (lowerFilename.includes(lowerTerm)) {
        // Higher score if term is at the beginning
        const index = lowerFilename.indexOf(lowerTerm);
        const baseScore = 60;
        const positionBonus = Math.max(0, 20 - (index / lowerFilename.length) * 20);
        score += baseScore + positionBonus;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate content relevance score
   */
  private calculateContentRelevance(content: string, searchTerms: string[]): number {
    const lowerContent = content.toLowerCase();
    let score = 0;
    let totalMatches = 0;

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      const matches = (lowerContent.match(new RegExp(lowerTerm, 'g')) || []).length;
      
      if (matches > 0) {
        totalMatches += matches;
        // Score based on frequency, but with diminishing returns
        score += Math.min(50, matches * 10);
      }
    }

    // Bonus for multiple term matches
    if (searchTerms.length > 1) {
      const uniqueMatches = searchTerms.filter(term => 
        lowerContent.includes(term.toLowerCase())
      ).length;
      score += (uniqueMatches / searchTerms.length) * 30;
    }

    return Math.min(100, score);
  }

  /**
   * Find highlighted terms in text
   */
  private findHighlights(text: string, searchTerms: string[]): string[] {
    const highlights: string[] = [];
    const lowerText = text.toLowerCase();

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      if (lowerText.includes(lowerTerm)) {
        // Find the actual case-preserved term
        const index = lowerText.indexOf(lowerTerm);
        if (index !== -1) {
          const actualTerm = text.substring(index, index + term.length);
          highlights.push(actualTerm);
        }
      }
    }

    return [...new Set(highlights)]; // Remove duplicates
  }

  /**
   * Apply pre-filters (file type, size, date)
   */
  private applyPreFilters(files: FileMetadata[], options: SearchOptions): FileMetadata[] {
    return files.filter(file => {
      // File type filter
      if (options.fileTypes && options.fileTypes.length > 0) {
        if (!options.fileTypes.includes(file.extension)) {
          return false;
        }
      }

      // Size range filter
      if (options.sizeRange) {
        if (options.sizeRange.min && file.size < options.sizeRange.min) {
          return false;
        }
        if (options.sizeRange.max && file.size > options.sizeRange.max) {
          return false;
        }
      }

      // Date range filter
      if (options.dateRange) {
        if (options.dateRange.from && file.lastModified < options.dateRange.from) {
          return false;
        }
        if (options.dateRange.to && file.lastModified > options.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply post-filters and additional processing
   */
  private applyPostFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
    return results.filter(result => {
      // Case sensitivity filter
      if (options.caseSensitive) {
        return result.highlights.some(highlight => 
          options.query.split(/\s+/).some(term => highlight.includes(term))
        );
      }
      
      return true;
    });
  }

  /**
   * Merge duplicate results from different search types
   */
  private mergeResults(results: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of results) {
      const key = result.file.path;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, result);
      } else {
        // Merge results for the same file, keeping the higher scoring match type
        if (result.relevanceScore > existing.relevanceScore) {
          merged.set(key, {
            ...result,
            highlights: [...new Set([...existing.highlights, ...result.highlights])]
          });
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Rank and sort results
   */
  private rankResults(results: SearchResult[], query: ParsedQuery): SearchResult[] {
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateFinalScore(result, query)
      }))
      .sort((a, b) => {
        // Primary sort: relevance score
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        
        // Secondary sort: match type priority
        const matchTypePriority = { filename: 3, content: 2, metadata: 1 };
        const aPriority = matchTypePriority[a.matchType];
        const bPriority = matchTypePriority[b.matchType];
        if (bPriority !== aPriority) {
          return bPriority - aPriority;
        }
        
        // Tertiary sort: file name alphabetically
        return a.file.name.localeCompare(b.file.name);
      });
  }

  /**
   * Calculate final relevance score with bonuses
   */
  private calculateFinalScore(result: SearchResult, query: ParsedQuery): number {
    let score = result.relevanceScore;

    // Bonus for recent files (within last 30 days)
    const daysSinceModified = (Date.now() - result.file.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified <= 30) {
      score += Math.max(0, 10 - (daysSinceModified / 30) * 10);
    }

    // Bonus for smaller files (easier to work with)
    if (result.file.size < 100 * 1024) { // < 100KB
      score += 5;
    }

    // Bonus for certain file types
    const preferredExtensions = ['txt', 'md', 'json', 'js', 'ts', 'py'];
    if (preferredExtensions.includes(result.file.extension)) {
      score += 3;
    }

    return Math.min(100, score);
  }

  /**
   * Add content previews to results
   */
  private async addContentPreviews(results: SearchResult[]): Promise<void> {
    for (const result of results) {
      try {
        if (result.matchType === 'content' || result.matchType === 'filename') {
          result.contentPreview = await this.extractor.getContentPreview(result.file, 3);
        }
      } catch (error) {
        console.warn(`Failed to get content preview for ${result.file.path}:`, error);
      }
    }
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Generate cache key for search results
   */
  private getCacheKey(options: SearchOptions): string {
    return JSON.stringify({
      query: options.query.toLowerCase(),
      searchIn: options.searchIn.sort(),
      fileTypes: options.fileTypes?.sort(),
      basePath: options.basePath,
      caseSensitive: options.caseSensitive
    });
  }

  /**
   * Check if cached results are still valid
   */
  private isCacheValid(cached: { results: SearchResult[]; timestamp: Date }): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < 60000; // 1 minute cache
  }

  /**
   * Cache search results
   */
  private cacheResults(key: string, results: SearchResult[]): void {
    this.resultCache.set(key, {
      results,
      timestamp: new Date()
    });

    // Clean up old cache entries
    if (this.resultCache.size > 100) {
      const oldestKey = Array.from(this.resultCache.keys())[0];
      this.resultCache.delete(oldestKey);
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.resultCache.clear();
    this.indexer.clearCache();
    this.extractor.clearCache();
    console.log('All search caches cleared');
  }

  /**
   * Get search statistics
   */
  getStats(): {
    resultCacheSize: number;
    indexCacheStats: any;
    contentCacheStats: any;
  } {
    return {
      resultCacheSize: this.resultCache.size,
      indexCacheStats: this.indexer.getCacheStats(),
      contentCacheStats: this.extractor.getCacheStats()
    };
  }
}