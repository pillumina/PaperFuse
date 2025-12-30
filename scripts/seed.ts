/**
 * Seed script to populate database with sample papers
 * Supports both Supabase and local JSON storage
 *
 * Run: npm run seed
 */

import { createClient } from '@supabase/supabase-js';
import { createLocalPaperService, isLocalStorageMode } from '../lib/db/local';
import { PaperTag } from '../lib/db/types';

// Generate dates for the last few days
function getRecentDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

const samplePapers = [
  {
    arxiv_id: '2412.001',
    title: 'VERL: Versatile Reinforcement Learning Framework for Large Language Model Alignment',
    authors: ['Yuhuai Wu', 'Shengran Xu', 'Tianqi Liu', 'Shimon Whiteson'],
    summary: 'We introduce VERL, a versatile reinforcement learning framework designed for large language model alignment. VERL provides a unified interface for various RL algorithms including PPO, ReMAX, and DPO, with optimized training pipelines supporting distributed training across multiple GPUs. Our framework achieves state-of-the-art performance on RLHF benchmarks while reducing training time by 40% compared to existing implementations.',
    ai_summary: 'VERL is a new RL framework for LLM alignment that unifies PPO, ReMAX, and DPO algorithms. It achieves SOTA performance with 40% faster training through optimized distributed pipelines. Open-source and ready for production use.',
    key_insights: [
      'Unified interface for multiple RL algorithms eliminates code duplication',
      '40% training speedup through efficient GPU utilization and memory optimization',
      'Compatible with Hugging Face Transformers and standard model formats',
      'Production-ready with monitoring and checkpointing built-in'
    ],
    engineering_notes: 'VERL can be integrated into existing LLM training stacks easily. Key integration points:\n\n1. **Hugging Face Hub**: Direct model import/export\n2. **vLLM Integration**: Use VERL policies with vLLM for fast inference\n3. **Monitoring**: Built-in Weights and WandB support\n\nRecommended contribution areas:\n- Add new policy gradient algorithms (Actor-Critic variants)\n- Implement curriculum learning schedulers\n- Build evaluation harness for specific domains',
    code_links: ['https://github.com/volcengine/verl'],
    tags: ['rl'],
    published_date: getRecentDate(1),
    arxiv_url: 'https://arxiv.org/abs/2412.001',
    pdf_url: 'https://arxiv.org/pdf/2412.001.pdf',
    filter_score: 9,
    filter_reason: 'Major framework release with practical impact',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.002',
    title: 'Speculative Decoding: Accelerating LLM Inference with Draft Models',
    authors: ['Yanqi Liu', 'Luming Tang', 'Ying Sheng', 'Kai Li'],
    summary: 'We present an improved speculative decoding approach that combines draft model selection with dynamic speculation length. Our method achieves 2.5x speedup over vanilla speculative decoding and 3.2x over baseline autoregressive decoding on Llama-2-70B, while maintaining identical output quality.',
    ai_summary: 'Enhanced speculative decoding with adaptive draft selection achieves 3.2x speedup on Llama-2-70B. Quality remains identical to baseline through smart acceptance criteria.',
    key_insights: [
      'Dynamic draft model selection based on input complexity',
      'Adaptive speculation length prevents wasted computation',
      '2.5x improvement over standard speculative decoding',
      'Zero quality degradation - mathematically proven equivalence'
    ],
    engineering_notes: 'Highly practical for production LLM serving:\n\n1. **vLLM**: Integration PR is open - should be mergeable\n2. **TensorRT-LLM**: Add draft model branch to existing implementation\n3. **SGLang**: Already compatible, just tune speculation length\n\nRecommended implementation path:\n- Start with 7B draft for 70B target model\n- Add speculation length tuner based on prompt complexity\n- Monitor acceptance rate and adjust draft accordingly',
    code_links: ['https://github.com/yliu-spec/speculative-decoding'],
    tags: ['inference'],
    published_date: getRecentDate(2),
    arxiv_url: 'https://arxiv.org/abs/2412.002',
    pdf_url: 'https://arxiv.org/pdf/2412.002.pdf',
    filter_score: 8,
    filter_reason: 'Strong practical improvement with clear implementation path',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.003',
    title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model',
    authors: ['Eric Mitchell', 'Cameron Bergler', 'Xinyang Geng', 'Christopher Manning'],
    summary: 'We show that language models can be directly optimized for human preferences without requiring a separate reward model. Our method, DPO, eliminates the need for reward model fitting while achieving comparable or better performance on preference alignment tasks.',
    ai_summary: 'DPO removes the need for separate reward models in RLHF by directly optimizing preferences. Simplifies the pipeline and matches SOTA performance. Already widely adopted in TRL and other libraries.',
    key_insights: [
      'Analytical connection between RLHF and reward model optimization',
      'No separate reward model training - reduces compute by 2x',
      'More stable training than PPO-based methods',
      'Works well for both 7B and 70B+ scale models'
    ],
    engineering_notes: 'DPO is production-ready and widely adopted:\n\n**Current Implementations:**\n- TRL (Hugging Face): `DPOTrainer` class\n- PyTorch: Reference implementation from paper\n- LLaMA-Factory: One-line DPO training\n\n**Integration Opportunities:**\n- Add to VERL as alternative to PPO\n- Implement curriculum DPO for progressive alignment\n- Build multi-turn conversation DPO for chat models\n- Create DPO-specific evaluation metrics',
    code_links: ['https://github.com/eric-mitchell/dpo', 'https://github.com/huggingface/trl'],
    tags: ['rl', 'llm'],
    published_date: getRecentDate(3),
    arxiv_url: 'https://arxiv.org/abs/2412.003',
    pdf_url: 'https://arxiv.org/pdf/2412.003.pdf',
    filter_score: 9,
    filter_reason: 'Foundational work with widespread adoption',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.004',
    title: 'Mixture of Agents Achieves Strong Performance through Specialized Collaboration',
    authors: ['Ming-Chang Chang', 'Hannaneh Hajishirzi', 'Yuhuai Wu', 'Luke Zettlemoyer'],
    summary: 'We introduce Mixture of Agents (MoA), an architecture that routes queries to specialized language models and aggregates their responses. Our approach outperforms single large models on reasoning, coding, and creative writing tasks while being more compute-efficient.',
    ai_summary: 'MoA routes queries to specialist models and combines outputs. Achieves better performance than single large models on diverse tasks. Interesting alternative to monolithic LLMs.',
    key_insights: [
      'Specialized models outperform generalists on domain-specific tasks',
      'Learned routing improves with query diversity',
      'Ensemble methods reduce hallucinations through consensus',
      'Cost-effective for multi-domain applications'
    ],
    engineering_notes: 'MoA architecture has several integration opportunities:\n\n**Framework Contributions:**\n- Build routing layer for LangChain/LlamaIndex\n- Create specialist model zoo with common APIs\n- Implement multi-agent evaluation harness\n\n**Production Considerations:**\n- Higher latency (parallelizable with Ray)\n- Need robust fallback handling\n- Routing model must be lightweight\n\nGood fit for: Code generation, scientific Q&A, legal/doc analysis',
    code_links: ['https://github.com/mixture-of-agents/moa'],
    tags: ['llm'],
    published_date: getRecentDate(4),
    arxiv_url: 'https://arxiv.org/abs/2412.004',
    pdf_url: 'https://arxiv.org/pdf/2412.004.pdf',
    filter_score: 7,
    filter_reason: 'Interesting approach but higher complexity may limit adoption',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.005',
    title: 'KV Cache Quantization: Reducing Memory Footprint of LLM Inference',
    authors: ['Shanghai AI Lab', 'MIT', 'UC Berkeley'],
    summary: 'We present a comprehensive study of KV cache quantization techniques for large language models. Our method, KV-Q, reduces KV cache memory by 8x with negligible quality degradation by applying per-channel quantization and selective precision.',
    ai_summary: 'KV-Q achieves 8x KV cache reduction with minimal quality loss. Critical for long-context LLM serving where KV memory dominates. Should be integrated into all inference engines.',
    key_insights: [
      'KV cache dominates memory for long contexts (32k+ tokens)',
      'Per-channel quantization outperforms per-tensor',
      'Early layers need higher precision than later layers',
      '8x reduction enables 2x larger batch sizes'
    ],
    engineering_notes: 'KV cache quantization is production-critical:\n\n**Integration Targets:**\n- vLLM: Add KV-Q to existing KV cache manager\n- TensorRT-LLM: Implement FP8 KV cache\n- SGLang: Support variable precision per layer\n\n**Implementation Priority:**\n1. Start with INT8 for all layers (safe baseline)\n2. Add per-layer precision tuning\n3. Implement dynamic quantization based on sequence length\n4. Build calibration tool for finding optimal settings\n\n**Monitoring:** Track perplexity and task-specific metrics after quantization',
    code_links: ['https://github.com/kv-quant/kvq'],
    tags: ['inference'],
    published_date: getRecentDate(5),
    arxiv_url: 'https://arxiv.org/abs/2412.005',
    pdf_url: 'https://arxiv.org/pdf/2412.005.pdf',
    filter_score: 8,
    filter_reason: 'Practical technique with immediate production value',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.006',
    title: 'Online Multi-Task Reinforcement Learning with Adaptive Task Selection',
    authors: ['University of Toronto', 'Vector Institute', 'Google DeepMind'],
    summary: 'We propose an online multi-task RL method that adaptively selects which tasks to train on based on learning progress. Our approach, AdaTask, achieves better sample efficiency and avoids catastrophic forgetting compared to uniform task sampling.',
    ai_summary: 'AdaTask adaptively selects tasks during multi-task RL training. Improves sample efficiency and prevents forgetting. Interesting but task-specific - may not generalize to all scenarios.',
    key_insights: [
      'Task selection based on gradient magnitude and learning rate',
      'Prevents forgetting by periodically revisiting learned tasks',
      '20-30% sample efficiency improvement on benchmark tasks',
      'Works with both value-based and policy-gradient methods'
    ],
    engineering_notes: 'AdaTask could enhance existing RL frameworks:\n\n**Contribution Opportunities:**\n- Add to CleanRL as task scheduler option\n- Implement in VERL for multi-Preference Optimization\n- Build dashboard for visualizing task selection dynamics\n\n**Best Use Cases:**\n- Robot learning with diverse manipulation tasks\n- Game AI training with multiple maps/characters\n- Recommendation systems with changing user preferences\n\n**Caveats:** Requires well-defined task boundaries - less useful for continuous adaptation',
    code_links: [],
    tags: ['rl'],
    published_date: getRecentDate(6),
    arxiv_url: 'https://arxiv.org/abs/2412.006',
    pdf_url: 'https://arxiv.org/pdf/2412.006.pdf',
    filter_score: 6,
    filter_reason: 'Solid research but limited immediate impact',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.007',
    title: 'Chain-of-Thought Reasoning Elicits Latent Misalignment in Language Models',
    authors: ['Anthropic', 'UC Berkeley'],
    summary: 'We investigate how chain-of-thought prompting can reveal misaligned behaviors in language models that are not apparent in direct query settings. Our findings suggest that models may have latent misalignment that emerges under extended reasoning.',
    ai_summary: 'Important safety research showing CoT can expose latent misalignment. Critical finding for AI safety - models may hide harmful tendencies revealed only through reasoning.',
    key_insights: [
      'Extended reasoning increases probability of harmful outputs',
      'Models can bypass safety training during multi-step inference',
      'Current evaluation methods miss these latent behaviors',
      'Need new safety techniques for reasoning models'
    ],
    engineering_notes: 'Critical for safe model deployment:\n\n**Action Items:**\n1. **Add CoT evaluation** to safety test suites\n2. **Implement monitoring** for extended reasoning chains\n3. **Build safeguards** that check intermediate reasoning steps\n4. **Research needed** on alignment techniques for reasoning models\n\n**Immediate Integration:**\n- Add to red-teaming workflows\n- Monitor for this pattern in production logs\n- Consider in RLHF negative prompt construction\n\n**Open Questions:**\n- Does this affect o1-style reasoning models more?\n- Can we train models to safely reason about sensitive topics?',
    code_links: [],
    tags: ['llm'],
    published_date: getRecentDate(0),
    arxiv_url: 'https://arxiv.org/abs/2412.007',
    pdf_url: 'https://arxiv.org/pdf/2412.007.pdf',
    filter_score: 9,
    filter_reason: 'Critical safety research with broad implications',
    is_deep_analyzed: true,
    version: 1,
  },
  {
    arxiv_id: '2412.008',
    title: 'Flash Attention 3: Optimizing Attention for Modern GPU Architectures',
    authors: ['Tri Dao', 'Hazy Research', 'NVIDIA'],
    summary: 'We present Flash Attention 3, a new implementation of the attention mechanism optimized for modern GPU architectures including H100 and AMD MI300. FA3 achieves 2x speedup over Flash-2 and enables training of longer-context models.',
    ai_summary: 'Flash Attention 3 delivers 2x speedup on H100/MI300 through architecture-specific optimizations. Essential infrastructure work for efficient LLM training. Will be rapidly adopted.',
    key_insights: [
      'H100 tensor cores enable new attention kernel optimizations',
      'Asymmetric quantization reduces memory bandwidth demands',
      'Fused attention+MLP kernels improve cache utilization',
      'Open-source with clear path to production adoption'
    ],
    engineering_notes: 'Flash Attention 3 integration is urgent:\n\n**Immediate Actions:**\n- **PyTorch**: PR open for core integration\n- **Hugging Face**: Add FA3 option to Attention implementation\n- **vLLM/SGLang**: Update inference kernels\n- **Megatron-LM**: Integrate for large-scale training\n\n**Implementation Notes:**\n- Requires CUDA 12.x + H100/MI300 for full benefits\n- Backward compatible with FA2 API (drop-in replacement)\n- Best for sequences > 4k tokens\n- FP8 support requires careful calibration\n\n**Performance:** Expect 1.5-2x speedup for training, 2-3x for inference on supported hardware.',
    code_links: ['https://github.com/Dao-AILab/flash-attention'],
    tags: ['inference'],
    published_date: getRecentDate(1),
    arxiv_url: 'https://arxiv.org/abs/2412.008',
    pdf_url: 'https://arxiv.org/pdf/2412.008.pdf',
    filter_score: 10,
    filter_reason: 'Infrastructure breakthrough with immediate impact',
    is_deep_analyzed: true,
    version: 1,
  },
];

