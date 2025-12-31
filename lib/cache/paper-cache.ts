/**
 * Paper Content Cache
 * Local file system cache for downloaded paper content
 */

import { mkdir, readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { getPaperAnalysisConfig } from '@/lib/config/paper-analysis';

const CACHE_VERSION = 'v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get cache file path for a given arxiv_id
 */
function getCachePath(arxivId: string): string {
  const config = getPaperAnalysisConfig();
  const cleanId = arxivId.replace(/^arxiv:/i, '').replace(/v\d+$/, '');
  return join(config.cachePath, `${cleanId}.txt`);
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  const config = getPaperAnalysisConfig();
  if (!existsSync(config.cachePath)) {
    await mkdir(config.cachePath, { recursive: true });
  }
}

/**
 * Get cached paper content
 * Returns null if not cached or expired
 */
export async function getCachedPaper(arxivId: string): Promise<string | null> {
  const cachePath = getCachePath(arxivId);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const stats = await stat(cachePath);
    const age = Date.now() - stats.mtimeMs;

    // Check if cache is expired
    if (age > CACHE_TTL) {
      console.log(`[Cache] Expired for ${arxivId}`);
      return null;
    }

    const content = await readFile(cachePath, 'utf-8');
    console.log(`[Cache] Hit for ${arxivId} (${Math.round(age / 1000)}s old)`);
    return content;
  } catch (error) {
    console.error(`[Cache] Error reading for ${arxivId}:`, error);
    return null;
  }
}

/**
 * Set cached paper content
 */
export async function setCachedPaper(arxivId: string, content: string): Promise<void> {
  await ensureCacheDir();

  const cachePath = getCachePath(arxivId);

  try {
    await writeFile(cachePath, content, 'utf-8');
    console.log(`[Cache] Saved for ${arxivId} (${content.length} chars)`);
  } catch (error) {
    console.error(`[Cache] Error saving for ${arxivId}:`, error);
  }
}

/**
 * Delete cached paper content
 */
export async function deleteCachedPaper(arxivId: string): Promise<void> {
  const cachePath = getCachePath(arxivId);

  if (existsSync(cachePath)) {
    const { unlink } = require('fs/promises');
    try {
      await unlink(cachePath);
      console.log(`[Cache] Deleted for ${arxivId}`);
    } catch (error) {
      console.error(`[Cache] Error deleting for ${arxivId}:`, error);
    }
  }
}

/**
 * Clear all cached papers
 */
export async function clearAllCache(): Promise<void> {
  const config = getPaperAnalysisConfig();

  if (!existsSync(config.cachePath)) {
    return;
  }

  const { readdir, unlink } = require('fs/promises');

  try {
    const files = await readdir(config.cachePath);
    for (const file of files) {
      if (file.endsWith('.txt')) {
        await unlink(join(config.cachePath, file));
      }
    }
    console.log(`[Cache] Cleared all (${files.length} files)`);
  } catch (error) {
    console.error('[Cache] Error clearing:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
}> {
  const config = getPaperAnalysisConfig();

  if (!existsSync(config.cachePath)) {
    return { count: 0, totalSize: 0 };
  }

  const { readdir, stat } = require('fs/promises');

  try {
    const files = await readdir(config.cachePath);
    const txtFiles = files.filter((f: string) => f.endsWith('.txt'));

    let totalSize = 0;
    for (const file of txtFiles) {
      const stats = await stat(join(config.cachePath, file));
      totalSize += stats.size;
    }

    return {
      count: txtFiles.length,
      totalSize,
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return { count: 0, totalSize: 0 };
  }
}
