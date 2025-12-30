/**
 * Level 3: Deep Analyzer
 * Uses configured LLM provider (Claude Sonnet or GLM-4-Plus) for comprehensive paper analysis
 *
 * Re-export from unified LLM service for backward compatibility
 */

export {
  deepAnalyzePaper,
  batchDeepAnalyze,
} from '../llm/service';

export type { DeepAnalysisInput, DeepAnalysisResult } from '../llm/types';

/**
 * Framework-specific recommendations based on tags
 */
export function getFrameworkRecommendations(tags: string[]): string[] {
  const recommendations: string[] = [];

  if (tags.includes('rl')) {
    recommendations.push(
      'Consider integrating into VERL (Versatile Reinforcement Learning Framework)',
      'Evaluate compatibility with CleanRL and Tensordict',
      'Test with standard RL environments (Atari, MuJoCo, Procgen)'
    );
  }

  if (tags.includes('llm')) {
    recommendations.push(
      'Evaluate integration with Hugging Face Transformers',
      'Test with popular model families (Llama, Mistral, Qwen)',
      'Consider adding to TRL (Transformer Reinforcement Learning) library'
    );
  }

  if (tags.includes('inference')) {
    recommendations.push(
      'Benchmark against vLLM, TensorRT-LLM, and SGLang',
      'Test with real-world serving workloads',
      'Evaluate integration with popular quantization formats (AWQ, GPTQ)'
    );
  }

  return recommendations;
}
