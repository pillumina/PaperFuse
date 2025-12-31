/**
 * ArXiv LaTeX Source Fetcher
 * Downloads and extracts LaTeX source code from ArXiv
 */

import { spawn } from 'child_process';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';

export interface LatexFile {
  path: string;
  content: string;
}

export interface LatexFiles {
  files: LatexFile[];
  mainFile: string | null;
}

/**
 * Download LaTeX source from ArXiv
 * ArXiv returns a tar.gz or zip file containing the source
 */
export async function downloadLatexSource(arxivId: string): Promise<Buffer> {
  const cleanId = arxivId.replace(/^arxiv:/i, '').replace(/v\d+$/, '');
  const url = `https://arxiv.org/e-print/${cleanId}`;

  console.log(`[LaTeX] Downloading from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`LaTeX source not found for ${arxivId}`);
    }
    throw new Error(`Failed to download LaTeX source: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract tar.gz or zip archive
 * Returns list of files with their content
 */
export async function extractLatexArchive(buffer: Buffer): Promise<LatexFiles> {
  // Create a temporary directory
  const tempDir = join(process.cwd(), '.tmp', 'latex', randomBytes(8).toString('hex'));
  await mkdir(tempDir, { recursive: true });

  const archivePath = join(tempDir, 'archive');

  try {
    // Write buffer to file
    await writeFile(archivePath, buffer);

    // Detect format and extract
    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;

    let extractDir: string;

    if (isGzip) {
      // Use tar to extract
      extractDir = join(tempDir, 'extracted');
      await mkdir(extractDir, { recursive: true });
      await runCommand('tar', ['-xzf', archivePath, '-C', extractDir]);
    } else if (isZip) {
      // Use unzip to extract
      extractDir = join(tempDir, 'extracted');
      await mkdir(extractDir, { recursive: true });
      await runCommand('unzip', ['-q', archivePath, '-d', extractDir]);
    } else {
      throw new Error('Unknown archive format');
    }

    // Find all .tex files recursively
    const texFiles = await findTexFiles(extractDir);

    // Find main .tex file
    const mainFile = findMainTexFile(texFiles);

    return {
      files: texFiles,
      mainFile,
    };
  } finally {
    // Cleanup temp directory
    // Note: In production, you might want to keep this for debugging
  }
}

/**
 * Find all .tex files in a directory recursively
 */
async function findTexFiles(dir: string): Promise<LatexFile[]> {
  const { exec } = require('child_process');
  const { promisify } = require('util');

  const execAsync = promisify(exec);

  try {
    // Use find command to get all .tex files
    const { stdout } = await execAsync(`find "${dir}" -name "*.tex" -type f`);

    const files: LatexFile[] = [];
    const paths = stdout.trim().split('\n').filter(Boolean);

    for (const path of paths) {
      const content = await readFile(path, 'utf-8');
      files.push({
        path: path.replace(dir + '/', ''),
        content,
      });
    }

    return files;
  } catch (error) {
    console.error('[LaTeX] Error finding .tex files:', error);
    return [];
  }
}

/**
 * Find the main .tex file
 * Heuristics:
 * 1. Look for common main file names
 * 2. Look for file containing \documentclass
 * 3. Use the first .tex file as fallback
 */
function findMainTexFile(files: LatexFile[]): string | null {
  if (files.length === 0) {
    return null;
  }

  // Priority 1: Common main file names
  const mainFileNames = ['main.tex', 'paper.tex', 'article.tex', 'ms.tex', 'root.tex'];
  for (const fileName of mainFileNames) {
    const found = files.find(f => f.path.endsWith(fileName) || f.path === fileName);
    if (found) {
      console.log(`[LaTeX] Found main file by name: ${found.path}`);
      return found.content;
    }
  }

  // Priority 2: File with \documentclass (usually main)
  for (const file of files) {
    if (file.content.includes('\\documentclass')) {
      console.log(`[LaTeX] Found main file by \\documentclass: ${file.path}`);
      return file.content;
    }
  }

  // Fallback: First .tex file
  console.log(`[LaTeX] Using first .tex file as main: ${files[0].path}`);
  return files[0].content;
}

/**
 * Run a shell command and return when complete
 */
function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stderr = '';

    proc.on('error', (error) => {
      reject(new Error(`Failed to run ${command}: ${error.message}`));
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Expand all \input and \include commands recursively
 * This combines all LaTeX files into a single document
 */
function expandLatexInputs(content: string, files: LatexFile[], processed: Set<string> = new Set(), missingFiles: string[] = [], depth: number = 0): string {
  // Safety: limit recursion depth
  const MAX_DEPTH = 50;
  if (depth > MAX_DEPTH) {
    console.warn(`[LaTeX] Reached maximum recursion depth (${MAX_DEPTH}), stopping expansion`);
    return content;
  }

  let expanded = content;
  let expansionCount = 0;
  const MAX_EXPANSIONS = 100;  // Limit total number of expansions

  // Match \input{filename} or \include{filename}
  // Handle various formats: \input{file.tex}, \input{file}, \input{sections/file.tex}, etc.
  const inputPattern = /\\(input|include)\{([^}]+)\}/g;

  let match;
  while ((match = inputPattern.exec(expanded)) !== null) {
    // Safety: limit total expansions
    if (expansionCount >= MAX_EXPANSIONS) {
      console.warn(`[LaTeX] Reached maximum expansion count (${MAX_EXPANSIONS}), skipping remaining inputs`);
      break;
    }

    const fullMatch = match[0];  // e.g., \input{sections/intro.tex}
    const command = match[1];    // input or include
    const filename = match[2];   // e.g., sections/intro.tex

    // Skip if already processed this file (avoid infinite loops)
    if (processed.has(filename)) {
      expanded = expanded.replace(fullMatch, `\n% [Already included: ${filename}]\n`);
      continue;
    }

    // Find the referenced file
    let referencedFile = files.find(f => f.path === filename || f.path.endsWith(filename));

    // Try without .tex extension
    if (!referencedFile && !filename.endsWith('.tex')) {
      referencedFile = files.find(f => f.path === filename + '.tex' || f.path.endsWith(filename + '.tex'));
    }

    if (referencedFile) {
      processed.add(filename);
      expansionCount++;

      // Only log important files (not appendix/acknowledgments)
      if (!filename.includes('ack') && !filename.includes('appendix') && !filename.includes('supp')) {
        console.log(`[LaTeX] [${depth}] Expanding \\${command}{${filename}} (${referencedFile.content.length} chars, total expanded: ${expansionCount})`);
      }

      // Recursively expand nested inputs
      const expandedContent = expandLatexInputs(referencedFile.content, files, processed, missingFiles, depth + 1);

      // Replace the \input command with the file content
      expanded = expanded.replace(fullMatch, expandedContent);
    } else {
      // Track missing files silently (common for acknowledgments, supplementary materials, etc.)
      missingFiles.push(filename);
      // Replace with a comment instead of keeping the command
      expanded = expanded.replace(fullMatch, `\n% [Missing file: ${filename}]\n`);
    }

    // Reset regex index since we modified the string
    inputPattern.lastIndex = 0;
  }

  if (depth === 0 && expansionCount > 10) {
    console.log(`[LaTeX] Total expansion count: ${expansionCount}, processed files: ${processed.size}`);
  }

  return expanded;
}

/**
 * Download and extract LaTeX source in one step
 * Expands all \input and \include commands to get complete content
 */
export async function fetchLatexSource(arxivId: string): Promise<string | null> {
  try {
    const buffer = await downloadLatexSource(arxivId);
    const extracted = await extractLatexArchive(buffer);

    if (!extracted.mainFile) {
      console.warn(`[LaTeX] No main file found for ${arxivId}`);
      return null;
    }

    console.log(`[LaTeX] Expanding all \\input/\\include commands for ${arxivId}...`);
    const missingFiles: string[] = [];
    const expanded = expandLatexInputs(extracted.mainFile, extracted.files, new Set(), missingFiles);
    console.log(`[LaTeX] Expanded content: ${expanded.length} chars (main: ${extracted.mainFile.length} chars)`);

    // Print summary of missing files (only if any)
    if (missingFiles.length > 0) {
      const missingSummary = missingFiles.map(f => {
        // Show short filename for clarity
        const parts = f.split('/');
        return parts[parts.length - 1] || f;
      }).join(', ');
      console.log(`[LaTeX] Skipped ${missingFiles.length} missing files: ${missingSummary}`);
    }

    return expanded;
  } catch (error) {
    console.error(`[LaTeX] Error fetching source for ${arxivId}:`, error);
    return null;
  }
}