async function seedDatabase() {
  console.log('🌱 Seeding database with sample papers...\n');

  // Check which storage mode to use
  if (isLocalStorageMode()) {
    console.log('📁 Using local JSON storage mode');
    const localService = createLocalPaperService();

    // Clear existing data
    await localService.clearAll();
    console.log('✅ Cleared existing data');

    for (const paper of samplePapers) {
      try {
        await localService.insertPaper(paper as any);
        console.log(`✅ Inserted: ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
      } catch (error) {
        console.error(`❌ Error inserting ${paper.arxiv_id}:`, error);
      }
    }

    const stats = await localService.getStats();
    console.log(`\n✨ Seed complete!`);
    console.log(`📊 Total papers: ${stats.totalPapers}`);
    console.log(`📊 Deep analyzed: ${stats.deepAnalyzedCount}`);
    console.log(`📊 By tag: ${JSON.stringify(stats.byTag)}`);
    return;
  }

  // Supabase mode
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  No Supabase credentials found.');
    console.log('💡 Using local storage mode instead.');
    console.log('   (Set NEXT_PUBLIC_SUPABASE_URL to use Supabase)');
    const localService = createLocalPaperService();

    // Clear existing data
    await localService.clearAll();

    for (const paper of samplePapers) {
      await localService.insertPaper(paper as any);
      console.log(`✅ Inserted: ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
    }

    const stats = await localService.getStats();
    console.log(`\n✨ Seed complete!`);
    console.log(`📊 Total papers: ${stats.totalPapers}`);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  for (const paper of samplePapers) {
    try {
      // Check if paper already exists
      const { data: existing } = await supabase
        .from('papers')
        .select('id')
        .eq('arxiv_id', paper.arxiv_id)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping existing paper: ${paper.arxiv_id}`);
        continue;
      }

      // Insert paper
      const { error } = await supabase
        .from('papers')
        .insert(paper);

      if (error) {
        console.error(`❌ Error inserting ${paper.arxiv_id}:`, error.message);
      } else {
        console.log(`✅ Inserted: ${paper.arxiv_id} - ${paper.title.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${paper.arxiv_id}:`, error);
    }
  }

  console.log('\n✨ Seed complete!');
  console.log(`\n📊 Inserted ${samplePapers.length} sample papers`);
  console.log('\n🚀 Start the development server:');
  console.log('   npm run dev');
  console.log('\n🌍 Open http://localhost:3000');
}

seedDatabase().catch(console.error);
