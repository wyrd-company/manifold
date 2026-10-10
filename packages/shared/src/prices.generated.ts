// ---
// relationships:
//   implements: price-table
// ---
// Generated from LiteLLM at e1d16f51d14849c1b3decf17cd81a3bcb4863dca; Apache-2.0.
import type { PriceTable } from "./usage-types.ts";
export const bundledPriceTableCommit = "e1d16f51d14849c1b3decf17cd81a3bcb4863dca";
export const bundledPriceTable: PriceTable = {
  unit: "usd",
  models: {
    sample_spec: {
      standard: {
        input: 0,
        output: 0,
        reasoning: 0,
      },
    },
    "ai21.j2-mid-v1": {
      standard: {
        input: 12.5,
        output: 12.5,
      },
    },
    "ai21.j2-ultra-v1": {
      standard: {
        input: 18.8,
        output: 18.8,
      },
    },
    "ai21.jamba-1-5-large-v1:0": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "ai21.jamba-1-5-mini-v1:0": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "ai21.jamba-instruct-v1:0": {
      standard: {
        input: 0.5,
        output: 0.7,
      },
    },
    "us.writer.palmyra-x4-v1:0": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "us.writer.palmyra-x5-v1:0": {
      standard: {
        input: 0.6,
        output: 6,
      },
    },
    "writer.palmyra-x4-v1:0": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "writer.palmyra-x5-v1:0": {
      standard: {
        input: 0.6,
        output: 6,
      },
    },
    "writer.palmyra-vision-7b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "amazon.nova-lite-v1:0": {
      standard: {
        input: 0.06,
        output: 0.24,
        cacheRead: 0.015,
      },
    },
    "amazon.nova-2-lite-v1:0": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.075,
      },
    },
    "amazon.nova-2-pro-preview-20251202-v1:0": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.3125,
      },
    },
    "apac.amazon.nova-2-lite-v1:0": {
      standard: {
        input: 0.33,
        output: 2.75,
        cacheRead: 0.0825,
      },
    },
    "apac.amazon.nova-2-pro-preview-20251202-v1:0": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.34375,
      },
    },
    "eu.amazon.nova-2-lite-v1:0": {
      standard: {
        input: 0.33,
        output: 2.75,
        cacheRead: 0.0825,
      },
    },
    "eu.amazon.nova-2-pro-preview-20251202-v1:0": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.34375,
      },
    },
    "us.amazon.nova-2-lite-v1:0": {
      standard: {
        input: 0.33,
        output: 2.75,
        cacheRead: 0.0825,
      },
    },
    "us.amazon.nova-2-pro-preview-20251202-v1:0": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.34375,
      },
    },
    "amazon.nova-2-multimodal-embeddings-v1:0": {
      standard: {
        input: 0.135,
        output: 0,
      },
    },
    "amazon.nova-micro-v1:0": {
      standard: {
        input: 0.035,
        output: 0.14,
        cacheRead: 0.00875,
      },
    },
    "amazon.nova-pro-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
        cacheRead: 0.19999999999999998,
      },
    },
    "amazon.nova-2-sonic-v1:0": {
      standard: {
        input: 0.33,
        output: 2.75,
      },
    },
    "amazon.rerank-v1:0": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "amazon.titan-embed-image-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 0,
      },
    },
    "amazon.titan-embed-text-v1": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "amazon.titan-embed-g1-text-02": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "amazon.titan-embed-text-v2:0": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "amazon.titan-text-express-v1": {
      standard: {
        input: 1.3,
        output: 1.7,
      },
    },
    "amazon.titan-text-lite-v1": {
      standard: {
        input: 0.3,
        output: 0.39999999999999997,
      },
    },
    "amazon.titan-text-premier-v1:0": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "anthropic.claude-3-5-haiku-20241022-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
        cacheRead: 0.08,
        cacheWrite: 1,
      },
    },
    "anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "anthropic.claude-haiku-4-5@20251001": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "anthropic.claude-3-5-sonnet-20240620-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "anthropic.claude-3-5-sonnet-20241022-v2:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "anthropic.claude-3-7-sonnet-20240620-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
      },
    },
    "anthropic.claude-3-7-sonnet-20250219-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "anthropic.claude-3-opus-20240229-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "anthropic.claude-instant-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "anthropic.claude-opus-4-1-20250805-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "anthropic.claude-opus-4-20250514-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "anthropic.claude-opus-4-5-20251101-v1:0": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "anthropic.claude-opus-4-6-v1": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "global.anthropic.claude-opus-4-6-v1": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "us.anthropic.claude-opus-4-6-v1": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "eu.anthropic.claude-opus-4-6-v1": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "au.anthropic.claude-opus-4-6-v1": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "anthropic.claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "anthropic.claude-mythos-preview": {
      standard: {
        input: 27.5,
        output: 137.5,
        cacheRead: 2.75,
        cacheWrite: 34.375,
        cacheWriteOneHour: 55,
      },
    },
    "global.anthropic.claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "us.anthropic.claude-opus-4-7": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "eu.anthropic.claude-opus-4-7": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "au.anthropic.claude-opus-4-7": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "anthropic.claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "anthropic.claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "global.anthropic.claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "global.anthropic.claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "us.anthropic.claude-fable-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "us.anthropic.claude-fable-5-1": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 0.275,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "eu.anthropic.claude-fable-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "eu.anthropic.claude-fable-5-1": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 0.275,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "anthropic.claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "anthropic.claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "global.anthropic.claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "global.anthropic.claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "us.anthropic.claude-opus-5": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "us.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "eu.anthropic.claude-opus-5": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "eu.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "au.anthropic.claude-opus-5": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "au.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "jp.anthropic.claude-opus-5": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "jp.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "anthropic.claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "global.anthropic.claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "us.anthropic.claude-opus-4-8": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "eu.anthropic.claude-opus-4-8": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "au.anthropic.claude-opus-4-8": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "jp.anthropic.claude-opus-4-8": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "jp.anthropic.claude-opus-4-7": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "anthropic.claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "global.anthropic.claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "us.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "eu.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "au.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "jp.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "global.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "us.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "eu.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "au.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "jp.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "anthropic.claude-sonnet-4-20250514-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "anthropic.claude-v1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "anthropic.claude-v2:1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "anyscale/HuggingFaceH4/zephyr-7b-beta": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "anyscale/codellama/CodeLlama-34b-Instruct-hf": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "anyscale/codellama/CodeLlama-70b-Instruct-hf": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "anyscale/google/gemma-7b-it": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "anyscale/meta-llama/Llama-2-13b-chat-hf": {
      standard: {
        input: 0.25,
        output: 0.25,
      },
    },
    "anyscale/meta-llama/Llama-2-70b-chat-hf": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "anyscale/meta-llama/Llama-2-7b-chat-hf": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "anyscale/meta-llama/Meta-Llama-3-70B-Instruct": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "anyscale/meta-llama/Meta-Llama-3-8B-Instruct": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "anyscale/mistralai/Mistral-7B-Instruct-v0.1": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "anyscale/mistralai/Mixtral-8x22B-Instruct-v0.1": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "anyscale/mistralai/Mixtral-8x7B-Instruct-v0.1": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "apac.amazon.nova-lite-v1:0": {
      standard: {
        input: 0.063,
        output: 0.252,
        cacheRead: 0.01575,
      },
    },
    "apac.amazon.nova-micro-v1:0": {
      standard: {
        input: 0.037,
        output: 0.148,
        cacheRead: 0.00925,
      },
    },
    "apac.amazon.nova-pro-v1:0": {
      standard: {
        input: 0.84,
        output: 3.36,
        cacheRead: 0.21,
      },
    },
    "apac.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
      },
    },
    "apac.anthropic.claude-sonnet-4-20250514-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "au.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "azure/ada": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "azure/codex-mini": {
      standard: {
        input: 1.5,
        output: 6,
        cacheRead: 0.375,
      },
    },
    "azure/command-r-plus": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "azure_ai/claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "azure_ai/claude-opus-4-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "azure_ai/claude-opus-4-6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "azure_ai/claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "azure_ai/claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "azure_ai/claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "azure_ai/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "azure_ai/claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "azure_ai/claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "azure_ai/claude-sonnet-4-5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "azure_ai/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "azure_ai/claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "azure/computer-use-preview": {
      standard: {
        input: 3,
        output: 12,
      },
    },
    "azure_ai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "azure_ai/gpt-6-astra": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "azure_ai/gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "azure_ai/gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "azure_ai/gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "azure_ai/gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure_ai/gpt-chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure_ai/codex-mini": {
      standard: {
        input: 1.5,
        output: 6,
        cacheRead: 0.375,
      },
    },
    "azure_ai/gpt-5.5-2026-04-23": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure_ai/gpt-5.5-2026-04-24": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure_ai/gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "azure_ai/gpt-5.4-2026-03-05": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "azure_ai/gpt-5.4-pro": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure_ai/gpt-5.4-pro-2026-03-05": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure_ai/gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "azure_ai/gpt-5.4-mini-2026-03-17": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "azure_ai/gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "azure_ai/gpt-5.4-nano-2026-03-17": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "azure_ai/model_router": {
      standard: {
        input: 0.14,
        output: 0,
      },
    },
    "azure_ai/model-router": {
      standard: {
        input: 0.14,
        output: 0,
      },
    },
    "azure/eu/gpt-4o-2024-08-06": {
      standard: {
        input: 2.75,
        output: 11,
        cacheRead: 1.375,
      },
    },
    "azure/eu/gpt-4o-2024-11-20": {
      standard: {
        input: 2.75,
        output: 11,
        cacheRead: 1.375,
        cacheWrite: 1.38,
      },
    },
    "azure/eu/gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.165,
        output: 0.66,
        cacheRead: 0.083,
      },
    },
    "azure/eu/gpt-4o-mini-realtime-preview-2024-12-17": {
      standard: {
        input: 0.66,
        output: 2.64,
        cacheRead: 0.33,
      },
    },
    "azure/eu/gpt-4o-realtime-preview-2024-10-01": {
      standard: {
        input: 5.5,
        output: 22,
        cacheRead: 2.75,
      },
    },
    "azure/eu/gpt-4o-realtime-preview-2024-12-17": {
      standard: {
        input: 5.5,
        output: 22,
        cacheRead: 2.75,
      },
    },
    "azure/eu/gpt-5-2025-08-07": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5-mini-2025-08-07": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/eu/gpt-5.1": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5.1-codex": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5.1-codex-mini": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/eu/gpt-5-nano-2025-08-07": {
      standard: {
        input: 0.055,
        output: 0.44,
        cacheRead: 0.0055,
      },
    },
    "azure/eu/o1-2024-12-17": {
      standard: {
        input: 16.5,
        output: 66,
        cacheRead: 8.25,
      },
    },
    "azure/eu/o1-mini-2024-09-12": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/eu/o3-mini-2025-01-31": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/global-standard/gpt-4o-2024-08-06": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/global-standard/gpt-4o-2024-11-20": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/global-standard/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "azure/global/gpt-4o-2024-08-06": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/global/gpt-4o-2024-11-20": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/global/gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/global/gpt-5.1-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/global/gpt-5.1-codex-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-3.5-turbo": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "azure/gpt-3.5-turbo-instruct-0914": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "azure/gpt-35-turbo": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "azure/gpt-35-turbo-16k": {
      standard: {
        input: 3,
        output: 4,
      },
    },
    "azure/gpt-35-turbo-16k-0613": {
      standard: {
        input: 3,
        output: 4,
      },
    },
    "azure/gpt-35-turbo-instruct": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "azure/gpt-35-turbo-instruct-0914": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "azure/gpt-4": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "azure/gpt-4-0125-preview": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "azure/gpt-4-0613": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "azure/gpt-4-1106-preview": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "azure/gpt-4-32k": {
      standard: {
        input: 60,
        output: 120,
      },
    },
    "azure/gpt-4-32k-0613": {
      standard: {
        input: 60,
        output: 120,
      },
    },
    "azure/gpt-4-turbo": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "azure/gpt-4-turbo-2024-04-09": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "azure/gpt-4-turbo-vision-preview": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "azure/gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "azure/gpt-4.1-2025-04-14": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "azure/gpt-4.1-mini": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
      },
    },
    "azure/gpt-4.1-mini-2025-04-14": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
      },
    },
    "azure/gpt-4.1-nano": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-4.1-nano-2025-04-14": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-4.5-preview": {
      standard: {
        input: 75,
        output: 150,
        cacheRead: 37.5,
      },
    },
    "azure/gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/gpt-4o-2024-05-13": {
      standard: {
        input: 5,
        output: 15,
      },
    },
    "azure/gpt-4o-2024-08-06": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/gpt-4o-2024-11-20": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "azure/gpt-audio": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-audio-2025-08-28": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-audio-1.5": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-audio-1.5-2026-02-23": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-audio-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "azure/gpt-audio-mini-2025-10-06": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "azure/gpt-4o-audio-preview-2024-12-17": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "azure/gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "azure/gpt-4o-mini-audio-preview-2024-12-17": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-4o-mini-realtime-preview-2024-12-17": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.3,
      },
    },
    "azure/gpt-realtime": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "azure/gpt-realtime-2025-08-28": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "azure/gpt-realtime-1.5": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "azure/gpt-realtime-1.5-2026-02-23": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "azure/gpt-realtime-2.1": {
      standard: {
        input: 4,
        output: 24,
        cacheRead: 0.39999999999999997,
      },
    },
    "azure/gpt-realtime-2.1-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "azure/gpt-realtime-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "azure/gpt-realtime-mini-2025-10-06": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "azure/gpt-4o-mini-transcribe": {
      standard: {
        input: 1.25,
        output: 5,
      },
    },
    "azure/gpt-4o-mini-tts": {
      standard: {
        input: 0.6,
        output: 10,
      },
    },
    "azure/gpt-4o-realtime-preview-2024-10-01": {
      standard: {
        input: 5,
        output: 20,
        cacheRead: 2.5,
      },
    },
    "azure/gpt-4o-realtime-preview-2024-12-17": {
      standard: {
        input: 5,
        output: 20,
        cacheRead: 2.5,
      },
    },
    "azure/gpt-4o-transcribe": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-4o-transcribe-diarize": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure/gpt-5.1-2025-11-13": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.1-codex-2025-11-13": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.1-codex-mini-2025-11-13": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5-2025-08-07": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-5-mini-2025-08-07": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-5-nano": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.005,
      },
    },
    "azure/gpt-5-nano-2025-08-07": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.005,
      },
    },
    "azure/gpt-5-pro": {
      standard: {
        input: 15,
        output: 120,
      },
    },
    "azure/gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5-chat": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.1-chat": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.2-chat": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/gpt-5.3-chat": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/us/gpt-5.1-chat": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5.2-chat": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/us/gpt-5.3-chat": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/eu/gpt-5.1-chat": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5.2-chat": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/eu/gpt-5.3-chat": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/us/o1-preview": {
      standard: {
        input: 16.5,
        output: 66,
        cacheRead: 8.25,
      },
    },
    "azure/eu/o1-preview": {
      standard: {
        input: 16.5,
        output: 66,
        cacheRead: 8.25,
      },
    },
    "azure/gpt-5.1-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.1-codex-max": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "azure/gpt-5.1-codex-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "azure/gpt-5.2": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/gpt-5.2-2025-12-11": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/gpt-5.2-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/gpt-5.3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "azure/gpt-5.2-pro": {
      standard: {
        input: 21,
        output: 168,
      },
    },
    "azure/gpt-5.2-pro-2025-12-11": {
      standard: {
        input: 21,
        output: 168,
      },
    },
    "azure/gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "azure/us/gpt-5.4": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "azure/eu/gpt-5.4": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "azure/gpt-5.4-2026-03-05": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "azure/us/gpt-5.4-2026-03-05": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "azure/eu/gpt-5.4-2026-03-05": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "azure/gpt-5.4-pro": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure/gpt-5.4-pro-2026-03-05": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure/gpt-5.6": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "azure/gpt-5.6-sol": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "azure/gpt-5.6-sol-2026-07-09": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "azure/gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-5.6-terra-2026-07-09": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "azure/gpt-5.6-luna-2026-07-09": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "azure/gpt-6-astra": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "azure/gpt-6-astra-2026-09-03": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "azure/gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "azure/gpt-6-luna-2026-09-22": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "azure/gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-6-sol-2026-09-22": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-6.1-sol-2026-09-29": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "azure/gpt-chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure/chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure/us/gpt-5.6": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "azure/us/gpt-5.6-sol": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "azure/us/gpt-5.6-terra": {
      standard: {
        input: 2.2,
        output: 13.200000000000001,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "azure/us/gpt-5.6-luna": {
      standard: {
        input: 0.22,
        output: 1.32,
        cacheRead: 0.022,
        cacheWrite: 0.275,
      },
    },
    "azure/us/gpt-6-astra": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
      },
    },
    "azure/us/gpt-6-luna": {
      standard: {
        input: 0.11,
        output: 0.55,
        cacheRead: 0.011,
        cacheWrite: 0.1375,
      },
    },
    "azure/us/gpt-6-sol": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "azure/us/gpt-chat-latest": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/eu/gpt-5.6": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "azure/eu/gpt-5.6-sol": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "azure/eu/gpt-5.6-terra": {
      standard: {
        input: 2.2,
        output: 13.200000000000001,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "azure/eu/gpt-5.6-luna": {
      standard: {
        input: 0.22,
        output: 1.32,
        cacheRead: 0.022,
        cacheWrite: 0.275,
      },
    },
    "azure/gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure/us/gpt-5.5": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/eu/gpt-5.5": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/gpt-5.5-2026-04-23": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure/gpt-5.5-2026-04-24": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "azure/us/gpt-5.5-2026-04-23": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/us/gpt-5.5-2026-04-24": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/eu/gpt-5.5-2026-04-23": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/eu/gpt-5.5-2026-04-24": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "azure/gpt-5.5-pro": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure/gpt-5.5-pro-2026-04-23": {
      standard: {
        input: 30,
        output: 180,
        cacheRead: 3,
      },
    },
    "azure/gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "azure/gpt-5.4-mini-2026-03-17": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "azure/gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "azure/gpt-5.4-nano-2026-03-17": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "azure/mistral-large-2402": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "azure/mistral-large-latest": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "azure/o1": {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
      },
    },
    "azure/o1-2024-12-17": {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
      },
    },
    "azure/o1-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "azure/o1-mini-2024-09-12": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "azure/o3": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "azure/o3-2025-04-16": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "azure/o3-deep-research": {
      standard: {
        input: 10,
        output: 40,
        cacheRead: 2.5,
      },
    },
    "azure/o3-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "azure/o3-mini-2025-01-31": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "azure/o3-pro": {
      standard: {
        input: 20,
        output: 80,
      },
    },
    "azure/o3-pro-2025-06-10": {
      standard: {
        input: 20,
        output: 80,
      },
    },
    "azure/o4-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "azure/o4-mini-2025-04-16": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "azure/text-embedding-3-large": {
      standard: {
        input: 0.13,
        output: 0,
      },
    },
    "azure/text-embedding-3-small": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "azure/text-embedding-ada-002": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "azure/us/gpt-4.1-2025-04-14": {
      standard: {
        input: 2.2,
        output: 8.8,
        cacheRead: 0.55,
      },
    },
    "azure/us/gpt-4.1-mini-2025-04-14": {
      standard: {
        input: 0.44,
        output: 1.76,
        cacheRead: 0.11,
      },
    },
    "azure/us/gpt-4.1-nano-2025-04-14": {
      standard: {
        input: 0.11,
        output: 0.44,
        cacheRead: 0.028,
      },
    },
    "azure/us/gpt-4o-2024-08-06": {
      standard: {
        input: 2.75,
        output: 11,
        cacheRead: 1.375,
      },
    },
    "azure/us/gpt-4o-2024-11-20": {
      standard: {
        input: 2.75,
        output: 11,
        cacheRead: 1.375,
        cacheWrite: 1.38,
      },
    },
    "azure/us/gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.165,
        output: 0.66,
        cacheRead: 0.083,
      },
    },
    "azure/us/gpt-4o-mini-realtime-preview-2024-12-17": {
      standard: {
        input: 0.66,
        output: 2.64,
        cacheRead: 0.33,
      },
    },
    "azure/us/gpt-4o-realtime-preview-2024-10-01": {
      standard: {
        input: 5.5,
        output: 22,
        cacheRead: 2.75,
      },
    },
    "azure/us/gpt-4o-realtime-preview-2024-12-17": {
      standard: {
        input: 5.5,
        output: 22,
        cacheRead: 2.75,
      },
    },
    "azure/us/gpt-5-2025-08-07": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5-mini-2025-08-07": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/us/gpt-5-nano-2025-08-07": {
      standard: {
        input: 0.055,
        output: 0.44,
        cacheRead: 0.0055,
      },
    },
    "azure/us/gpt-5.1": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5.1-codex": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5.1-codex-mini": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/us/o1-2024-12-17": {
      standard: {
        input: 16.5,
        output: 66,
        cacheRead: 8.25,
      },
    },
    "azure/us/o1-mini-2024-09-12": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/us/o3-2025-04-16": {
      standard: {
        input: 2.2,
        output: 8.8,
        cacheRead: 0.55,
      },
    },
    "azure/us/o3-mini-2025-01-31": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/us/o4-mini-2025-04-16": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.303,
      },
    },
    "azure_ai/Cohere-embed-v3-english": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "azure_ai/Cohere-embed-v3-multilingual": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "azure_ai/Codestral-2501": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "azure_ai/FW-DeepSeek-V3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
        cacheRead: 0.31,
      },
    },
    "azure_ai/FW-DeepSeek-V4-Pro": {
      standard: {
        input: 1.9250000000000003,
        output: 3.8279999999999994,
        cacheRead: 0.165,
      },
    },
    "azure_ai/FW-GLM-5": {
      standard: {
        input: 1.1,
        output: 3.52,
        cacheRead: 0.22,
      },
    },
    "azure_ai/FW-GLM-5.1": {
      standard: {
        input: 1.54,
        output: 4.84,
        cacheRead: 0.286,
      },
    },
    "azure_ai/FW-GLM-5.2": {
      standard: {
        input: 1.54,
        output: 4.84,
        cacheRead: 0.15,
      },
    },
    "azure_ai/FW-GLM-5.2-Fast": {
      standard: {
        input: 2.31,
        output: 7.26,
        cacheRead: 0.23099999999999998,
      },
    },
    "azure_ai/FW-Inkling": {
      standard: {
        input: 1.1,
        output: 4.46,
        cacheRead: 0.19,
      },
    },
    "azure_ai/FW-Kimi-K2.5": {
      standard: {
        input: 0.66,
        output: 3.3000000000000003,
        cacheRead: 0.11,
      },
    },
    "azure_ai/FW-Kimi-K2.6": {
      standard: {
        input: 1.045,
        output: 4.4,
        cacheRead: 0.176,
      },
    },
    "azure_ai/FW-Kimi-K2.7-Code": {
      standard: {
        input: 1.0499999999999998,
        output: 4.4,
        cacheRead: 0.21,
      },
    },
    "azure_ai/FW-Kimi-K3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "azure_ai/FW-MiniMax-M2.5": {
      standard: {
        input: 0.33,
        output: 1.32,
        cacheRead: 0.032999999999999995,
      },
    },
    "azure_ai/FW-MiniMax-M3": {
      standard: {
        input: 0.33,
        output: 1.32,
        cacheRead: 0.06599999999999999,
      },
    },
    "azure_ai/FW-Nemotron-Lightning-3.5-30B-A3B": {
      standard: {
        input: 0.06,
        output: 0.22,
        cacheRead: 0.01,
      },
    },
    "azure_ai/FW-Nemotron-3-Ultra-NVFP4": {
      standard: {
        input: 0.66,
        output: 2.64,
        cacheRead: 0.13,
      },
    },
    "azure_ai/MAI-Thinking-1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.19999999999999998,
      },
    },
    "azure_ai/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.71,
        output: 0.71,
      },
    },
    "azure_ai/Llama-4-Maverick-17B-128E-Instruct-FP8": {
      standard: {
        input: 0.25,
        output: 1,
      },
    },
    "azure_ai/Llama-4-Scout-17B-16E-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.78,
      },
    },
    "azure_ai/Meta-Llama-3-70B-Instruct": {
      standard: {
        input: 1.1,
        output: 0.37,
      },
    },
    "azure_ai/Meta-Llama-3.1-70B-Instruct": {
      standard: {
        input: 2.68,
        output: 3.54,
      },
    },
    "azure_ai/Phi-3-medium-128k-instruct": {
      standard: {
        input: 0.16999999999999998,
        output: 0.6799999999999999,
      },
    },
    "azure_ai/Phi-3-medium-4k-instruct": {
      standard: {
        input: 0.16999999999999998,
        output: 0.6799999999999999,
      },
    },
    "azure_ai/Phi-3-mini-128k-instruct": {
      standard: {
        input: 0.13,
        output: 0.52,
      },
    },
    "azure_ai/Phi-3-mini-4k-instruct": {
      standard: {
        input: 0.13,
        output: 0.52,
      },
    },
    "azure_ai/Phi-3-small-128k-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "azure_ai/Phi-3-small-8k-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "azure_ai/Phi-3.5-MoE-instruct": {
      standard: {
        input: 0.16,
        output: 0.64,
      },
    },
    "azure_ai/Phi-3.5-mini-instruct": {
      standard: {
        input: 0.13,
        output: 0.52,
      },
    },
    "azure_ai/Phi-3.5-vision-instruct": {
      standard: {
        input: 0.13,
        output: 0.52,
      },
    },
    "azure_ai/Phi-4": {
      standard: {
        input: 0.125,
        output: 0.5,
      },
    },
    "azure_ai/Phi-4-mini-instruct": {
      standard: {
        input: 0.075,
        output: 0.3,
      },
    },
    "azure_ai/Phi-4-multimodal-instruct": {
      standard: {
        input: 0.08,
        output: 0.32,
      },
    },
    "azure_ai/Phi-4-mini-reasoning": {
      standard: {
        input: 0.075,
        output: 0.3,
      },
    },
    "azure_ai/Phi-4-reasoning": {
      standard: {
        input: 0.125,
        output: 0.5,
      },
    },
    "azure_ai/cohere-command-a": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "azure_ai/MAI-DS-R1": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "azure_ai/cohere-rerank-v3-english": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "azure_ai/cohere-rerank-v3-multilingual": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "azure_ai/cohere-rerank-v4.0-pro": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "azure_ai/cohere-rerank-v4.0-fast": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "azure_ai/deepseek-v3.2": {
      standard: {
        input: 0.58,
        output: 1.68,
      },
    },
    "azure_ai/deepseek-v3.2-speciale": {
      standard: {
        input: 0.58,
        output: 1.68,
      },
    },
    "azure_ai/deepseek-v3": {
      standard: {
        input: 1.1400000000000001,
        output: 4.5600000000000005,
      },
    },
    "azure_ai/deepseek-v4-pro": {
      standard: {
        input: 1.74,
        output: 3.48,
        cacheRead: 0.145,
      },
    },
    "azure_ai/deepseek-v4-flash": {
      standard: {
        input: 0.19,
        output: 0.51,
        cacheRead: 0.028,
      },
    },
    "azure_ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.44,
        output: 1.32,
        cacheRead: 0.014,
      },
    },
    "azure_ai/embed-v-4-0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "azure_ai/grok-4": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "azure_ai/grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "azure_ai/grok-4.6": {
      standard: {
        input: 1.25,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "azure_ai/grok-4-20-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 1.25,
      },
    },
    "azure_ai/grok-4-20-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 1.25,
      },
    },
    "azure_ai/grok-4-1-fast-non-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
      },
    },
    "azure_ai/grok-4-1-fast-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
      },
    },
    "azure_ai/grok-code-fast-1": {
      standard: {
        input: 0.19999999999999998,
        output: 1.5,
      },
    },
    "azure_ai/jais-30b-chat": {
      standard: {
        input: 3200,
        output: 9710,
      },
    },
    "azure_ai/jamba-instruct": {
      standard: {
        input: 0.5,
        output: 0.7,
      },
    },
    "azure_ai/kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "azure_ai/kimi-k2.6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "azure_ai/ministral-3b": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "azure_ai/mistral-large": {
      standard: {
        input: 4,
        output: 12,
      },
    },
    "azure_ai/mistral-large-2407": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "azure_ai/mistral-large-latest": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "azure_ai/mistral-large-3": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "azure_ai/mistral-medium-2505": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "azure_ai/mistral-nemo": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "azure_ai/mistral-small": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "azure_ai/mistral-small-2503": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "babbage-002": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "bedrock/ap-northeast-1/anthropic.claude-instant-v1": {
      standard: {
        input: 2.23,
        output: 7.55,
      },
    },
    "bedrock/ap-northeast-1/anthropic.claude-v1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/ap-northeast-1/anthropic.claude-v2:1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/ap-northeast-1/deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "bedrock/ap-northeast-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-northeast-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-northeast-1/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.73,
        output: 3.03,
      },
    },
    "bedrock/ap-northeast-1/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.72,
        output: 3.5999999999999996,
      },
    },
    "bedrock/ap-northeast-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.73,
        output: 3.03,
      },
    },
    "bedrock/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3.03,
      },
    },
    "bedrock/ap-south-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 3.18,
        output: 4.199999999999999,
      },
    },
    "bedrock/ap-south-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.36,
        output: 0.72,
      },
    },
    "bedrock/ap-south-1/deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "bedrock/ap-south-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-south-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-south-1/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.71,
        output: 2.94,
      },
    },
    "bedrock/ap-south-1/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.72,
        output: 3.5999999999999996,
      },
    },
    "bedrock/ap-south-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/ap-southeast-2/minimax.minimax-m2.5": {
      standard: {
        input: 0.31,
        output: 1.24,
      },
    },
    "bedrock/ap-southeast-3/deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "bedrock/ap-southeast-3/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-southeast-3/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/ap-southeast-3/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.72,
        output: 3.5999999999999996,
      },
    },
    "bedrock/ap-southeast-3/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/ca-central-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 3.05,
        output: 4.03,
      },
    },
    "bedrock/ca-central-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.35,
        output: 0.69,
      },
    },
    "bedrock/eu-north-1/deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "bedrock/eu-north-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-north-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-north-1/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.72,
        output: 3.5999999999999996,
      },
    },
    "bedrock/eu-central-1/anthropic.claude-instant-v1": {
      standard: {
        input: 2.48,
        output: 8.379999999999999,
      },
    },
    "bedrock/eu-central-1/anthropic.claude-v1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/eu-central-1/anthropic.claude-v2:1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/eu-central-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-central-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-central-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/eu-west-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.8600000000000003,
        output: 3.78,
      },
    },
    "bedrock/eu-west-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.32,
        output: 0.65,
      },
    },
    "bedrock/eu-west-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-west-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-west-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/eu-west-2/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 3.45,
        output: 4.55,
      },
    },
    "bedrock/eu-west-2/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.39,
        output: 0.78,
      },
    },
    "bedrock/eu-west-2/minimax.minimax-m2.1": {
      standard: {
        input: 0.47,
        output: 1.8599999999999999,
      },
    },
    "bedrock/eu-west-2/minimax.minimax-m2.5": {
      standard: {
        input: 0.47,
        output: 1.8599999999999999,
      },
    },
    "bedrock/eu-west-2/nvidia.nemotron-super-3-120b": {
      standard: {
        input: 0.22999999999999998,
        output: 1.01,
      },
    },
    "bedrock/eu-west-2/qwen.qwen3-coder-next": {
      standard: {
        input: 0.78,
        output: 1.8599999999999999,
      },
    },
    "bedrock/eu-west-3/mistral.mistral-7b-instruct-v0:2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.26,
      },
    },
    "bedrock/eu-west-3/mistral.mistral-large-2402-v1:0": {
      standard: {
        input: 5.2,
        output: 15.6,
      },
    },
    "bedrock/eu-west-3/mistral.mixtral-8x7b-instruct-v0:1": {
      standard: {
        input: 0.59,
        output: 0.9099999999999999,
      },
    },
    "bedrock/eu-south-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-south-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/eu-south-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/invoke/anthropic.claude-3-5-sonnet-20240620-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "bedrock/sa-east-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 4.45,
        output: 5.88,
      },
    },
    "bedrock/sa-east-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.5,
        output: 1.01,
      },
    },
    "bedrock/sa-east-1/deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "bedrock/sa-east-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/sa-east-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.36,
        output: 1.44,
      },
    },
    "bedrock/sa-east-1/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.73,
        output: 3.03,
      },
    },
    "bedrock/sa-east-1/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.72,
        output: 3.5999999999999996,
      },
    },
    "bedrock/sa-east-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.6,
        output: 1.44,
      },
    },
    "bedrock/us-east-1/anthropic.claude-instant-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "bedrock/us-east-1/anthropic.claude-v1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/us-east-1/anthropic.claude-v2:1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/us-east-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.65,
        output: 3.5,
      },
    },
    "bedrock/us-east-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "bedrock/us-east-1/mistral.mistral-7b-instruct-v0:2": {
      standard: {
        input: 0.15,
        output: 0.19999999999999998,
      },
    },
    "bedrock/us-east-1/mistral.mistral-large-2402-v1:0": {
      standard: {
        input: 4,
        output: 12,
      },
    },
    "bedrock/us-east-1/mistral.mixtral-8x7b-instruct-v0:1": {
      standard: {
        input: 0.44999999999999996,
        output: 0.7,
      },
    },
    "bedrock/us-east-1/deepseek.v3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
      },
    },
    "bedrock/us-east-1/minimax.minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-east-1/minimax.minimax-m2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-east-1/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "bedrock/us-east-1/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
      },
    },
    "bedrock/us-east-1/qwen.qwen3-coder-next": {
      standard: {
        input: 0.5,
        output: 1.2,
      },
    },
    "bedrock/us-east-2/deepseek.v3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
      },
    },
    "bedrock/us-east-2/minimax.minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-east-2/minimax.minimax-m2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-east-2/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "bedrock/us-east-2/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
      },
    },
    "bedrock/us-east-2/qwen.qwen3-coder-next": {
      standard: {
        input: 0.5,
        output: 1.2,
      },
    },
    "bedrock/us-gov-east-1/amazon.nova-pro-v1:0": {
      standard: {
        input: 0.96,
        output: 3.84,
        cacheRead: 0.24,
      },
    },
    "bedrock/us-gov-east-1/amazon.titan-embed-text-v1": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "bedrock/us-gov-east-1/amazon.titan-embed-text-v2:0": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "bedrock/us-gov-east-1/amazon.titan-text-express-v1": {
      standard: {
        input: 1.3,
        output: 1.7,
      },
    },
    "bedrock/us-gov-east-1/amazon.titan-text-lite-v1": {
      standard: {
        input: 0.3,
        output: 0.39999999999999997,
      },
    },
    "bedrock/us-gov-east-1/amazon.titan-text-premier-v1:0": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
        cacheWriteOneHour: 7.199999999999999,
      },
    },
    "bedrock/us-gov-east-1/claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
        cacheWriteOneHour: 7.199999999999999,
      },
    },
    "bedrock/us-gov-east-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.65,
        output: 3.5,
      },
    },
    "bedrock/us-gov-east-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.3,
        output: 2.65,
      },
    },
    "bedrock/us-gov-west-1/amazon.nova-2-multimodal-embeddings-v1:0": {
      standard: {
        input: 0.162,
        output: 0,
      },
    },
    "bedrock/us-gov-west-1/amazon.nova-lite-v1:0": {
      standard: {
        input: 0.072,
        output: 0.288,
        cacheRead: 0.018,
      },
    },
    "bedrock/us-gov-west-1/amazon.nova-micro-v1:0": {
      standard: {
        input: 0.041999999999999996,
        output: 0.16799999999999998,
        cacheRead: 0.010499999999999999,
      },
    },
    "bedrock/us-gov-west-1/amazon.nova-pro-v1:0": {
      standard: {
        input: 0.96,
        output: 3.84,
        cacheRead: 0.24,
      },
    },
    "bedrock/us-gov-west-1/amazon.titan-embed-text-v1": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "bedrock/us-gov-west-1/amazon.titan-embed-text-v2:0": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "bedrock/us-gov-west-1/amazon.titan-text-express-v1": {
      standard: {
        input: 1.3,
        output: 1.7,
      },
    },
    "bedrock/us-gov-west-1/amazon.titan-text-lite-v1": {
      standard: {
        input: 0.3,
        output: 0.39999999999999997,
      },
    },
    "bedrock/us-gov-west-1/amazon.titan-text-premier-v1:0": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
        cacheWriteOneHour: 7.199999999999999,
      },
    },
    "bedrock/us-gov-west-1/claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
        cacheWriteOneHour: 7.199999999999999,
      },
    },
    "bedrock/us-gov-west-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.65,
        output: 3.5,
      },
    },
    "bedrock/us-gov-west-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "bedrock/us-west-1/meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.65,
        output: 3.5,
      },
    },
    "bedrock/us-west-1/meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "bedrock/us-west-2/anthropic.claude-instant-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "bedrock/us-west-2/anthropic.claude-v1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/us-west-2/anthropic.claude-v2:1": {
      standard: {
        input: 8,
        output: 24,
      },
    },
    "bedrock/us-west-2/mistral.mistral-7b-instruct-v0:2": {
      standard: {
        input: 0.15,
        output: 0.19999999999999998,
      },
    },
    "bedrock/us-west-2/mistral.mistral-large-2402-v1:0": {
      standard: {
        input: 4,
        output: 12,
      },
    },
    "bedrock/us-west-2/mistral.mixtral-8x7b-instruct-v0:1": {
      standard: {
        input: 0.44999999999999996,
        output: 0.7,
      },
    },
    "bedrock/us-west-2/deepseek.v3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
      },
    },
    "bedrock/us-west-2/minimax.minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-west-2/minimax.minimax-m2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "bedrock/us-west-2/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "bedrock/us-west-2/moonshotai.kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
      },
    },
    "bedrock/us-west-2/qwen.qwen3-coder-next": {
      standard: {
        input: 0.5,
        output: 1.2,
      },
    },
    "bedrock/us.anthropic.claude-3-5-haiku-20241022-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
        cacheRead: 0.08,
        cacheWrite: 1,
      },
    },
    "cerebras/llama-3.3-70b": {
      standard: {
        input: 0.85,
        output: 1.2,
      },
    },
    "cerebras/llama3.1-70b": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "cerebras/llama3.1-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "cerebras/gpt-oss-120b": {
      standard: {
        input: 0.35,
        output: 0.75,
      },
    },
    "cerebras/qwen-3-32b": {
      standard: {
        input: 0.39999999999999997,
        output: 0.7999999999999999,
      },
    },
    "cerebras/qwen-3.8-27b": {
      standard: {
        input: 0.9900000000000001,
        output: 1.49,
      },
    },
    chatdolphin: {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "gpt-4o-transcribe-diarize": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "claude-haiku-4-5-20251001": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "claude-sonnet-4-5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "claude-sonnet-4-5-20250929": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "claude-opus-4-5-20251101": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-6-20260205": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-7-20260416": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "cloudflare/clef": {
      standard: {
        input: 0.24,
        output: 0,
      },
    },
    "cloudflare/clef-flash": {
      standard: {
        input: 0.09,
        output: 0,
      },
    },
    "cloudflare/@cf/cloudflare/clef": {
      standard: {
        input: 0.24,
        output: 0,
      },
    },
    "cloudflare/@cf/cloudflare/clef-flash": {
      standard: {
        input: 0.09,
        output: 0,
      },
    },
    "cloudflare/@cf/meta/llama-2-7b-chat-fp16": {
      standard: {
        input: 1.923,
        output: 1.923,
      },
    },
    "cloudflare/@cf/meta/llama-2-7b-chat-int8": {
      standard: {
        input: 1.923,
        output: 1.923,
      },
    },
    "cloudflare/@cf/mistral/mistral-7b-instruct-v0.1": {
      standard: {
        input: 1.923,
        output: 1.923,
      },
    },
    "cloudflare/@hf/thebloke/codellama-7b-instruct-awq": {
      standard: {
        input: 1.923,
        output: 1.923,
      },
    },
    "cloudflare/@cf/openai/gpt-oss-120b": {
      standard: {
        input: 0.35,
        output: 0.75,
      },
    },
    "cloudflare/@cf/google/gemma-2b-it-lora": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "cloudflare/@cf/meta/llama-3.2-3b-instruct": {
      standard: {
        input: 0.0509,
        output: 0.335,
      },
    },
    "cloudflare/@cf/meta/llama-guard-3-8b": {
      standard: {
        input: 0.48400000000000004,
        output: 0.03,
      },
    },
    "cloudflare/@cf/mistral/mistral-7b-instruct-v0.2-lora": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "cloudflare/@cf/moonshotai/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "cloudflare/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": {
      standard: {
        input: 0.49699999999999994,
        output: 4.881,
      },
    },
    "cloudflare/@cf/meta/llama-3.1-8b-instruct-fp8": {
      standard: {
        input: 0.15200000000000002,
        output: 0.28700000000000003,
      },
    },
    "cloudflare/@cf/meta/llama-3.2-1b-instruct": {
      standard: {
        input: 0.027,
        output: 0.201,
      },
    },
    "cloudflare/@cf/moonshotai/kimi-k2.6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "cloudflare/@cf/zai-org/glm-4.7-flash": {
      standard: {
        input: 0.060500000000000005,
        output: 0.39999999999999997,
      },
    },
    "cloudflare/@cf/meta-llama/llama-2-7b-chat-hf-lora": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
      standard: {
        input: 0.293,
        output: 2.2529999999999997,
      },
    },
    "cloudflare/@cf/ibm-granite/granite-4.0-h-micro": {
      standard: {
        input: 0.017,
        output: 0.112,
      },
    },
    "cloudflare/@cf/qwen/qwen2.5-coder-32b-instruct": {
      standard: {
        input: 0.66,
        output: 1,
      },
    },
    "cloudflare/@cf/zai-org/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "cloudflare/@cf/nvidia/nemotron-3-120b-a12b": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "cloudflare/@cf/aisingapore/gemma-sea-lion-v4-27b-it": {
      standard: {
        input: 0.351,
        output: 0.5549999999999999,
      },
    },
    "cloudflare/@cf/qwen/qwen3-30b-a3b-fp8": {
      standard: {
        input: 0.0509,
        output: 0.335,
      },
    },
    "cloudflare/@cf/google/gemma-7b-it-lora": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "cloudflare/@cf/google/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "cloudflare/@cf/mistralai/mistral-small-3.1-24b-instruct": {
      standard: {
        input: 0.351,
        output: 0.5549999999999999,
      },
    },
    "cloudflare/@cf/meta/llama-3.2-11b-vision-instruct": {
      standard: {
        input: 0.048499999999999995,
        output: 0.6759999999999999,
      },
    },
    "cloudflare/@cf/openai/gpt-oss-20b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.3,
      },
    },
    "cloudflare/@cf/meta/llama-4-scout-17b-16e-instruct": {
      standard: {
        input: 0.27,
        output: 0.85,
      },
    },
    "cloudflare/@cf/qwen/qwq-32b": {
      standard: {
        input: 0.66,
        output: 1,
      },
    },
    "codestral/codestral-2405": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "codestral/codestral-latest": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "cohere.command-light-text-v14": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "cohere.command-text-v14": {
      standard: {
        input: 1,
        output: 2,
      },
    },
    "cohere.embed-english-v3": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "cohere.embed-multilingual-v3": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "cohere.embed-v4:0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "us.cohere.embed-v4:0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "global.cohere.embed-v4:0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "cohere/embed-v4.0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "cohere/embed-v5.0-pro": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "cohere/embed-v5.0-fast": {
      standard: {
        input: 0.08,
        output: 0,
      },
    },
    "cohere.rerank-v3-5:0": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "command-a-03-2025": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "c4ai-aya-expanse-32b": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "command-a-plus-05-2026": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "command-nightly": {
      standard: {
        input: 1,
        output: 2,
      },
    },
    "command-r-08-2024": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "command-r-plus-08-2024": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "command-r7b-12-2024": {
      standard: {
        input: 0.0375,
        output: 0.15,
      },
    },
    "computer-use-preview": {
      standard: {
        input: 3,
        output: 12,
      },
    },
    "deepseek-chat": {
      standard: {
        input: 0.28,
        output: 0.42,
        cacheRead: 0.028,
      },
    },
    "deepseek-reasoner": {
      standard: {
        input: 0.28,
        output: 0.42,
        cacheRead: 0.028,
      },
    },
    "dashscope/deepseek-v4-flash": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "dashscope/deepseek-v4-flash-0731": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "dashscope/deepseek-v4-pro": {
      standard: {
        input: 2.4,
        output: 4.8,
        cacheRead: 0.19999999999999998,
      },
    },
    "dashscope/glm-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "dashscope/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.28,
      },
    },
    "dashscope/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "dashscope/qwen-coder": {
      standard: {
        input: 0.3,
        output: 1.5,
      },
    },
    "dashscope/qwen-max": {
      standard: {
        input: 1.5999999999999999,
        output: 6.3999999999999995,
      },
    },
    "dashscope/qwen-plus": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "dashscope/qwen-plus-2025-01-25": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "dashscope/qwen-plus-2025-04-28": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "dashscope/qwen-plus-2025-07-14": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "dashscope/qwen-turbo": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "dashscope/qwen-turbo-2024-11-01": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
      },
    },
    "dashscope/qwen-turbo-2025-04-28": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "dashscope/qwen-turbo-latest": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "dashscope/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "dashscope/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "dashscope/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "dashscope/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.39999999999999997,
        output: 4,
      },
    },
    "dashscope/qwen3-vl-32b-instruct": {
      standard: {
        input: 0.16,
        output: 0.64,
      },
    },
    "dashscope/qwen3-vl-32b-thinking": {
      standard: {
        input: 0.16,
        output: 2.87,
      },
    },
    "dashscope/qwen3.7-max": {
      standard: {
        input: 2.5,
        output: 7.5,
        cacheRead: 0.5,
      },
    },
    "dashscope/qwen3.8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "dashscope/qwen3.8-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
        cacheWrite: 0.19999999999999998,
      },
    },
    "dashscope/qwen3.8-omni-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
      },
    },
    "dashscope/qwq-plus": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "qwencloud/deepseek-v4-flash": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "qwencloud/deepseek-v4-flash-0731": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "qwencloud/deepseek-v4-pro": {
      standard: {
        input: 2.4,
        output: 4.8,
        cacheRead: 0.19999999999999998,
      },
    },
    "qwencloud/glm-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "qwencloud/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.28,
      },
    },
    "qwencloud/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "qwencloud/qwen-coder": {
      standard: {
        input: 0.3,
        output: 1.5,
      },
    },
    "qwencloud/qwen-max": {
      standard: {
        input: 1.5999999999999999,
        output: 6.3999999999999995,
      },
    },
    "qwencloud/qwen-plus": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "qwencloud/qwen-plus-2025-01-25": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "qwencloud/qwen-plus-2025-04-28": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "qwencloud/qwen-plus-2025-07-14": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "qwencloud/qwen-turbo": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwencloud/qwen-turbo-2024-11-01": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
      },
    },
    "qwencloud/qwen-turbo-2025-04-28": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwencloud/qwen-turbo-latest": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwencloud/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "qwencloud/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "qwencloud/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "qwencloud/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.39999999999999997,
        output: 4,
      },
    },
    "qwencloud/qwen3-vl-32b-instruct": {
      standard: {
        input: 0.16,
        output: 0.64,
      },
    },
    "qwencloud/qwen3-vl-32b-thinking": {
      standard: {
        input: 0.16,
        output: 2.87,
      },
    },
    "qwencloud/qwen3.7-max": {
      standard: {
        input: 2.5,
        output: 7.5,
        cacheRead: 0.5,
      },
    },
    "qwencloud/qwen3.8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "qwencloud/qwq-plus": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "qwen_ai_platform/deepseek-v4-flash": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "qwen_ai_platform/deepseek-v4-flash-0731": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.04,
      },
    },
    "qwen_ai_platform/deepseek-v4-pro": {
      standard: {
        input: 2.4,
        output: 4.8,
        cacheRead: 0.19999999999999998,
      },
    },
    "qwen_ai_platform/glm-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "qwen_ai_platform/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.28,
      },
    },
    "qwen_ai_platform/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "qwen_ai_platform/qwen-coder": {
      standard: {
        input: 0.3,
        output: 1.5,
      },
    },
    "qwen_ai_platform/qwen-max": {
      standard: {
        input: 1.5999999999999999,
        output: 6.3999999999999995,
      },
    },
    "qwen_ai_platform/qwen-plus": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "qwen_ai_platform/qwen-plus-2025-01-25": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
      },
    },
    "qwen_ai_platform/qwen-plus-2025-04-28": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "qwen_ai_platform/qwen-plus-2025-07-14": {
      standard: {
        input: 0.39999999999999997,
        output: 1.2,
        reasoning: 4,
      },
    },
    "qwen_ai_platform/qwen-turbo": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwen_ai_platform/qwen-turbo-2024-11-01": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
      },
    },
    "qwen_ai_platform/qwen-turbo-2025-04-28": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwen_ai_platform/qwen-turbo-latest": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        reasoning: 0.5,
      },
    },
    "qwen_ai_platform/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "qwen_ai_platform/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "qwen_ai_platform/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "qwen_ai_platform/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.39999999999999997,
        output: 4,
      },
    },
    "qwen_ai_platform/qwen3-vl-32b-instruct": {
      standard: {
        input: 0.16,
        output: 0.64,
      },
    },
    "qwen_ai_platform/qwen3-vl-32b-thinking": {
      standard: {
        input: 0.16,
        output: 2.87,
      },
    },
    "qwen_ai_platform/qwen3.7-max": {
      standard: {
        input: 2.5,
        output: 7.5,
        cacheRead: 0.5,
      },
    },
    "qwen_ai_platform/qwen3.8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "qwen_ai_platform/qwen3.8-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
        cacheWrite: 0.19999999999999998,
      },
    },
    "qwen_ai_platform/qwen3.8-omni-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
      },
    },
    "qwen_ai_platform/qwq-plus": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "databricks/databricks-bge-large-en": {
      standard: {
        input: 0.10003000000000001,
        output: 0,
        cacheRead: 0.10003000000000001,
        cacheWrite: 0.10003000000000001,
      },
    },
    "databricks/databricks-claude-fable-5": {
      standard: {
        input: 10.00006,
        output: 50.00002,
        cacheRead: 1.0000200000000001,
        cacheWrite: 12.50004,
      },
    },
    "databricks/databricks-claude-fable-5-1": {
      standard: {
        input: 10.00006,
        output: 50.00002,
        cacheRead: 0.25004,
        cacheWrite: 12.50004,
      },
    },
    "databricks/databricks-claude-haiku-4-5": {
      standard: {
        input: 1.0000200000000001,
        output: 5.00003,
        cacheRead: 0.10003000000000001,
        cacheWrite: 1.24999,
      },
    },
    "databricks/databricks-claude-opus-4": {
      standard: {
        input: 15.000020000000001,
        output: 75.00003000000001,
        cacheRead: 1.50003,
        cacheWrite: 18.74999,
      },
    },
    "databricks/databricks-claude-opus-4-1": {
      standard: {
        input: 15.000020000000001,
        output: 75.00003000000001,
        cacheRead: 1.50003,
        cacheWrite: 18.74999,
      },
    },
    "databricks/databricks-claude-opus-4-5": {
      standard: {
        input: 5.00003,
        output: 25.000010000000003,
        cacheRead: 0.5000100000000001,
        cacheWrite: 6.25002,
      },
    },
    "databricks/databricks-claude-opus-4-6": {
      standard: {
        input: 5.00003,
        output: 25.000010000000003,
        cacheRead: 0.5000100000000001,
        cacheWrite: 6.25002,
      },
    },
    "databricks/databricks-claude-opus-4-7": {
      standard: {
        input: 5.00003,
        output: 25.00001,
        cacheRead: 0.5000100000000001,
        cacheWrite: 6.25002,
      },
    },
    "databricks/databricks-claude-opus-4-8": {
      standard: {
        input: 5.00003,
        output: 25.00001,
        cacheRead: 0.5000100000000001,
        cacheWrite: 6.25002,
      },
    },
    "databricks/databricks-claude-opus-5": {
      standard: {
        input: 5.00003,
        output: 25.00001,
        cacheRead: 0.5000100000000001,
        cacheWrite: 6.25002,
      },
    },
    "databricks/databricks-claude-opus-5-5": {
      standard: {
        input: 4.00001,
        output: 19.99998,
        cacheRead: 0.19999,
        cacheWrite: 5.00003,
        cacheWriteOneHour: 8.00002,
      },
    },
    "databricks/databricks-claude-sonnet-4": {
      standard: {
        input: 2.9999900000000004,
        output: 15.000020000000001,
        cacheRead: 0.30002,
        cacheWrite: 3.7499700000000002,
      },
    },
    "databricks/databricks-claude-sonnet-4-1": {
      standard: {
        input: 2.9999900000000004,
        output: 15.000020000000001,
        cacheRead: 0.30002,
        cacheWrite: 3.7499700000000002,
      },
    },
    "databricks/databricks-claude-sonnet-4-5": {
      standard: {
        input: 2.9999900000000004,
        output: 15.000020000000001,
        cacheRead: 0.30002,
        cacheWrite: 3.7499700000000002,
      },
    },
    "databricks/databricks-claude-sonnet-4-6": {
      standard: {
        input: 2.9999900000000004,
        output: 15.000020000000001,
        cacheRead: 0.30002,
        cacheWrite: 3.7499700000000002,
      },
    },
    "databricks/databricks-claude-sonnet-5": {
      standard: {
        input: 2.99999,
        output: 15.00002,
        cacheRead: 0.30002,
        cacheWrite: 3.7499700000000002,
      },
    },
    "databricks/databricks-deepseek-v4-flash-0731": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.028,
        cacheWrite: 0.14,
      },
    },
    "databricks/databricks-deepseek-v4-pro-0813": {
      standard: {
        input: 1.31999,
        output: 3.9599699999999998,
        cacheRead: 0.13202,
        cacheWrite: 1.31999,
      },
    },
    "databricks/databricks-gemini-2-5-flash": {
      standard: {
        input: 0.30001999999999995,
        output: 2.49998,
        cacheRead: 0.030002,
        cacheWrite: 0.30002,
      },
    },
    "databricks/databricks-gemini-2-5-pro": {
      standard: {
        input: 1.24999,
        output: 9.999990000000002,
        cacheRead: 0.124999,
        cacheWrite: 1.24999,
      },
    },
    "databricks/databricks-gemini-3-1-flash-lite": {
      standard: {
        input: 0.31248,
        output: 1.87502,
        cacheRead: 0.031219999999999998,
        cacheWrite: 0.31248,
      },
    },
    "databricks/databricks-gemini-3-1-pro": {
      standard: {
        input: 2.49998,
        output: 15.000020000000001,
        cacheRead: 0.24997,
        cacheWrite: 2.49998,
      },
    },
    "databricks/databricks-gemini-3-flash": {
      standard: {
        input: 0.6250300000000001,
        output: 3.7499700000000002,
        cacheRead: 0.06251,
        cacheWrite: 0.6250300000000001,
      },
    },
    "databricks/databricks-gemini-3-pro": {
      standard: {
        input: 2.49998,
        output: 15.000020000000001,
        cacheRead: 0.24997,
        cacheWrite: 2.49998,
      },
    },
    "databricks/databricks-gemini-3-6-flash": {
      standard: {
        input: 1.87502,
        output: 9.375029999999999,
        cacheRead: 0.18753,
        cacheWrite: 1.87502,
      },
    },
    "databricks/databricks-gemini-3-5-flash": {
      standard: {
        input: 1.87502,
        output: 11.249979999999999,
        cacheRead: 0.18753,
        cacheWrite: 1.87502,
      },
    },
    "databricks/databricks-gemini-3-5-flash-lite": {
      standard: {
        input: 0.37499,
        output: 3.12501,
        cacheRead: 0.03752,
        cacheWrite: 0.37499,
      },
    },
    "databricks/databricks-gemma-3-12b": {
      standard: {
        input: 0.15000999999999998,
        output: 0.5000100000000001,
        cacheRead: 0.15001,
        cacheWrite: 0.15001,
      },
    },
    "databricks/databricks-glm-5-2": {
      standard: {
        input: 1.4,
        output: 4.399990000000001,
        cacheRead: 0.25998,
        cacheWrite: 1.4,
      },
    },
    "databricks/databricks-glm-5-3": {
      standard: {
        input: 1.4,
        output: 4.399990000000001,
        cacheRead: 0.25998,
        cacheWrite: 1.4,
      },
    },
    "databricks/databricks-glm-5-3-flash": {
      standard: {
        input: 0.15001,
        output: 0.5000100000000001,
        cacheRead: 0.030029999999999998,
        cacheWrite: 0.15001,
      },
    },
    "databricks/databricks-gpt-5": {
      standard: {
        input: 1.24999,
        output: 9.999990000000002,
        cacheRead: 0.12502,
        cacheWrite: 1.24999,
      },
    },
    "databricks/databricks-gpt-5-1": {
      standard: {
        input: 1.24999,
        output: 9.999990000000002,
        cacheRead: 0.12502,
        cacheWrite: 1.24999,
      },
    },
    "databricks/databricks-gpt-5-2": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
        cacheWrite: 1.75,
      },
    },
    "databricks/databricks-gpt-5-3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
        cacheWrite: 1.75,
      },
    },
    "databricks/databricks-gpt-5-4": {
      standard: {
        input: 2.49998,
        output: 15.000020000000001,
        cacheRead: 0.24997,
        cacheWrite: 2.49998,
      },
    },
    "databricks/databricks-gpt-5-4-mini": {
      standard: {
        input: 0.74998,
        output: 4.50002,
        cacheRead: 0.07497000000000001,
        cacheWrite: 0.74998,
      },
    },
    "databricks/databricks-gpt-5-4-nano": {
      standard: {
        input: 0.19999,
        output: 1.24999,
        cacheRead: 0.02002,
        cacheWrite: 0.19999,
      },
    },
    "databricks/databricks-gpt-5-6-sol": {
      standard: {
        input: 4.00001,
        output: 19.99998,
        cacheRead: 0.39998,
        cacheWrite: 5.00003,
      },
    },
    "databricks/databricks-gpt-5-6-terra": {
      standard: {
        input: 2.49998,
        output: 15.00002,
        cacheRead: 0.24997,
        cacheWrite: 3.12501,
      },
    },
    "databricks/databricks-gpt-5-6-luna": {
      standard: {
        input: 1.0000200000000001,
        output: 5.99998,
        cacheRead: 0.10003000000000001,
        cacheWrite: 1.24999,
      },
    },
    "databricks/databricks-gpt-5-5": {
      standard: {
        input: 5.00003,
        output: 29.999969999999998,
        cacheRead: 0.5000100000000001,
        cacheWrite: 5.00003,
      },
    },
    "databricks/databricks-gpt-5-5-pro": {
      standard: {
        input: 29.999969999999998,
        output: 180.00003,
        cacheRead: 29.999969999999998,
        cacheWrite: 29.999969999999998,
      },
    },
    "databricks/databricks-gpt-5-mini": {
      standard: {
        input: 0.24997000000000005,
        output: 1.9999700000000002,
        cacheRead: 0.024990000000000002,
        cacheWrite: 0.24997,
      },
    },
    "databricks/databricks-gpt-5-nano": {
      standard: {
        input: 0.049980000000000004,
        output: 0.39998000000000006,
        cacheRead: 0.00497,
        cacheWrite: 0.049980000000000004,
      },
    },
    "databricks/databricks-gpt-oss-120b": {
      standard: {
        input: 0.15000999999999998,
        output: 0.59997,
        cacheRead: 0.15001,
        cacheWrite: 0.15001,
      },
    },
    "databricks/databricks-gpt-oss-20b": {
      standard: {
        input: 0.07,
        output: 0.30001999999999995,
        cacheRead: 0.07,
        cacheWrite: 0.07,
      },
    },
    "databricks/databricks-grok-4-6": {
      standard: {
        input: 2.49998,
        output: 7.50001,
        cacheRead: 0.6250300000000001,
        cacheWrite: 2.49998,
      },
    },
    "databricks/databricks-gte-large-en": {
      standard: {
        input: 0.12999000000000002,
        output: 0,
        cacheRead: 0.12999,
        cacheWrite: 0.12999,
      },
    },
    "databricks/databricks-inkling": {
      standard: {
        input: 1.0000200000000001,
        output: 4.04999,
        cacheRead: 0.17003,
        cacheWrite: 1.0000200000000001,
      },
    },
    "databricks/databricks-kimi-k3": {
      standard: {
        input: 2.99999,
        output: 15.00002,
        cacheRead: 0.30002,
        cacheWrite: 2.99999,
      },
    },
    "databricks/databricks-llama-4-maverick": {
      standard: {
        input: 0.5000100000000001,
        output: 1.5000300000000002,
        cacheRead: 0.5000100000000001,
        cacheWrite: 0.5000100000000001,
      },
    },
    "databricks/databricks-meta-llama-3-1-8b-instruct": {
      standard: {
        input: 0.15000999999999998,
        output: 0.45003000000000004,
        cacheRead: 0.15001,
        cacheWrite: 0.15001,
      },
    },
    "databricks/databricks-meta-llama-3-3-70b-instruct": {
      standard: {
        input: 0.5000100000000001,
        output: 1.5000300000000002,
        cacheRead: 0.5000100000000001,
        cacheWrite: 0.5000100000000001,
      },
    },
    "databricks/databricks-qwen35-122b-a10b": {
      standard: {
        input: 0.22000999999999998,
        output: 2.20003,
        cacheRead: 0.22000999999999998,
        cacheWrite: 0.22000999999999998,
      },
    },
    "databricks/databricks-qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.15001,
        output: 1.20001,
        cacheRead: 0.15001,
        cacheWrite: 0.15001,
      },
    },
    "databricks/databricks-qwen3-embedding-0-6b": {
      standard: {
        input: 0.02002,
        output: 0,
        cacheRead: 0.02002,
        cacheWrite: 0.02002,
      },
    },
    "davinci-002": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "deepinfra/Gryphe/MythoMax-L2-13b": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/NousResearch/Hermes-3-Llama-3.1-405B": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "deepinfra/NousResearch/Hermes-3-Llama-3.1-70B": {
      standard: {
        input: 0.7,
        output: 0.7,
      },
    },
    "deepinfra/Qwen/QwQ-32B": {
      standard: {
        input: 0.15,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/Qwen/Qwen2.5-72B-Instruct": {
      standard: {
        input: 0.36,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/Qwen/Qwen2.5-7B-Instruct": {
      standard: {
        input: 0.04,
        output: 0.09999999999999999,
      },
    },
    "deepinfra/Qwen/Qwen2.5-VL-32B-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "deepinfra/Qwen/Qwen3-14B": {
      standard: {
        input: 0.12,
        output: 0.24,
      },
    },
    "deepinfra/Qwen/Qwen3-235B-A22B": {
      standard: {
        input: 0.18,
        output: 0.54,
      },
    },
    "deepinfra/Qwen/Qwen3-235B-A22B-Instruct-2507": {
      standard: {
        input: 0.09,
        output: 0.55,
      },
    },
    "deepinfra/Qwen/Qwen3-235B-A22B-Thinking-2507": {
      standard: {
        input: 0.3,
        output: 2.9000000000000004,
      },
    },
    "deepinfra/Qwen/Qwen3-30B-A3B": {
      standard: {
        input: 0.12,
        output: 0.5,
      },
    },
    "deepinfra/Qwen/Qwen3-32B": {
      standard: {
        input: 0.08,
        output: 0.28,
      },
    },
    "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo": {
      standard: {
        input: 0.3,
        output: 1,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/Qwen/Qwen3-Next-80B-A3B-Instruct": {
      standard: {
        input: 0.09,
        output: 1.1,
      },
    },
    "deepinfra/Qwen/Qwen3-Next-80B-A3B-Thinking": {
      standard: {
        input: 0.14,
        output: 1.4,
      },
    },
    "deepinfra/Sao10K/L3-8B-Lunaris-v1-Turbo": {
      standard: {
        input: 0.04,
        output: 0.049999999999999996,
      },
    },
    "deepinfra/Sao10K/L3.1-70B-Euryale-v2.2": {
      standard: {
        input: 0.85,
        output: 0.85,
      },
    },
    "deepinfra/Sao10K/L3.3-70B-Euryale-v2.3": {
      standard: {
        input: 0.65,
        output: 0.75,
      },
    },
    "deepinfra/allenai/olmOCR-7B-0725-FP8": {
      standard: {
        input: 0.27,
        output: 1.5,
      },
    },
    "deepinfra/anthropic/claude-3-7-sonnet-latest": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
      },
    },
    "deepinfra/anthropic/claude-4-opus": {
      standard: {
        input: 16.5,
        output: 82.5,
      },
    },
    "deepinfra/anthropic/claude-4-sonnet": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1": {
      standard: {
        input: 0.7,
        output: 2.4,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1-0528": {
      standard: {
        input: 0.5,
        output: 2.1500000000000004,
        cacheRead: 0.39999999999999997,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1-0528-Turbo": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B": {
      standard: {
        input: 0.27,
        output: 0.27,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-R1-Turbo": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V3": {
      standard: {
        input: 0.32,
        output: 0.8899999999999999,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 0.24,
        output: 0.8999999999999999,
        cacheRead: 0.135,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V3.1": {
      standard: {
        input: 0.25,
        output: 0.95,
        cacheRead: 0.216,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V3.1-Terminus": {
      standard: {
        input: 0.27,
        output: 1,
        cacheRead: 0.216,
      },
    },
    "deepinfra/google/gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
      },
    },
    "deepinfra/google/gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "deepinfra/google/gemma-3-12b-it": {
      standard: {
        input: 0.049999999999999996,
        output: 0.15,
      },
    },
    "deepinfra/google/gemma-3-27b-it": {
      standard: {
        input: 0.08,
        output: 0.16,
      },
    },
    "deepinfra/google/gemma-3-4b-it": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "deepinfra/meta-llama/Llama-3.2-11B-Vision-Instruct": {
      standard: {
        input: 0.049,
        output: 0.049,
      },
    },
    "deepinfra/meta-llama/Llama-3.2-3B-Instruct": {
      standard: {
        input: 0.02,
        output: 0.02,
      },
    },
    "deepinfra/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.22999999999999998,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo": {
      standard: {
        input: 0.09999999999999999,
        output: 0.32,
      },
    },
    "deepinfra/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7999999999999999,
      },
    },
    "deepinfra/meta-llama/Llama-4-Scout-17B-16E-Instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "deepinfra/meta-llama/Llama-Guard-3-8B": {
      standard: {
        input: 0.055,
        output: 0.055,
      },
    },
    "deepinfra/meta-llama/Llama-Guard-4-12B": {
      standard: {
        input: 0.18,
        output: 0.18,
      },
    },
    "deepinfra/meta-llama/Meta-Llama-3-8B-Instruct": {
      standard: {
        input: 0.03,
        output: 0.06,
      },
    },
    "deepinfra/meta-llama/Meta-Llama-3.1-70B-Instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.03,
        output: 0.049999999999999996,
      },
    },
    "deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
      standard: {
        input: 0.02,
        output: 0.04,
      },
    },
    "deepinfra/microsoft/WizardLM-2-8x22B": {
      standard: {
        input: 0.48,
        output: 0.48,
      },
    },
    "deepinfra/microsoft/phi-4": {
      standard: {
        input: 0.07,
        output: 0.14,
      },
    },
    "deepinfra/mistralai/Mistral-Nemo-Instruct-2407": {
      standard: {
        input: 0.019000000000000003,
        output: 0.03,
      },
    },
    "deepinfra/mistralai/Mistral-Small-24B-Instruct-2501": {
      standard: {
        input: 0.049999999999999996,
        output: 0.08,
      },
    },
    "deepinfra/mistralai/Mistral-Small-3.2-24B-Instruct-2506": {
      standard: {
        input: 0.075,
        output: 0.19999999999999998,
      },
    },
    "deepinfra/mistralai/Mixtral-8x7B-Instruct-v0.1": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/moonshotai/Kimi-K2-Instruct": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "deepinfra/moonshotai/Kimi-K2-Instruct-0905": {
      standard: {
        input: 0.5,
        output: 2,
        cacheRead: 0.39999999999999997,
      },
    },
    "deepinfra/nvidia/Llama-3.1-Nemotron-70B-Instruct": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "deepinfra/nvidia/Llama-3.3-Nemotron-Super-49B-v1.5": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/nvidia/NVIDIA-Nemotron-3.5-Lightning": {
      standard: {
        input: 0.08,
        output: 0.19999999999999998,
        cacheRead: 0.04,
      },
    },
    "deepinfra/nvidia/NVIDIA-Nemotron-Nano-9B-v2": {
      standard: {
        input: 0.04,
        output: 0.16,
      },
    },
    "deepinfra/openai/gpt-oss-120b": {
      standard: {
        input: 0.037,
        output: 0.16999999999999998,
      },
    },
    "deepinfra/openai/gpt-oss-20b": {
      standard: {
        input: 0.03,
        output: 0.14,
      },
    },
    "deepinfra/zai-org/GLM-4.5": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "deepseek/deepseek-chat": {
      standard: {
        input: 0.28,
        output: 0.42,
        cacheRead: 0.028,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-coder": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.014,
      },
    },
    "deepseek/deepseek-r1": {
      standard: {
        input: 0.55,
        output: 2.1900000000000004,
        cacheRead: 0.14,
      },
    },
    "deepseek/deepseek-reasoner": {
      standard: {
        input: 0.28,
        output: 0.42,
        cacheRead: 0.028,
      },
    },
    "deepseek/deepseek-v3": {
      standard: {
        input: 0.27,
        output: 1.1,
        cacheRead: 0.07,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-v3.2": {
      standard: {
        input: 0.28,
        output: 0.39999999999999997,
        cacheRead: 0.028,
      },
    },
    "deepseek.v3-v1:0": {
      standard: {
        input: 0.58,
        output: 1.68,
      },
    },
    "deepseek.v3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
      },
    },
    dolphin: {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "deepseek-v3-2-251201": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "glm-4-7-251222": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "kimi-k2-thinking-251104": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "doubao-embedding": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "doubao-embedding-large": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "doubao-embedding-large-text-240915": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "doubao-embedding-large-text-250515": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "doubao-embedding-text-240715": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sail/moonshotai/Kimi-K3": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
      },
    },
    "sail/zai-org/GLM-5.3": {
      standard: {
        input: 0.98,
        output: 3.08,
        cacheRead: 0.18,
      },
    },
    "sail/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.11,
        output: 0.35,
        cacheRead: 0.02,
      },
    },
    "sail/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 0.9199999999999999,
        output: 2.77,
        cacheRead: 0.04,
      },
    },
    "sail/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.09,
        output: 0.18,
        cacheRead: 0.02,
      },
    },
    "sail/deepseek-ai/DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.006,
      },
    },
    "sail/moonshotai/Kimi-K2.6": {
      standard: {
        input: 1,
        output: 4,
        cacheRead: 0.19999999999999998,
      },
    },
    "sail/google/gemma-4-31B-it": {
      standard: {
        input: 0.39999999999999997,
        output: 0.6,
        cacheRead: 0.19999999999999998,
      },
    },
    "sail/nvidia/Gemma-4-31B-IT-NVFP4": {
      standard: {
        input: 0.14,
        output: 0.39999999999999997,
        cacheRead: 0.07,
      },
    },
    "sail/google/gemma-4-12B-it": {
      standard: {
        input: 0.3,
        output: 2,
        cacheRead: 0.15,
      },
    },
    "sail/openai/gpt-oss-120b": {
      standard: {
        input: 0.06,
        output: 0.39999999999999997,
        cacheRead: 0.03,
      },
    },
    "sail/Qwen/Qwen3.6-35B-A3B": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.02,
      },
    },
    "embed-english-light-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "embed-english-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "embed-multilingual-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "embed-multilingual-light-v3.0": {
      standard: {
        input: 100,
        output: 0,
      },
    },
    "eu.amazon.nova-lite-v1:0": {
      standard: {
        input: 0.078,
        output: 0.312,
        cacheRead: 0.0195,
      },
    },
    "eu.amazon.nova-micro-v1:0": {
      standard: {
        input: 0.046,
        output: 0.184,
        cacheRead: 0.0115,
      },
    },
    "eu.amazon.nova-pro-v1:0": {
      standard: {
        input: 1.0499999999999998,
        output: 4.199999999999999,
        cacheRead: 0.26249999999999996,
      },
    },
    "eu.anthropic.claude-3-5-haiku-20241022-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
        cacheRead: 0.08,
        cacheWrite: 1,
      },
    },
    "eu.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
        cacheWriteOneHour: 2.2,
      },
    },
    "eu.anthropic.claude-3-5-sonnet-20240620-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "eu.anthropic.claude-3-5-sonnet-20241022-v2:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "eu.anthropic.claude-3-7-sonnet-20250219-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "eu.anthropic.claude-3-opus-20240229-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "eu.anthropic.claude-opus-4-1-20250805-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "eu.anthropic.claude-opus-4-20250514-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "eu.anthropic.claude-sonnet-4-20250514-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "eu.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "eu.meta.llama3-2-1b-instruct-v1:0": {
      standard: {
        input: 0.13,
        output: 0.13,
      },
    },
    "eu.meta.llama3-2-3b-instruct-v1:0": {
      standard: {
        input: 0.19,
        output: 0.19,
      },
    },
    "eu.mistral.pixtral-large-2502-v1:0": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "fal_ai/fal-ai/moondream3-preview/query": {
      standard: {
        input: 0.39999999999999997,
        output: 3.5,
      },
    },
    "fireworks-ai-4.1b-to-16b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks-ai-56b-to-176b": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks-ai-above-16b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks-ai-default": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks-ai-embedding-150m-to-350m": {
      standard: {
        input: 0.016,
        output: 0,
      },
    },
    "fireworks-ai-embedding-up-to-150m": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "fireworks-ai-moe-up-to-56b": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks-ai-up-to-4b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/WhereIsAI/UAE-Large-V1": {
      standard: {
        input: 0.016,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-v2-instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1": {
      standard: {
        input: 3,
        output: 8,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-0528": {
      standard: {
        input: 3,
        output: 8,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-basic": {
      standard: {
        input: 0.55,
        output: 2.1900000000000004,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v3": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v3-0324": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v3p1": {
      standard: {
        input: 0.56,
        output: 1.68,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v3p1-terminus": {
      standard: {
        input: 0.56,
        output: 1.68,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v3p2": {
      standard: {
        input: 0.56,
        output: 1.68,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.028,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4-pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.044,
      },
    },
    "fireworks_ai/deepseek-v4-pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.044,
      },
    },
    "fireworks_ai/accounts/fireworks/models/firefunction-v2": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-4p5": {
      standard: {
        input: 0.55,
        output: 2.1900000000000004,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-4p5-air": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-4p6": {
      standard: {
        input: 0.55,
        output: 2.1900000000000004,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-4p7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-5p1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-5p2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gpt-oss-20b": {
      standard: {
        input: 0.07,
        output: 0.3,
        cacheRead: 0.035,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2-instruct": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2-instruct-0905": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2p5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2p6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k2p7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-405b-instruct": {
      standard: {
        input: 3,
        output: 3,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-8b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-11b-vision-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-1b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-3b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-90b-vision-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama4-maverick-instruct-basic": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama4-scout-instruct-basic": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/minimax-m2p1": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "fireworks_ai/accounts/fireworks/models/minimax-m3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x22b-instruct-hf": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2-72b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-32b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/yi-large": {
      standard: {
        input: 3,
        output: 3,
      },
    },
    "fireworks_ai/deepseek-v4-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.028,
      },
    },
    "fireworks_ai/glm-4p7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/glm-5p1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "fireworks_ai/glm-5p1-fast": {
      standard: {
        input: 2.8,
        output: 8.8,
        cacheRead: 0.52,
      },
    },
    "fireworks_ai/glm-5p2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "fireworks_ai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "fireworks_ai/gpt-oss-20b": {
      standard: {
        input: 0.07,
        output: 0.3,
        cacheRead: 0.035,
      },
    },
    "fireworks_ai/kimi-k2p5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "fireworks_ai/kimi-k2p6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "fireworks_ai/kimi-k2p6-fast": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/kimi-k2p7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "fireworks_ai/kimi-k2p7-code-fast": {
      standard: {
        input: 1.9,
        output: 8,
        cacheRead: 0.38,
      },
    },
    "fireworks_ai/minimax-m2p1": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "fireworks_ai/minimax-m3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "fireworks_ai/qwen3p7-plus": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.08,
      },
    },
    "fireworks_ai/nomic-ai/nomic-embed-text-v1": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "fireworks_ai/nomic-ai/nomic-embed-text-v1.5": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "fireworks_ai/thenlper/gte-base": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "fireworks_ai/thenlper/gte-large": {
      standard: {
        input: 0.016,
        output: 0,
      },
    },
    "friendliai/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "friendliai/zai-org/GLM-5.3": {
      standard: {
        input: 1.26,
        output: 3.9600000000000004,
        cacheRead: 0.234,
      },
    },
    "friendliai/google/gemma-4-31B-it": {
      standard: {
        input: 0.14,
        output: 0.39999999999999997,
      },
    },
    "friendliai/zai-org/GLM-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "friendliai/deepseek-ai/DeepSeek-V3.2": {
      standard: {
        input: 0.5,
        output: 1.5,
        cacheRead: 0.25,
      },
    },
    "friendliai/MiniMaxAI/MiniMax-M2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "friendliai/zai-org/GLM-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "ft:babbage-002": {
      standard: {
        input: 1.5999999999999999,
        output: 1.5999999999999999,
      },
    },
    "ft:davinci-002": {
      standard: {
        input: 12,
        output: 12,
      },
    },
    "ft:gpt-3.5-turbo": {
      standard: {
        input: 3,
        output: 6,
      },
    },
    "ft:gpt-3.5-turbo-0125": {
      standard: {
        input: 3,
        output: 6,
      },
    },
    "ft:gpt-3.5-turbo-0613": {
      standard: {
        input: 3,
        output: 6,
      },
    },
    "ft:gpt-3.5-turbo-1106": {
      standard: {
        input: 3,
        output: 6,
      },
    },
    "ft:gpt-4-0613": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "ft:gpt-4o-2024-08-06": {
      standard: {
        input: 3.75,
        output: 15,
        cacheRead: 1.875,
      },
    },
    "ft:gpt-4o-2024-11-20": {
      standard: {
        input: 3.75,
        output: 15,
        cacheWrite: 1.875,
      },
    },
    "ft:gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.15,
      },
    },
    "ft:gpt-4.1-2025-04-14": {
      standard: {
        input: 3,
        output: 12,
        cacheRead: 0.75,
      },
    },
    "ft:gpt-4.1-mini-2025-04-14": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
        cacheRead: 0.19999999999999998,
      },
    },
    "ft:gpt-4.1-nano-2025-04-14": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7999999999999999,
        cacheRead: 0.049999999999999996,
      },
    },
    "ft:o4-mini-2025-04-16": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 1,
      },
    },
    "gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini-2.5-flash-image": {
      standard: {
        input: 0.3,
        output: 2.5,
        reasoning: 2.5,
      },
    },
    "gemini-3-pro-image": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-3-pro-image-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-3.1-flash-image": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "gemini-3.1-flash-image-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "gemini-3.1-flash-lite-image": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
      },
    },
    "gemini-3.1-flash-lite-preview": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "deep-research-pro-preview-12-2025": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-2.5-flash-lite": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
        reasoning: 0.39999999999999997,
      },
    },
    "gemini-2.5-flash-lite-preview-09-2025": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
        reasoning: 0.39999999999999997,
      },
    },
    "gemini-2.5-flash-preview-09-2025": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini-live-2.5-flash-native-audio": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini-live-2.5-flash-preview-native-audio-09-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini/gemini-live-2.5-flash-preview-native-audio-09-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-3.1-pro-preview-customtools": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/gemini-3-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "vertex_ai/gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
        cacheRead: 0.15,
        reasoning: 9,
      },
    },
    "vertex_ai/gemini-3.6-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "vertex_ai/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "vertex_ai/gemini-3.8-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "vertex_ai/gemini-3.8-flash-cyber": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
        reasoning: 7.5,
      },
    },
    "vertex_ai/gemini-3.8-live": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "vertex_ai/gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/gemini-3.1-pro-preview-customtools": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-2.5-pro-preview-tts": {
      standard: {
        input: 1,
        output: 20,
        cacheRead: 0.125,
      },
    },
    "gemini-robotics-er-1.5-preview": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0,
        reasoning: 2.5,
      },
    },
    "gemini/gemini-robotics-er-2-preview": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        reasoning: 5,
      },
    },
    "gemini-2.5-computer-use-preview-10-2025": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "gemini-embedding-001": {
      standard: {
        input: 0.15,
        output: 0,
      },
    },
    "gemini-embedding-2-preview": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "gemini-embedding-2": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "vertex_ai/gemini-embedding-2-preview": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "vertex_ai/gemini-embedding-2": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "gemini-flash-experimental": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemini-embedding-001": {
      standard: {
        input: 0.15,
        output: 0,
      },
    },
    "gemini/gemini-embedding-2": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "gemini/gemini-3-pro-image-preview": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/gemini-3.1-flash-image-preview": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "gemini/gemini-3.1-flash-lite-preview": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "gemini/gemini-embedding-2-preview": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "gemini/deep-research-preview-04-2026": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/deep-research-max-preview-04-2026": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini/gemini-2.5-flash-image": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini/gemini-3-pro-image": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/nano-banana-pro-preview": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/gemini-3.1-flash-image": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "gemini/gemini-3.1-flash-lite-image": {
      standard: {
        input: 0.25,
        output: 1.5,
      },
    },
    "gemini/deep-research-pro-preview-12-2025": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/gemini-2.5-flash-lite": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
        reasoning: 0.39999999999999997,
      },
    },
    "gemini/gemini-flash-latest": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini/gemini-flash-lite-latest": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini/gemini-2.5-flash-preview-tts": {
      standard: {
        input: 0.5,
        output: 10,
      },
    },
    "gemini/gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gemini/gemini-2.5-computer-use-preview-10-2025": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "gemini/gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "gemini/gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
        reasoning: 3,
      },
    },
    "gemini/gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
        cacheRead: 0.15,
        reasoning: 9,
      },
    },
    "gemini/gemini-3.6-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini/gemini-3.8-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini/gemini-omni-flash-preview": {
      standard: {
        input: 1.5,
        output: 9,
        reasoning: 9,
      },
    },
    "gemini/gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini/gemini-3.1-pro-preview-customtools": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
        reasoning: 3,
      },
    },
    "gemini-omni-flash-preview": {
      standard: {
        input: 1.5,
        output: 9,
        reasoning: 9,
      },
    },
    "gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
        cacheRead: 0.15,
        reasoning: 9,
      },
    },
    "gemini-3.6-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini-3.8-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini-3.8-flash-cyber": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
        reasoning: 7.5,
      },
    },
    "gemini/gemini-2.5-pro-preview-tts": {
      standard: {
        input: 1,
        output: 20,
        cacheRead: 0.125,
      },
    },
    "gemini/gemini-exp-1114": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemini-exp-1206": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemini-gemma-2-27b-it": {
      standard: {
        input: 0.35,
        output: 1.0499999999999998,
      },
    },
    "gemini/gemini-gemma-2-9b-it": {
      standard: {
        input: 0.35,
        output: 1.0499999999999998,
      },
    },
    "gemini/gemma-3-27b-it": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemma-4-26b-a4b-it": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemma-4-31b-it": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/learnlm-1.5-pro-experimental": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/lyria-3-clip-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/lyria-3-pro-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "github_copilot/claude-haiku-4.5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "github_copilot/claude-sonnet-4": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "github_copilot/gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "github_copilot/gpt-5.3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "github_copilot/mai-code-1-flash": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "github_copilot/mai-code-1-flash-internal": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "gigachat/GigaChat-2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/GigaChat-2-Max": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/GigaChat-2-Pro": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/Embeddings": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/Embeddings-2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/EmbeddingsGigaR": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gigachat/GigaEmbeddings-3B-2025-09": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gmi/anthropic/claude-opus-4.5": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "gmi/anthropic/claude-sonnet-4.5": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "gmi/anthropic/claude-sonnet-4": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "gmi/anthropic/claude-opus-4": {
      standard: {
        input: 15,
        output: 75,
      },
    },
    "gmi/openai/gpt-5.2": {
      standard: {
        input: 1.75,
        output: 14,
      },
    },
    "gmi/openai/gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "gmi/openai/gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "gmi/openai/gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gmi/openai/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "gmi/deepseek-ai/DeepSeek-V3.2": {
      standard: {
        input: 0.28,
        output: 0.39999999999999997,
      },
    },
    "gmi/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 0.28,
        output: 0.88,
      },
    },
    "gmi/google/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "gmi/moonshotai/Kimi-K2-Thinking": {
      standard: {
        input: 0.7999999999999999,
        output: 1.2,
      },
    },
    "gmi/MiniMaxAI/MiniMax-M2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "baseten/MiniMaxAI/MiniMax-M2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "baseten/nvidia/Nemotron-120B-A12B": {
      standard: {
        input: 0.3,
        output: 0.75,
      },
    },
    "baseten/zai-org/GLM-5": {
      standard: {
        input: 0.95,
        output: 3.15,
      },
    },
    "baseten/zai-org/GLM-4.7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.12,
      },
    },
    "baseten/zai-org/GLM-4.6": {
      standard: {
        input: 0.6,
        output: 2.2,
      },
    },
    "baseten/moonshotai/Kimi-K2.5": {
      standard: {
        input: 0.6,
        output: 3,
      },
    },
    "baseten/moonshotai/Kimi-K2-Thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "baseten/moonshotai/Kimi-K2-Instruct-0905": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "baseten/openai/gpt-oss-120b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.09999999999999999,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V3.1": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 0.77,
        output: 0.77,
      },
    },
    "gmi/Qwen/Qwen3-VL-235B-A22B-Instruct-FP8": {
      standard: {
        input: 0.3,
        output: 1.4,
      },
    },
    "gmi/zai-org/GLM-4.7-FP8": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "google.gemma-3-12b-it": {
      standard: {
        input: 0.09,
        output: 0.29,
      },
    },
    "google.gemma-3-27b-it": {
      standard: {
        input: 0.22999999999999998,
        output: 0.38,
      },
    },
    "google.gemma-3-4b-it": {
      standard: {
        input: 0.04,
        output: 0.08,
      },
    },
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "global.anthropic.claude-sonnet-4-20250514-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "global.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "global.amazon.nova-2-lite-v1:0": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.075,
      },
    },
    "gpt-3.5-turbo": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "gpt-3.5-turbo-0125": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "gpt-3.5-turbo-1106": {
      standard: {
        input: 1,
        output: 2,
      },
    },
    "gpt-3.5-turbo-16k": {
      standard: {
        input: 3,
        output: 4,
      },
    },
    "gpt-3.5-turbo-instruct": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "gpt-3.5-turbo-instruct-0914": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "gpt-4": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "gpt-4-0613": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "gpt-4-1106-preview": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "gpt-4-turbo": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "gpt-4-turbo-2024-04-09": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "gpt-4.1-2025-04-14": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "gpt-4.1-mini": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
      },
    },
    "gpt-4.1-mini-2025-04-14": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
      },
    },
    "gpt-4.1-nano": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
      },
    },
    "gpt-4.1-nano-2025-04-14": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
      },
    },
    "gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-4o-2024-05-13": {
      standard: {
        input: 5,
        output: 15,
      },
    },
    "gpt-4o-2024-08-06": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-4o-2024-11-20": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-4o-audio-preview-2024-12-17": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-4o-audio-preview-2025-06-03": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-audio": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-audio-1.5": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-audio-2025-08-28": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-audio-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "gpt-audio-mini-2025-12-15": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "gpt-4o-mini-audio-preview-2024-12-17": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "gpt-4o-mini-realtime-preview-2024-12-17": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.3,
      },
    },
    "gpt-4o-mini-search-preview": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "gpt-4o-mini-transcribe": {
      standard: {
        input: 1.25,
        output: 5,
      },
    },
    "gpt-4o-mini-tts": {
      standard: {
        input: 0.6,
        output: 10,
      },
    },
    "gpt-4o-mini-tts-2025-03-20": {
      standard: {
        input: 0.6,
        output: 10,
      },
    },
    "gpt-4o-search-preview": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-4o-transcribe": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "gpt-image-1.5": {
      standard: {
        input: 5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-image-1.5-2025-12-16": {
      standard: {
        input: 5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.1-codex-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "gpt-5.1-codex-max": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.1-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.1-chat-latest": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.1-2025-11-13": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.2": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5.2-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5.2-chat-latest": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5.2-2025-12-11": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5.2-pro": {
      standard: {
        input: 21,
        output: 168,
      },
    },
    "gpt-5.2-pro-2025-12-11": {
      standard: {
        input: 21,
        output: 168,
      },
    },
    "gpt-6-astra": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "gpt-5.6": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "gpt-5.6-sol": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "gpt-5.6-cyber": {
      standard: {
        input: 12.5,
        output: 75,
        cacheRead: 1.25,
        cacheWrite: 15.625,
      },
    },
    "daybreak-red-latest": {
      standard: {
        input: 12.5,
        output: 75,
        cacheRead: 1.25,
        cacheWrite: 15.625,
      },
    },
    "gpt-daybreak-red-latest": {
      standard: {
        input: 12.5,
        output: 75,
        cacheRead: 1.25,
        cacheWrite: 15.625,
      },
    },
    "daybreak-blue-latest": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "gpt-daybreak-blue-latest": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "gpt-5.5-2026-04-23": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "gpt-5.5-pro": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "gpt-5.5-pro-2026-04-23": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "gpt-5.4-2026-03-05": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "gpt-5.4-pro": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "gpt-5.4-pro-2026-03-05": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "gpt-5.4-mini-2026-03-17": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "gpt-5.4-nano-2026-03-17": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "gpt-5-pro": {
      standard: {
        input: 15,
        output: 120,
      },
    },
    "gpt-5-pro-2025-10-06": {
      standard: {
        input: 15,
        output: 120,
      },
    },
    "gpt-5-2025-08-07": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5-chat": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5-chat-latest": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5.3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5.3-chat-latest": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "gpt-5-mini-2025-08-07": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "gpt-5-nano": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.005,
      },
    },
    "gpt-5-nano-2025-08-07": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.005,
      },
    },
    "gpt-realtime": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "gpt-realtime-1.5": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "gpt-realtime-2": {
      standard: {
        input: 4,
        output: 24,
        cacheRead: 0.39999999999999997,
      },
    },
    "gpt-realtime-2.1": {
      standard: {
        input: 4,
        output: 24,
        cacheRead: 0.39999999999999997,
      },
    },
    "gpt-realtime-2.1-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "gpt-realtime-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "gpt-realtime-2025-08-28": {
      standard: {
        input: 4,
        output: 16,
        cacheRead: 0.39999999999999997,
      },
    },
    "gradient_ai/anthropic-claude-3-opus": {
      standard: {
        input: 15,
        output: 75,
      },
    },
    "gradient_ai/anthropic-claude-3.5-haiku": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
      },
    },
    "gradient_ai/anthropic-claude-3.5-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "gradient_ai/anthropic-claude-3.7-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "gradient_ai/deepseek-r1-distill-llama-70b": {
      standard: {
        input: 0.9900000000000001,
        output: 0.9900000000000001,
      },
    },
    "gradient_ai/llama3-8b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "gradient_ai/llama3.3-70b-instruct": {
      standard: {
        input: 0.65,
        output: 0.65,
      },
    },
    "gradient_ai/mistral-nemo-instruct-2407": {
      standard: {
        input: 0.3,
        output: 0.3,
      },
    },
    "gradient_ai/openai-o3": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "gradient_ai/openai-o3-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
      },
    },
    "lemonade/Qwen3-Coder-30B-A3B-Instruct-GGUF": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "lemonade/gpt-oss-20b-mxfp4-GGUF": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "lemonade/gpt-oss-120b-mxfp-GGUF": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "lemonade/Gemma-3-4b-it-GGUF": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "lemonade/Qwen3-4B-Instruct-2507-GGUF": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "amazon-nova/nova-micro-v1": {
      standard: {
        input: 0.035,
        output: 0.14,
      },
    },
    "amazon-nova/nova-lite-v1": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "amazon-nova/nova-premier-v1": {
      standard: {
        input: 2.5,
        output: 12.5,
      },
    },
    "amazon-nova/nova-pro-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
      },
    },
    "groq/llama-guard-3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "groq/meta-llama/llama-prompt-guard-2-22m": {
      standard: {
        input: 0.03,
        output: 0.03,
      },
    },
    "groq/meta-llama/llama-prompt-guard-2-86m": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "groq/openai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "groq/openai/gpt-oss-20b": {
      standard: {
        input: 0.075,
        output: 0.3,
        cacheRead: 0.0375,
      },
    },
    "groq/openai/gpt-oss-safeguard-20b": {
      standard: {
        input: 0.075,
        output: 0.3,
        cacheRead: 0.037,
      },
    },
    "hyperbolic/NousResearch/Hermes-3-Llama-3.1-70B": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/Qwen/QwQ-32B": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "hyperbolic/Qwen/Qwen2.5-72B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/Qwen/Qwen2.5-Coder-32B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/Qwen/Qwen3-235B-A22B": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "hyperbolic/deepseek-ai/DeepSeek-R1": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "hyperbolic/deepseek-ai/DeepSeek-R1-0528": {
      standard: {
        input: 0.25,
        output: 0.25,
      },
    },
    "hyperbolic/deepseek-ai/DeepSeek-V3": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "hyperbolic/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "hyperbolic/meta-llama/Llama-3.2-3B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/meta-llama/Meta-Llama-3-70B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/meta-llama/Meta-Llama-3.1-405B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/meta-llama/Meta-Llama-3.1-70B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/meta-llama/Meta-Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "hyperbolic/moonshotai/Kimi-K2-Instruct": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "j2-light": {
      standard: {
        input: 3,
        output: 3,
      },
    },
    "j2-mid": {
      standard: {
        input: 10,
        output: 10,
      },
    },
    "j2-ultra": {
      standard: {
        input: 15,
        output: 15,
      },
    },
    "jamba-1.5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "jamba-1.5-large": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "jamba-1.5-large@001": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "jamba-1.5-mini": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "jamba-1.5-mini@001": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "jamba-large-1.6": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "jamba-large-1.7": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "jamba-mini-1.6": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "jamba-mini-1.7": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "jina-reranker-v2-base-multilingual": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "jp.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "jp.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
        cacheWriteOneHour: 2.2,
      },
    },
    "crusoe/deepseek-ai/DeepSeek-R1-0528": {
      standard: {
        input: 3,
        output: 7,
      },
    },
    "crusoe/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 1.5,
        output: 1.5,
      },
    },
    "crusoe/google/gemma-3-12b-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "crusoe/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "crusoe/moonshotai/Kimi-K2-Thinking": {
      standard: {
        input: 2.5,
        output: 2.5,
      },
    },
    "crusoe/openai/gpt-oss-120b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "crusoe/Qwen/Qwen3-235B-A22B-Instruct-2507": {
      standard: {
        input: 3,
        output: 3,
      },
    },
    "inception/mercury-2": {
      standard: {
        input: 0.25,
        output: 0.75,
        cacheRead: 0.024999999999999998,
      },
    },
    "inception/mercury-2.5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.75,
        cacheRead: 0.02,
      },
    },
    "text-completion-inception/mercury-edit-2": {
      standard: {
        input: 0.25,
        output: 0.75,
        cacheRead: 0.024999999999999998,
      },
    },
    "lambda_ai/deepseek-llama3.3-70b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "lambda_ai/deepseek-r1-0528": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "lambda_ai/deepseek-r1-671b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "lambda_ai/deepseek-v3-0324": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "lambda_ai/hermes3-405b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "lambda_ai/hermes3-70b": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "lambda_ai/hermes3-8b": {
      standard: {
        input: 0.024999999999999998,
        output: 0.04,
      },
    },
    "lambda_ai/lfm-40b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "lambda_ai/lfm-7b": {
      standard: {
        input: 0.024999999999999998,
        output: 0.04,
      },
    },
    "lambda_ai/llama-4-maverick-17b-128e-instruct-fp8": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "lambda_ai/llama-4-scout-17b-16e-instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "lambda_ai/llama3.1-405b-instruct-fp8": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "lambda_ai/llama3.1-70b-instruct-fp8": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "lambda_ai/llama3.1-8b-instruct": {
      standard: {
        input: 0.024999999999999998,
        output: 0.04,
      },
    },
    "lambda_ai/llama3.1-nemotron-70b-instruct-fp8": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "lambda_ai/llama3.2-11b-vision-instruct": {
      standard: {
        input: 0.015,
        output: 0.024999999999999998,
      },
    },
    "lambda_ai/llama3.2-3b-instruct": {
      standard: {
        input: 0.015,
        output: 0.024999999999999998,
      },
    },
    "lambda_ai/llama3.3-70b-instruct-fp8": {
      standard: {
        input: 0.12,
        output: 0.3,
      },
    },
    "lambda_ai/qwen25-coder-32b-instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "lambda_ai/qwen3-32b-fp8": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "meta.llama2-13b-chat-v1": {
      standard: {
        input: 0.75,
        output: 1,
      },
    },
    "meta.llama2-70b-chat-v1": {
      standard: {
        input: 1.95,
        output: 2.56,
      },
    },
    "meta.llama3-1-405b-instruct-v1:0": {
      standard: {
        input: 2.4,
        output: 2.4,
      },
    },
    "meta.llama3-1-70b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "meta.llama3-1-8b-instruct-v1:0": {
      standard: {
        input: 0.22,
        output: 0.22,
      },
    },
    "meta.llama3-2-11b-instruct-v1:0": {
      standard: {
        input: 0.16,
        output: 0.16,
      },
    },
    "meta.llama3-2-1b-instruct-v1:0": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "meta.llama3-2-3b-instruct-v1:0": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "meta.llama3-2-90b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "meta.llama3-3-70b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "meta.llama3-70b-instruct-v1:0": {
      standard: {
        input: 2.65,
        output: 3.5,
      },
    },
    "meta.llama3-8b-instruct-v1:0": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "meta.llama4-maverick-17b-instruct-v1:0": {
      standard: {
        input: 0.24,
        output: 0.9700000000000001,
      },
    },
    "meta.llama4-scout-17b-instruct-v1:0": {
      standard: {
        input: 0.16999999999999998,
        output: 0.66,
      },
    },
    "meta/muse-spark-1.1": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "meta/muse-spark-1.2": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "meta/muse-spark-1.2-contributor": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
        cacheRead: 0.002,
      },
    },
    "meta/muse-spark-1.3": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "meta/muse-spark-1.3-contributor": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
        cacheRead: 0.002,
      },
    },
    "minimax.minimax-m2": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "minimax.minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "minimax.minimax-m2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "minimax/MiniMax-M2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
        cacheWrite: 0.375,
      },
    },
    "minimax/MiniMax-M2.1-lightning": {
      standard: {
        input: 0.3,
        output: 2.4,
        cacheRead: 0.03,
        cacheWrite: 0.375,
      },
    },
    "minimax/MiniMax-M2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
        cacheWrite: 0.375,
      },
    },
    "minimax/MiniMax-M2.5-lightning": {
      standard: {
        input: 0.3,
        output: 2.4,
        cacheRead: 0.03,
        cacheWrite: 0.375,
      },
    },
    "minimax/MiniMax-M2": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
        cacheWrite: 0.375,
      },
    },
    "minimax/MiniMax-M3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "mistral.devstral-2-123b": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "mistral.magistral-small-2509": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "mistral.ministral-3-14b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "mistral.ministral-3-3b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "mistral.ministral-3-8b-instruct": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "mistral.mistral-7b-instruct-v0:2": {
      standard: {
        input: 0.15,
        output: 0.19999999999999998,
      },
    },
    "mistral.mistral-large-2402-v1:0": {
      standard: {
        input: 4,
        output: 12,
      },
    },
    "mistral.mistral-large-2407-v1:0": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "mistral.mistral-large-3-675b-instruct": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "mistral.mistral-small-2402-v1:0": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "mistral.mixtral-8x7b-instruct-v0:1": {
      standard: {
        input: 0.44999999999999996,
        output: 0.7,
      },
    },
    "mistral.voxtral-mini-3b-2507": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "mistral.voxtral-small-24b-2507": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "mistral/codestral-2508": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.03,
      },
    },
    "mistral/codestral-latest": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.03,
      },
    },
    "mistral/codestral-mamba-latest": {
      standard: {
        input: 0.25,
        output: 0.25,
        cacheRead: 0.024999999999999998,
      },
    },
    "mistral/devstral-small-latest": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
        cacheRead: 0.01,
      },
    },
    "mistral/devstral-latest": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "mistral/devstral-medium-latest": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "mistral/ministral-14b-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
        cacheRead: 0.02,
      },
    },
    "mistral/ministral-14b-latest": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
        cacheRead: 0.02,
      },
    },
    "mistral/ministral-3b-2512": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
        cacheRead: 0.01,
      },
    },
    "mistral/ministral-3b-latest": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
        cacheRead: 0.01,
      },
    },
    "mistral/mistral-medium-3": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/voxtral-small-2507": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
      },
    },
    "mistral/voxtral-small-latest": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
      },
    },
    "mistral/zai-glm-5-2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "mistral/zai-glm-5-3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "mistral/zai-glm-5": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "mistral/zai-glm-latest": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "mistral/glm-5-2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "mistral/magistral-medium-latest": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/magistral-small-latest": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "mistral/mistral-large-latest": {
      standard: {
        input: 0.5,
        output: 1.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "mistral/mistral-large-3": {
      standard: {
        input: 0.5,
        output: 1.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "mistral/mistral-large-2512": {
      standard: {
        input: 0.5,
        output: 1.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "mistral/mistral-medium": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-medium-2604": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-medium-latest": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-medium-3-5": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-small": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
        cacheRead: 0.01,
      },
    },
    "mistral/mistral-small-latest": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "mistral/ministral-3-3b-2512": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
        cacheRead: 0.01,
      },
    },
    "mistral/ministral-3-8b-2512": {
      standard: {
        input: 0.15,
        output: 0.15,
        cacheRead: 0.015,
      },
    },
    "mistral/ministral-3-14b-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
        cacheRead: 0.02,
      },
    },
    "mistral/ministral-8b-2512": {
      standard: {
        input: 0.15,
        output: 0.15,
        cacheRead: 0.015,
      },
    },
    "mistral/ministral-8b-latest": {
      standard: {
        input: 0.15,
        output: 0.15,
        cacheRead: 0.015,
      },
    },
    "mistral/mistral-tiny": {
      standard: {
        input: 0.25,
        output: 0.25,
        cacheRead: 0.024999999999999998,
      },
    },
    "mistral/open-mistral-nemo": {
      standard: {
        input: 0.3,
        output: 0.3,
        cacheRead: 0.03,
      },
    },
    "mistral/pixtral-large-latest": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "moonshot.kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "moonshotai.kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
      },
    },
    "moonshot/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "moonshot/kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "moonshot/kimi-k2.6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "moonshot/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "moonshot/moonshot-v1-128k": {
      standard: {
        input: 2,
        output: 5,
      },
    },
    "moonshot/moonshot-v1-128k-vision-preview": {
      standard: {
        input: 2,
        output: 5,
      },
    },
    "moonshot/moonshot-v1-32k": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "moonshot/moonshot-v1-32k-vision-preview": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "moonshot/moonshot-v1-8k": {
      standard: {
        input: 0.19999999999999998,
        output: 2,
      },
    },
    "moonshot/moonshot-v1-8k-vision-preview": {
      standard: {
        input: 0.19999999999999998,
        output: 2,
      },
    },
    "moonshot/moonshot-v1-auto": {
      standard: {
        input: 2,
        output: 5,
      },
    },
    "morph/morph-v3-fast": {
      standard: {
        input: 0.7999999999999999,
        output: 1.2,
      },
    },
    "morph/morph-v3-large": {
      standard: {
        input: 0.8999999999999999,
        output: 1.9,
      },
    },
    multimodalembedding: {
      standard: {
        input: 0.7999999999999999,
        output: 0,
      },
    },
    "multimodalembedding@001": {
      standard: {
        input: 0.7999999999999999,
        output: 0,
      },
    },
    "nscale/Qwen/QwQ-32B": {
      standard: {
        input: 0.18,
        output: 0.19999999999999998,
      },
    },
    "nscale/Qwen/Qwen2.5-Coder-32B-Instruct": {
      standard: {
        input: 0.06,
        output: 0.19999999999999998,
      },
    },
    "nscale/Qwen/Qwen2.5-Coder-3B-Instruct": {
      standard: {
        input: 0.01,
        output: 0.03,
      },
    },
    "nscale/Qwen/Qwen2.5-Coder-7B-Instruct": {
      standard: {
        input: 0.01,
        output: 0.03,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
      standard: {
        input: 0.375,
        output: 0.375,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Llama-8B": {
      standard: {
        input: 0.024999999999999998,
        output: 0.024999999999999998,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
      standard: {
        input: 0.09,
        output: 0.09,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B": {
      standard: {
        input: 0.07,
        output: 0.07,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "nscale/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "nscale/meta-llama/Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.03,
        output: 0.03,
      },
    },
    "nscale/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "nscale/meta-llama/Llama-4-Scout-17B-16E-Instruct": {
      standard: {
        input: 0.09,
        output: 0.29,
      },
    },
    "nscale/mistralai/mixtral-8x22b-instruct-v0.1": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "nebius/deepseek-ai/DeepSeek-R1": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "nebius/deepseek-ai/DeepSeek-R1-0528": {
      standard: {
        input: 0.7999999999999999,
        output: 2.4,
      },
    },
    "nebius/deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
      standard: {
        input: 0.25,
        output: 0.75,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V3": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V3-0324": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "nebius/google/gemma-3-27b-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "nebius/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "nebius/meta-llama/Llama-Guard-3-8B": {
      standard: {
        input: 0.02,
        output: 0.06,
      },
    },
    "nebius/meta-llama/Meta-Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.02,
        output: 0.06,
      },
    },
    "nebius/meta-llama/Meta-Llama-3.1-70B-Instruct": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "nebius/meta-llama/Meta-Llama-3.1-405B-Instruct": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "nebius/mistralai/Mistral-Nemo-Instruct-2407": {
      standard: {
        input: 0.04,
        output: 0.12,
      },
    },
    "nebius/NousResearch/Hermes-3-Llama-3.1-405B": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "nebius/nvidia/Llama-3.1-Nemotron-Ultra-253B-v1": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
      },
    },
    "nebius/nvidia/Llama-3.3-Nemotron-Super-49B-v1": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
      },
    },
    "nebius/Qwen/Qwen3-235B-A22B": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "nebius/Qwen/Qwen3-32B": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "nebius/Qwen/Qwen3-30B-A3B": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "nebius/Qwen/Qwen3-14B": {
      standard: {
        input: 0.08,
        output: 0.24,
      },
    },
    "nebius/Qwen/Qwen3-4B": {
      standard: {
        input: 0.08,
        output: 0.24,
      },
    },
    "nebius/Qwen/QwQ-32B": {
      standard: {
        input: 0.15,
        output: 0.44999999999999996,
      },
    },
    "nebius/Qwen/Qwen2.5-72B-Instruct": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "nebius/Qwen/Qwen2.5-32B-Instruct": {
      standard: {
        input: 0.06,
        output: 0.19999999999999998,
      },
    },
    "nebius/Qwen/Qwen2.5-Coder-7B": {
      standard: {
        input: 0.01,
        output: 0.03,
      },
    },
    "nebius/Qwen/Qwen2.5-VL-72B-Instruct": {
      standard: {
        input: 0.25,
        output: 0.75,
      },
    },
    "nebius/Qwen/Qwen2-VL-72B-Instruct": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "nebius/Qwen/Qwen2-VL-7B-Instruct": {
      standard: {
        input: 0.02,
        output: 0.06,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V4-Flash": {
      standard: {
        input: 0.14,
        output: 0.28,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.14,
        output: 0.28,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V4-Pro": {
      standard: {
        input: 1.75,
        output: 3.5,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
      },
    },
    "nebius/deepseek-ai/DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "nebius/MiniMaxAI/MiniMax-M2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "nebius/MiniMaxAI/MiniMax-M3": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "nebius/moonshotai/Kimi-K2.6": {
      standard: {
        input: 0.95,
        output: 4,
      },
    },
    "nebius/moonshotai/Kimi-K2.7-Code": {
      standard: {
        input: 0.95,
        output: 4,
      },
    },
    "nebius/moonshotai/Kimi-K3": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "nebius/NousResearch/Hermes-4-405B": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "nebius/NousResearch/Hermes-4-70B": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "nebius/nvidia/Cosmos3-Super-Reasoner": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "nebius/nvidia/Llama-3_1-Nemotron-Ultra-253B-v1": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
      },
    },
    "nebius/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "nebius/nvidia/Nemotron-3-Nano-Omni": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "nebius/nvidia/nemotron-3-super-120b-a12b": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "nebius/nvidia/Nemotron-3-Ultra-550b-a55b": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "nebius/nvidia/Nemotron-3_5-Lightning": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "nebius/openai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "nebius/openbmb/MiniCPM-V-4_5": {
      standard: {
        input: 0.658,
        output: 1.1099999999999999,
      },
    },
    "nebius/Qwen/Qwen3-235B-A22B-Instruct-2507": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "nebius/Qwen/Qwen3-30B-A3B-Instruct-2507": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "nebius/Qwen/Qwen3-Next-80B-A3B-Thinking": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "nebius/Qwen/Qwen3.5-397B-A17B": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
      },
    },
    "nebius/Qwen/Qwen3.8-27B": {
      standard: {
        input: 0.44999999999999996,
        output: 3,
      },
    },
    "nebius/zai-org/GLM-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
      },
    },
    "nebius/zai-org/GLM-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
      },
    },
    "nebius/zai-org/GLM-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
      },
    },
    "nebius/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.15,
        output: 0.5,
      },
    },
    "nebius/BAAI/bge-en-icl": {
      standard: {
        input: 0.01,
        output: 0,
      },
    },
    "nebius/BAAI/bge-multilingual-gemma2": {
      standard: {
        input: 0.01,
        output: 0,
      },
    },
    "nebius/intfloat/e5-mistral-7b-instruct": {
      standard: {
        input: 0.01,
        output: 0,
      },
    },
    "nebius/Qwen/Qwen3-Embedding-8B": {
      standard: {
        input: 0.01,
        output: 0,
      },
    },
    "nvidia.nemotron-nano-12b-v2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "nvidia.nemotron-nano-9b-v2": {
      standard: {
        input: 0.06,
        output: 0.22999999999999998,
      },
    },
    "nvidia.nemotron-nano-3-30b": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "nvidia.nemotron-super-3-120b": {
      standard: {
        input: 0.15,
        output: 0.65,
      },
    },
    o1: {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
      },
    },
    "o1-2024-12-17": {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
      },
    },
    "o1-pro": {
      standard: {
        input: 150,
        output: 600,
      },
    },
    "o1-pro-2025-03-19": {
      standard: {
        input: 150,
        output: 600,
      },
    },
    o3: {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "o3-deep-research": {
      standard: {
        input: 10,
        output: 40,
        cacheRead: 2.5,
      },
    },
    "o3-2025-04-16": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "o3-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "o3-mini-2025-01-31": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "o3-pro": {
      standard: {
        input: 20,
        output: 80,
      },
    },
    "o3-pro-2025-06-10": {
      standard: {
        input: 20,
        output: 80,
      },
    },
    "o4-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "o4-mini-deep-research": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "o4-mini-2025-04-16": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "oci/meta.llama-3.1-8b-instruct": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/meta.llama-3.1-70b-instruct": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/meta.llama-3.1-405b-instruct": {
      standard: {
        input: 10.68,
        output: 10.68,
      },
    },
    "oci/meta.llama-3.2-90b-vision-instruct": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "oci/meta.llama-3.3-70b-instruct": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/meta.llama-4-maverick-17b-128e-instruct-fp8": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/meta.llama-4-scout-17b-16e-instruct": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/xai.grok-3": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "oci/xai.grok-3-fast": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "oci/xai.grok-3-mini": {
      standard: {
        input: 0.3,
        output: 0.5,
      },
    },
    "oci/xai.grok-3-mini-fast": {
      standard: {
        input: 0.6,
        output: 4,
      },
    },
    "oci/xai.grok-4": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "oci/cohere.command-latest": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-a-03-2025": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-plus-latest": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/google.gemini-2.5-flash": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "oci/google.gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "oci/google.gemini-2.5-flash-lite": {
      standard: {
        input: 0.075,
        output: 0.3,
      },
    },
    "oci/cohere.command-a-vision": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-a-reasoning": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-a-reasoning-08-2025": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-a-vision-07-2025": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/cohere.command-a-translate-08-2025": {
      standard: {
        input: 0.09,
        output: 0.09,
      },
    },
    "oci/cohere.command-r-08-2024": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "oci/cohere.command-r-plus-08-2024": {
      standard: {
        input: 1.56,
        output: 1.56,
      },
    },
    "oci/meta.llama-3.2-11b-vision-instruct": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "oci/meta.llama-3.3-70b-instruct-fp8-dynamic": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "oci/xai.grok-4-fast": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "oci/xai.grok-4.1-fast": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "oci/xai.grok-4.20": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "oci/xai.grok-4.20-multi-agent": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "oci/xai.grok-code-fast-1": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "oci/openai.gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "oci/openai.gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
      },
    },
    "oci/openai.gpt-5-nano": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
      },
    },
    "oci/cohere.embed-english-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-english-light-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-multilingual-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-multilingual-light-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-english-image-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-english-light-image-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-multilingual-light-image-v3.0": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "oci/cohere.embed-v4.0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "ollama/codegeex4": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/codegemma": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/codellama": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/deepseek-coder-v2-base": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/deepseek-coder-v2-instruct": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/deepseek-coder-v2-lite-base": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/deepseek-coder-v2-lite-instruct": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/deepseek-v3.1:671b-cloud": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/gpt-oss:120b-cloud": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/gpt-oss:20b-cloud": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/internlm2_5-20b-chat": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama2-uncensored": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama2:13b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama2:70b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama2:7b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama3": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama3.1": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama3:70b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/llama3:8b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mistral": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mistral-7B-Instruct-v0.1": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mistral-7B-Instruct-v0.2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mistral-large-instruct-2407": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mixtral-8x22B-Instruct-v0.1": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/mixtral-8x7B-Instruct-v0.1": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/orca-mini": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/qwen3-coder:480b-cloud": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ollama/vicuna": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "omni-moderation-2024-09-26": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "omni-moderation-latest": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openai.gpt-oss-120b-1:0": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "openai.gpt-oss-20b-1:0": {
      standard: {
        input: 0.07,
        output: 0.3,
      },
    },
    "openai.gpt-oss-safeguard-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "openai.gpt-oss-safeguard-20b": {
      standard: {
        input: 0.07,
        output: 0.19999999999999998,
      },
    },
    "openrouter/anthropic/claude-3-haiku": {
      standard: {
        input: 0.25,
        output: 1.25,
        cacheRead: 0.03,
        cacheWrite: 0.3,
        cacheWriteOneHour: 0.5,
      },
    },
    "openrouter/anthropic/claude-3.5-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "openrouter/anthropic/claude-3.7-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "openrouter/anthropic/claude-opus-4.1": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
        cacheWriteOneHour: 30,
      },
    },
    "openrouter/anthropic/claude-sonnet-4": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "openrouter/anthropic/claude-sonnet-4.6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "openrouter/anthropic/claude-opus-4.5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-opus-4.6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-sonnet-4.5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "openrouter/anthropic/claude-haiku-4.5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "openrouter/anthropic/claude-opus-4.7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-opus-5.5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "openrouter/bytedance/ui-tars-1.5-7b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/deepseek/deepseek-chat": {
      standard: {
        input: 0.2574,
        output: 1.0287,
      },
    },
    "openrouter/deepseek/deepseek-chat-v3-0324": {
      standard: {
        input: 0.25,
        output: 1,
      },
    },
    "openrouter/deepseek/deepseek-chat-v3.1": {
      standard: {
        input: 0.25,
        output: 0.95,
        cacheRead: 0.13,
      },
    },
    "openrouter/deepseek/deepseek-v3.2": {
      standard: {
        input: 0.28,
        output: 0.42,
        cacheRead: 0.028,
      },
    },
    "openrouter/deepseek/deepseek-v3.2-exp": {
      standard: {
        input: 0.27,
        output: 0.41,
        cacheRead: 0.02,
      },
    },
    "openrouter/deepseek/deepseek-r1": {
      standard: {
        input: 0.7,
        output: 2.5,
        cacheRead: 0.14,
      },
    },
    "openrouter/deepseek/deepseek-r1-0528": {
      standard: {
        input: 0.5,
        output: 2.1500000000000004,
        cacheRead: 0.35,
      },
    },
    "openrouter/deepseek/deepseek-v4-pro": {
      standard: {
        input: 0.20879999999999999,
        output: 0.41759999999999997,
        cacheRead: 0.0174,
      },
    },
    "openrouter/deepseek/deepseek-v4.1-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "openrouter/deepseek/deepseek-v4-pro-0813": {
      standard: {
        input: 0.22,
        output: 4.199999999999999,
        cacheRead: 0.14,
      },
    },
    "openrouter/fireworks/ember-1": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "openrouter/google/gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        cacheWrite: 0.0833333333333333,
      },
    },
    "openrouter/google/gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
        cacheWrite: 0.375,
      },
    },
    "openrouter/google/gemini-3-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/google/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
        cacheWrite: 0.0833333333333333,
        reasoning: 3,
      },
    },
    "openrouter/google/gemini-3.1-flash-lite-preview": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        cacheWrite: 0.0833333333333333,
        reasoning: 1.5,
      },
    },
    "openrouter/google/gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        cacheWrite: 0.0833333333333333,
        reasoning: 1.5,
      },
    },
    "openrouter/google/gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/gryphe/mythomax-l2-13b": {
      standard: {
        input: 0.08,
        output: 0.11,
      },
    },
    "openrouter/mancer/weaver": {
      standard: {
        input: 0.39999999999999997,
        output: 0.75,
      },
    },
    "openrouter/meta-llama/llama-3-70b-instruct": {
      standard: {
        input: 0.59,
        output: 0.7899999999999999,
      },
    },
    "openrouter/minimax/minimax-m2": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "openrouter/mistralai/devstral-2512": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "openrouter/mistralai/ministral-3b-2512": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
        cacheRead: 0.01,
      },
    },
    "openrouter/mistralai/ministral-8b-2512": {
      standard: {
        input: 0.15,
        output: 0.15,
        cacheRead: 0.015,
      },
    },
    "openrouter/mistralai/ministral-14b-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
        cacheRead: 0.02,
      },
    },
    "openrouter/mistralai/mistral-7b-instruct": {
      standard: {
        input: 0.13,
        output: 0.13,
      },
    },
    "openrouter/mistralai/mistral-large": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/mistralai/mistral-small-3.1-24b-instruct": {
      standard: {
        input: 0.351,
        output: 0.5549999999999999,
      },
    },
    "openrouter/mistralai/mistral-small-3.2-24b-instruct": {
      standard: {
        input: 0.09375,
        output: 0.25,
      },
    },
    "openrouter/mistralai/mixtral-8x22b-instruct": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/moonshotai/kimi-k2.5": {
      standard: {
        input: 0.44999999999999996,
        output: 2.25,
        cacheRead: 0.07,
      },
    },
    "openrouter/nvidia/nemotron-3.5-lightning": {
      standard: {
        input: 0.0595,
        output: 0.16999999999999998,
        cacheRead: 0.02975,
      },
    },
    "openrouter/openai/gpt-3.5-turbo": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "openrouter/openai/gpt-3.5-turbo-16k": {
      standard: {
        input: 3,
        output: 4,
      },
    },
    "openrouter/openai/gpt-4": {
      standard: {
        input: 30,
        output: 60,
      },
    },
    "openrouter/openai/gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "openrouter/openai/gpt-4.1-mini": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/openai/gpt-4.1-nano": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/openai/gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "openrouter/openai/gpt-4o-2024-05-13": {
      standard: {
        input: 5,
        output: 15,
      },
    },
    "openrouter/openai/gpt-5-chat": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5.2-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "openrouter/openai/gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/openai/gpt-5-nano": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.005,
      },
    },
    "openrouter/openai/gpt-5.1-codex-max": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5.2": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "openrouter/openai/gpt-5.2-chat": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "openrouter/openai/gpt-5.2-pro": {
      standard: {
        input: 21,
        output: 168,
      },
    },
    "openrouter/openai/gpt-5.6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/gpt-5.6-sol-pro": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "openrouter/openai/gpt-oss-120b": {
      standard: {
        input: 0.037,
        output: 0.16999999999999998,
      },
    },
    "openrouter/openai/gpt-oss-120b:batch": {
      standard: {
        input: 0.0296,
        output: 0.136,
      },
    },
    "openrouter/openai/gpt-oss-20b": {
      standard: {
        input: 0.018,
        output: 0.09,
        cacheRead: 0.009,
      },
    },
    "openrouter/openai/o1": {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
      },
    },
    "openrouter/openai/o3-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "openrouter/openai/o3-mini-high": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
      },
    },
    "openrouter/qwen/qwen-2.5-coder-32b-instruct": {
      standard: {
        input: 0.66,
        output: 1,
      },
    },
    "openrouter/qwen/qwen-vl-plus": {
      standard: {
        input: 0.21,
        output: 0.63,
      },
    },
    "openrouter/qwen/qwen3-coder": {
      standard: {
        input: 0.3,
        output: 1,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/qwen/qwen3-coder-plus": {
      standard: {
        input: 0.65,
        output: 3.25,
        cacheRead: 0.13,
        cacheWrite: 0.8125,
      },
    },
    "openrouter/qwen/qwen3-235b-a22b-2507": {
      standard: {
        input: 0.0875,
        output: 0.35,
        cacheRead: 0.0175,
      },
    },
    "openrouter/qwen/qwen3-235b-a22b-thinking-2507": {
      standard: {
        input: 0.22999999999999998,
        output: 2.3,
      },
    },
    "openrouter/qwen/qwen3.6-plus": {
      standard: {
        input: 0.325,
        output: 1.95,
        cacheWrite: 0.40625,
      },
    },
    "openrouter/qwen/qwen3.5-35b-a3b": {
      standard: {
        input: 0.15,
        output: 1,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/qwen/qwen3.5-27b": {
      standard: {
        input: 0.195,
        output: 1.56,
      },
    },
    "openrouter/qwen/qwen3.5-122b-a10b": {
      standard: {
        input: 0.26,
        output: 2.08,
      },
    },
    "openrouter/qwen/qwen3.5-flash-02-23": {
      standard: {
        input: 0.065,
        output: 0.26,
      },
    },
    "openrouter/qwen/qwen3.5-plus-02-15": {
      standard: {
        input: 0.26,
        output: 1.56,
      },
    },
    "openrouter/qwen/qwen3.5-397b-a17b": {
      standard: {
        input: 0.55,
        output: 3.5,
        cacheRead: 0.22499999999999998,
      },
    },
    "openrouter/switchpoint/router": {
      standard: {
        input: 0.85,
        output: 3.4,
      },
    },
    "openrouter/undi95/remm-slerp-l2-13b": {
      standard: {
        input: 0.35,
        output: 0.65,
      },
    },
    "openrouter/x-ai/grok-4": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "openrouter/z-ai/glm-4.6": {
      standard: {
        input: 0.43,
        output: 1.75,
        cacheRead: 0.08,
      },
    },
    "openrouter/z-ai/glm-4.6:exacto": {
      standard: {
        input: 0.44999999999999996,
        output: 1.9,
      },
    },
    "openrouter/xiaomi/mimo-v2-flash": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
        cacheRead: 0.01,
        cacheWrite: 0,
      },
    },
    "openrouter/xiaomi/mimo-v2.5-pro": {
      standard: {
        input: 0.435,
        output: 0.87,
        cacheRead: 0.0036,
        cacheWrite: 0,
      },
    },
    "openrouter/xiaomi/mimo-v2.5": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.0028,
        cacheWrite: 0,
      },
    },
    "openrouter/z-ai/glm-4.7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
        cacheWrite: 0,
      },
    },
    "openrouter/z-ai/glm-4.7-flash": {
      standard: {
        input: 0.060500000000000005,
        output: 0.39999999999999997,
        cacheRead: 0.01,
        cacheWrite: 0,
      },
    },
    "openrouter/z-ai/glm-5": {
      standard: {
        input: 0.6,
        output: 1.92,
        cacheRead: 0.12,
      },
    },
    "openrouter/z-ai/glm-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
        cacheWrite: 0,
      },
    },
    "openrouter/minimax/minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
        cacheWrite: 0,
      },
    },
    "openrouter/minimax/minimax-m2.5": {
      standard: {
        input: 0.27,
        output: 1.08,
        cacheRead: 0.027,
      },
    },
    "openrouter/openrouter/auto": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/openrouter/free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/openrouter/bodybuilder": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "ovhcloud/DeepSeek-R1-Distill-Llama-70B": {
      standard: {
        input: 0.67,
        output: 0.67,
      },
    },
    "ovhcloud/Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "ovhcloud/Meta-Llama-3_1-70B-Instruct": {
      standard: {
        input: 0.67,
        output: 0.67,
      },
    },
    "ovhcloud/Meta-Llama-3_3-70B-Instruct": {
      standard: {
        input: 0.67,
        output: 0.67,
      },
    },
    "ovhcloud/Mistral-7B-Instruct-v0.3": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "ovhcloud/Mistral-Nemo-Instruct-2407": {
      standard: {
        input: 0.13,
        output: 0.13,
      },
    },
    "ovhcloud/Mistral-Small-3.2-24B-Instruct-2506": {
      standard: {
        input: 0.09,
        output: 0.28,
      },
    },
    "ovhcloud/Mixtral-8x7B-Instruct-v0.1": {
      standard: {
        input: 0.63,
        output: 0.63,
      },
    },
    "ovhcloud/Qwen2.5-Coder-32B-Instruct": {
      standard: {
        input: 0.87,
        output: 0.87,
      },
    },
    "ovhcloud/Qwen2.5-VL-72B-Instruct": {
      standard: {
        input: 0.9099999999999999,
        output: 0.9099999999999999,
      },
    },
    "ovhcloud/Qwen3-32B": {
      standard: {
        input: 0.08,
        output: 0.22999999999999998,
      },
    },
    "ovhcloud/gpt-oss-120b": {
      standard: {
        input: 0.08,
        output: 0.39999999999999997,
      },
    },
    "ovhcloud/gpt-oss-20b": {
      standard: {
        input: 0.04,
        output: 0.15,
      },
    },
    "ovhcloud/llava-v1.6-mistral-7b-hf": {
      standard: {
        input: 0.29,
        output: 0.29,
      },
    },
    "ovhcloud/mamba-codestral-7B-v0.1": {
      standard: {
        input: 0.19,
        output: 0.19,
      },
    },
    "palm/chat-bison": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "palm/chat-bison-001": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "palm/text-bison": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "palm/text-bison-001": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "palm/text-bison-safety-off": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "palm/text-bison-safety-recitation-off": {
      standard: {
        input: 0.125,
        output: 0.125,
      },
    },
    "perplexity/codellama-34b-instruct": {
      standard: {
        input: 0.35,
        output: 1.4,
      },
    },
    "perplexity/codellama-70b-instruct": {
      standard: {
        input: 0.7,
        output: 2.8,
      },
    },
    "perplexity/llama-2-70b-chat": {
      standard: {
        input: 0.7,
        output: 2.8,
      },
    },
    "perplexity/llama-3.1-70b-instruct": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "perplexity/llama-3.1-8b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "perplexity/mistral-7b-instruct": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "perplexity/mixtral-8x7b-instruct": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "perplexity/pplx-70b-chat": {
      standard: {
        input: 0.7,
        output: 2.8,
      },
    },
    "perplexity/pplx-70b-online": {
      standard: {
        input: 0,
        output: 2.8,
      },
    },
    "perplexity/pplx-7b-chat": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "perplexity/pplx-7b-online": {
      standard: {
        input: 0,
        output: 0.28,
      },
    },
    "perplexity/pplx-decider-v1-27b": {
      standard: {
        input: 0.04,
        output: 0,
      },
    },
    "perplexity/sonar": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "perplexity/sonar-deep-research": {
      standard: {
        input: 2,
        output: 8,
        reasoning: 3,
      },
    },
    "perplexity/sonar-medium-chat": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
      },
    },
    "perplexity/sonar-medium-online": {
      standard: {
        input: 0,
        output: 1.7999999999999998,
      },
    },
    "perplexity/sonar-pro": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "perplexity/sonar-reasoning": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "perplexity/sonar-reasoning-pro": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "perplexity/sonar-small-chat": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "perplexity/sonar-small-online": {
      standard: {
        input: 0,
        output: 0.28,
      },
    },
    "publicai/swiss-ai/apertus-8b-instruct": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/swiss-ai/apertus-70b-instruct": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/aisingapore/Gemma-SEA-LION-v4-27B-IT": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/BSC-LT/salamandra-7b-instruct-tools-16k": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/BSC-LT/ALIA-40b-instruct_Q8_0": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/allenai/Olmo-3-7B-Instruct": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "perplexity/openai/gpt-5.2": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "perplexity/openai/gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "perplexity/openai/gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.024999999999999998,
      },
    },
    "perplexity/anthropic/claude-opus-4-6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "perplexity/anthropic/claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "perplexity/anthropic/claude-opus-4-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "perplexity/anthropic/claude-sonnet-4-5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "perplexity/anthropic/claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
      },
    },
    "perplexity/google/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "perplexity/perplexity/sonar": {
      standard: {
        input: 0.25,
        output: 2.5,
        cacheRead: 0.0625,
      },
    },
    "perplexity/perplexity/deepseek-v4-flash-0731": {
      standard: {
        input: 0.13,
        output: 0.26,
        cacheRead: 0.028,
      },
    },
    "perplexity/perplexity/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "perplexity/perplexity/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "perplexity/perplexity/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "perplexity/pplx-embed-v1-0.6b": {
      standard: {
        input: 0.004,
        output: 0,
      },
    },
    "perplexity/pplx-embed-v1-4b": {
      standard: {
        input: 0.03,
        output: 0,
      },
    },
    "publicai/aisingapore/Qwen-SEA-LION-v4-32B-IT": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/allenai/Olmo-3-7B-Think": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "publicai/allenai/Olmo-3-32B-Think": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "qwen.qwen3-coder-480b-a35b-v1:0": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
      },
    },
    "qwen.qwen3-235b-a22b-2507-v1:0": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "qwen.qwen3-coder-30b-a3b-v1:0": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "qwen.qwen3-32b-v1:0": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "bedrock/ap-northeast-1/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.18,
        output: 1.4500000000000002,
      },
    },
    "bedrock/ap-south-1/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.18,
        output: 1.4100000000000001,
      },
    },
    "bedrock/ap-southeast-2/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.1545,
        output: 1.236,
      },
    },
    "bedrock/eu-west-1/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.18,
        output: 1.4100000000000001,
      },
    },
    "bedrock/eu-west-2/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.22999999999999998,
        output: 1.8599999999999999,
      },
    },
    "bedrock/sa-east-1/qwen.qwen3-next-80b-a3b": {
      standard: {
        input: 0.18,
        output: 1.4500000000000002,
      },
    },
    "qwen.qwen3-vl-235b-a22b": {
      standard: {
        input: 0.53,
        output: 2.66,
      },
    },
    "qwen.qwen3-coder-next": {
      standard: {
        input: 0.5,
        output: 1.2,
      },
    },
    "replicate/meta/llama-2-13b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
      },
    },
    "replicate/meta/llama-2-13b-chat": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
      },
    },
    "replicate/meta/llama-2-70b": {
      standard: {
        input: 0.65,
        output: 2.75,
      },
    },
    "replicate/meta/llama-2-70b-chat": {
      standard: {
        input: 0.65,
        output: 2.75,
      },
    },
    "replicate/meta/llama-2-7b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/meta/llama-2-7b-chat": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/meta/llama-3-70b": {
      standard: {
        input: 0.65,
        output: 2.75,
      },
    },
    "replicate/meta/llama-3-70b-instruct": {
      standard: {
        input: 0.65,
        output: 2.75,
      },
    },
    "replicate/meta/llama-3-8b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/meta/llama-3-8b-instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/mistralai/mistral-7b-instruct-v0.2": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/mistralai/mistral-7b-v0.1": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "replicate/mistralai/mixtral-8x7b-instruct-v0.1": {
      standard: {
        input: 0.3,
        output: 1,
      },
    },
    "replicate/openai/gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
      },
    },
    "replicate/openai/gpt-oss-20b": {
      standard: {
        input: 0.09,
        output: 0.36,
      },
    },
    "replicate/anthropic/claude-4.5-haiku": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "replicate/ibm-granite/granite-3.3-8b-instruct": {
      standard: {
        input: 0.03,
        output: 0.25,
      },
    },
    "replicate/openai/gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "replicate/openai/o4-mini": {
      standard: {
        input: 1,
        output: 4,
        reasoning: 4,
      },
    },
    "replicate/openai/o1-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        reasoning: 4.4,
      },
    },
    "replicate/openai/o1": {
      standard: {
        input: 15,
        output: 60,
        reasoning: 60,
      },
    },
    "replicate/openai/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "replicate/qwen/qwen3-235b-a22b-instruct-2507": {
      standard: {
        input: 0.26399999999999996,
        output: 1.06,
      },
    },
    "replicate/anthropic/claude-4-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "replicate/deepseek-ai/deepseek-v3": {
      standard: {
        input: 1.4500000000000002,
        output: 1.4500000000000002,
      },
    },
    "replicate/anthropic/claude-3.7-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "replicate/anthropic/claude-3.5-haiku": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "replicate/anthropic/claude-3.5-sonnet": {
      standard: {
        input: 3.75,
        output: 18.75,
      },
    },
    "replicate/google/gemini-3-pro": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "replicate/anthropic/claude-4.5-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "replicate/openai/gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "replicate/openai/gpt-4.1-nano": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
      },
    },
    "replicate/openai/gpt-4.1-mini": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "replicate/openai/gpt-5-nano": {
      standard: {
        input: 0.049999999999999996,
        output: 0.39999999999999997,
      },
    },
    "replicate/openai/gpt-5-mini": {
      standard: {
        input: 0.25,
        output: 2,
      },
    },
    "replicate/google/gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
      },
    },
    "replicate/openai/gpt-oss-120b": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "replicate/deepseek-ai/deepseek-v3.1": {
      standard: {
        input: 0.6719999999999999,
        output: 2.016,
      },
    },
    "replicate/xai/grok-4": {
      standard: {
        input: 7.199999999999999,
        output: 36,
      },
    },
    "replicate/deepseek-ai/deepseek-r1": {
      standard: {
        input: 3.75,
        output: 10,
        reasoning: 10,
      },
    },
    "rerank-english-v3.0": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "rerank-multilingual-v3.0": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "rerank-v3.5": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "rerank-v4.0-fast": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "rerank-v4.0-pro": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "nvidia_nim/nvidia/nv-rerankqa-mistral-4b-v3": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "nvidia_nim/nvidia/llama-3_2-nv-rerankqa-1b-v2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "nvidia_nim/ranking/nvidia/llama-3.2-nv-rerankqa-1b-v2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-13b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-13b-f": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-70b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-70b-b-f": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-7b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sagemaker/meta-textgeneration-llama-2-7b-f": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "sambanova/MiniMax-M2.7": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "sambanova/DeepSeek-R1": {
      standard: {
        input: 5,
        output: 7,
      },
    },
    "sambanova/Llama-4-Maverick-17B-128E-Instruct": {
      standard: {
        input: 0.63,
        output: 1.7999999999999998,
      },
    },
    "sambanova/Meta-Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.6,
        output: 1.2,
      },
    },
    "sambanova/DeepSeek-V3.1": {
      standard: {
        input: 3,
        output: 4.5,
      },
    },
    "sambanova/gpt-oss-120b": {
      standard: {
        input: 0.22,
        output: 0.59,
      },
    },
    "sambanova/DeepSeek-V3.2": {
      standard: {
        input: 3,
        output: 4.5,
      },
    },
    "sambanova/gemma-4-31B-it": {
      standard: {
        input: 0.38,
        output: 1.15,
      },
    },
    "scx-ai/GLM-5.2": {
      standard: {
        input: 0.61,
        output: 1.9800000000000002,
        cacheRead: 0.22,
      },
    },
    "scx-ai/Qwen3.8-Max": {
      standard: {
        input: 1.6500000000000001,
        output: 4.989999999999999,
        cacheRead: 0.21,
      },
    },
    "snowflake/claude-3-5-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "snowflake/deepseek-r1": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "snowflake/llama3.1-405b": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "snowflake/llama3.1-70b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "snowflake/llama3.1-8b": {
      standard: {
        input: 0.24,
        output: 0.24,
      },
    },
    "snowflake/llama3.3-70b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "snowflake/mistral-large2": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "snowflake/snowflake-llama-3.3-70b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "text-completion-codestral/codestral-2405": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "text-completion-codestral/codestral-latest": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "text-embedding-004": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-embedding-005": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-embedding-3-large": {
      standard: {
        input: 0.13,
        output: 0,
      },
    },
    "text-embedding-3-small": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "text-embedding-ada-002": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-embedding-ada-002-v2": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-embedding-large-exp-03-07": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-embedding-preview-0409": {
      standard: {
        input: 0.0062499999999999995,
        output: 0,
      },
    },
    "text-multilingual-embedding-002": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "text-unicorn": {
      standard: {
        input: 10,
        output: 28,
      },
    },
    "text-unicorn@001": {
      standard: {
        input: 10,
        output: 28,
      },
    },
    "together-ai-21.1b-41b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "together-ai-4.1b-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together-ai-41.1b-80b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "together-ai-8.1b-21b": {
      standard: {
        input: 0.3,
        output: 0.3,
      },
    },
    "together-ai-81.1b-110b": {
      standard: {
        input: 1.7999999999999998,
        output: 1.7999999999999998,
      },
    },
    "together-ai-embedding-151m-to-350m": {
      standard: {
        input: 0.016,
        output: 0,
      },
    },
    "together-ai-embedding-up-to-150m": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "together_ai/baai/bge-base-en-v1.5": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "together_ai/BAAI/bge-base-en-v1.5": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "together-ai-up-to-4b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo": {
      standard: {
        input: 0.3,
        output: 0.3,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-V3": {
      standard: {
        input: 1.25,
        output: 1.25,
      },
    },
    "together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo": {
      standard: {
        input: 1.04,
        output: 1.04,
      },
    },
    "together_ai/moonshotai/Kimi-K2-Instruct": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "together_ai/openai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "together_ai/zai-org/GLM-4.6": {
      standard: {
        input: 0.6,
        output: 2.2,
      },
    },
    "together_ai/MiniMaxAI/MiniMax-M3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "together_ai/Prism-ML/Ternary-Bonsai-27B": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "together_ai/Qwen/Qwen3.5-9B": {
      standard: {
        input: 0.16999999999999998,
        output: 0.25,
      },
    },
    "together_ai/Qwen/Qwen3.6-Plus": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "together_ai/Qwen/Qwen3.7-Max": {
      standard: {
        input: 1.5,
        output: 4.5,
        cacheRead: 0.3,
      },
    },
    "together_ai/Qwen/Qwen3.7-Plus": {
      standard: {
        input: 0.32,
        output: 1.28,
      },
    },
    "together_ai/Qwen/Qwen3.8-2.4T-A95B": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "together_ai/arize-ai/qwen-2-1.5b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.03,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.13,
      },
    },
    "together_ai/meta-models/Muse-Glimmer-30B": {
      standard: {
        input: 0.35,
        output: 1.5,
        cacheRead: 0.04,
      },
    },
    "together_ai/moonshotai/Kimi-K3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "together_ai/thinkingmachines/Inkling": {
      standard: {
        input: 1,
        output: 4.05,
        cacheRead: 0.16999999999999998,
      },
    },
    "together_ai/zai-org/GLM-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "together_ai/zai-org/GLM-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "together_ai/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "us.amazon.nova-lite-v1:0": {
      standard: {
        input: 0.06,
        output: 0.24,
        cacheRead: 0.015,
      },
    },
    "us.amazon.nova-micro-v1:0": {
      standard: {
        input: 0.035,
        output: 0.14,
        cacheRead: 0.00875,
      },
    },
    "us.amazon.nova-pro-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
        cacheRead: 0.19999999999999998,
      },
    },
    "us.anthropic.claude-3-5-haiku-20241022-v1:0": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
        cacheRead: 0.08,
        cacheWrite: 1,
      },
    },
    "us.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
        cacheWriteOneHour: 2.2,
      },
    },
    "us.anthropic.claude-3-5-sonnet-20240620-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "us.anthropic.claude-3-5-sonnet-20241022-v2:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "us.anthropic.claude-3-opus-20240229-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "us.anthropic.claude-opus-4-1-20250805-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.5999999999999996,
        output: 18,
        cacheRead: 0.36,
        cacheWrite: 4.5,
        cacheWriteOneHour: 7.199999999999999,
      },
    },
    "us-gov.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "us-gov.anthropic.claude-opus-4-8": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "us-gov.anthropic.claude-opus-5": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "us-gov.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.8,
        output: 24,
        cacheRead: 0.24,
        cacheWrite: 6,
        cacheWriteOneHour: 9.6,
      },
    },
    "us-gov.anthropic.claude-fable-5-1": {
      standard: {
        input: 12,
        output: 60,
        cacheRead: 0.3,
        cacheWrite: 15,
        cacheWriteOneHour: 24,
      },
    },
    "us-gov.nvidia.nemotron-nano-3-30b": {
      standard: {
        input: 0.072,
        output: 0.288,
      },
    },
    "us-gov.nvidia.nemotron-nano-12b-v2": {
      standard: {
        input: 0.24,
        output: 0.72,
      },
    },
    "us-gov.nvidia.nemotron-nano-9b-v2": {
      standard: {
        input: 0.072,
        output: 0.27599999999999997,
      },
    },
    "us-gov.nvidia.nemotron-super-3-120b": {
      standard: {
        input: 0.18,
        output: 0.78,
      },
    },
    "us-gov.openai.gpt-oss-20b-1:0": {
      standard: {
        input: 0.08399999999999999,
        output: 0.36,
      },
    },
    "us-gov.openai.gpt-oss-120b-1:0": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "us-gov.xai.grok-4.6": {
      standard: {
        input: 2.64,
        output: 7.920000000000001,
        cacheRead: 0.66,
      },
    },
    "au.anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
        cacheWriteOneHour: 2.2,
      },
    },
    "us.anthropic.claude-opus-4-20250514-v1:0": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "us.anthropic.claude-opus-4-5-20251101-v1:0": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "global.anthropic.claude-opus-4-5-20251101-v1:0": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "eu.anthropic.claude-opus-4-5-20251101-v1:0": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "us.anthropic.claude-sonnet-4-20250514-v1:0": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "us.deepseek.r1-v1:0": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "us.deepseek.v3.2": {
      standard: {
        input: 0.62,
        output: 1.85,
      },
    },
    "eu.deepseek.v3.2": {
      standard: {
        input: 0.74,
        output: 2.2199999999999998,
      },
    },
    "us.meta.llama3-1-405b-instruct-v1:0": {
      standard: {
        input: 2.4,
        output: 2.4,
      },
    },
    "us.meta.llama3-1-70b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "us.meta.llama3-1-8b-instruct-v1:0": {
      standard: {
        input: 0.22,
        output: 0.22,
      },
    },
    "us.meta.llama3-2-11b-instruct-v1:0": {
      standard: {
        input: 0.16,
        output: 0.16,
      },
    },
    "us.meta.llama3-2-1b-instruct-v1:0": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "us.meta.llama3-2-3b-instruct-v1:0": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "us.meta.llama3-2-90b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "us.meta.llama3-3-70b-instruct-v1:0": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "us.meta.llama4-maverick-17b-instruct-v1:0": {
      standard: {
        input: 0.24,
        output: 0.9700000000000001,
      },
    },
    "us.meta.llama4-scout-17b-instruct-v1:0": {
      standard: {
        input: 0.16999999999999998,
        output: 0.66,
      },
    },
    "us.mistral.pixtral-large-2502-v1:0": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "v0/v0-1.0-md": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "v0/v0-1.5-lg": {
      standard: {
        input: 15,
        output: 75,
      },
    },
    "v0/v0-1.5-md": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/alibaba/qwen-3-14b": {
      standard: {
        input: 0.08,
        output: 0.24,
      },
    },
    "vercel_ai_gateway/alibaba/qwen-3-235b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "vercel_ai_gateway/alibaba/qwen-3-30b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vercel_ai_gateway/alibaba/qwen-3-32b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vercel_ai_gateway/alibaba/qwen3-coder": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
      },
    },
    "vercel_ai_gateway/amazon/nova-lite": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "vercel_ai_gateway/amazon/nova-micro": {
      standard: {
        input: 0.035,
        output: 0.14,
      },
    },
    "vercel_ai_gateway/amazon/nova-pro": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
      },
    },
    "vercel_ai_gateway/amazon/titan-embed-text-v2": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3-haiku": {
      standard: {
        input: 0.25,
        output: 1.25,
        cacheRead: 0.03,
        cacheWrite: 0.3,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3-opus": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3.5-haiku": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
        cacheRead: 0.08,
        cacheWrite: 1,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3.5-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3.7-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-4-opus": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-4-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3-5-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3-5-sonnet-20241022": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-3-7-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-haiku-4.5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "vercel_ai_gateway/anthropic/claude-opus-4": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-opus-4.1": {
      standard: {
        input: 15,
        output: 75,
        cacheRead: 1.5,
        cacheWrite: 18.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-opus-4.5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "vercel_ai_gateway/anthropic/claude-opus-4.6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "vercel_ai_gateway/anthropic/claude-sonnet-4": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/anthropic/claude-sonnet-4.5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "vercel_ai_gateway/cohere/command-a": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "vercel_ai_gateway/cohere/command-r": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "vercel_ai_gateway/cohere/command-r-plus": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "vercel_ai_gateway/cohere/embed-v4.0": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "vercel_ai_gateway/deepseek/deepseek-r1": {
      standard: {
        input: 0.55,
        output: 2.1900000000000004,
      },
    },
    "vercel_ai_gateway/deepseek/deepseek-r1-distill-llama-70b": {
      standard: {
        input: 0.75,
        output: 0.9900000000000001,
      },
    },
    "vercel_ai_gateway/deepseek/deepseek-v3": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "vercel_ai_gateway/google/gemini-2.5-flash": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
      },
    },
    "vercel_ai_gateway/google/gemini-2.5-pro": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "vercel_ai_gateway/google/gemini-embedding-001": {
      standard: {
        input: 0.15,
        output: 0,
      },
    },
    "vercel_ai_gateway/google/gemma-2-9b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "vercel_ai_gateway/google/text-embedding-005": {
      standard: {
        input: 0.024999999999999998,
        output: 0,
      },
    },
    "vercel_ai_gateway/google/text-multilingual-embedding-002": {
      standard: {
        input: 0.024999999999999998,
        output: 0,
      },
    },
    "vercel_ai_gateway/inception/mercury-coder-small": {
      standard: {
        input: 0.25,
        output: 1,
      },
    },
    "vercel_ai_gateway/meta/llama-3-70b": {
      standard: {
        input: 0.59,
        output: 0.7899999999999999,
      },
    },
    "vercel_ai_gateway/meta/llama-3-8b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.08,
      },
    },
    "vercel_ai_gateway/meta/llama-3.1-70b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "vercel_ai_gateway/meta/llama-3.1-8b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.08,
      },
    },
    "vercel_ai_gateway/meta/llama-3.2-11b": {
      standard: {
        input: 0.16,
        output: 0.16,
      },
    },
    "vercel_ai_gateway/meta/llama-3.2-1b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "vercel_ai_gateway/meta/llama-3.2-3b": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "vercel_ai_gateway/meta/llama-3.2-90b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "vercel_ai_gateway/meta/llama-3.3-70b": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "vercel_ai_gateway/meta/llama-4-maverick": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "vercel_ai_gateway/meta/llama-4-scout": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vercel_ai_gateway/mistral/codestral": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "vercel_ai_gateway/mistral/codestral-embed": {
      standard: {
        input: 0.15,
        output: 0,
      },
    },
    "vercel_ai_gateway/mistral/devstral-small": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "vercel_ai_gateway/mistral/magistral-medium": {
      standard: {
        input: 2,
        output: 5,
      },
    },
    "vercel_ai_gateway/mistral/magistral-small": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "vercel_ai_gateway/mistral/ministral-3b": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "vercel_ai_gateway/mistral/ministral-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "vercel_ai_gateway/mistral/mistral-embed": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "vercel_ai_gateway/mistral/mistral-large": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vercel_ai_gateway/mistral/mistral-saba-24b": {
      standard: {
        input: 0.7899999999999999,
        output: 0.7899999999999999,
      },
    },
    "vercel_ai_gateway/mistral/mistral-small": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vercel_ai_gateway/mistral/mixtral-8x22b-instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "vercel_ai_gateway/mistral/pixtral-12b": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "vercel_ai_gateway/mistral/pixtral-large": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vercel_ai_gateway/moonshotai/kimi-k2": {
      standard: {
        input: 0.55,
        output: 2.2,
      },
    },
    "vercel_ai_gateway/morph/morph-v3-fast": {
      standard: {
        input: 0.7999999999999999,
        output: 1.2,
      },
    },
    "vercel_ai_gateway/morph/morph-v3-large": {
      standard: {
        input: 0.8999999999999999,
        output: 1.9,
      },
    },
    "vercel_ai_gateway/openai/gpt-3.5-turbo": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "vercel_ai_gateway/openai/gpt-3.5-turbo-instruct": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "vercel_ai_gateway/openai/gpt-4-turbo": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "vercel_ai_gateway/openai/gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/gpt-4.1-mini": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.09999999999999999,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/gpt-4.1-nano": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.024999999999999998,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/gpt-4o": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/o1": {
      standard: {
        input: 15,
        output: 60,
        cacheRead: 7.5,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/o3": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/o3-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.55,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/o4-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
        cacheWrite: 0,
      },
    },
    "vercel_ai_gateway/openai/text-embedding-3-large": {
      standard: {
        input: 0.13,
        output: 0,
      },
    },
    "vercel_ai_gateway/openai/text-embedding-3-small": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "vercel_ai_gateway/openai/text-embedding-ada-002": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "vercel_ai_gateway/perplexity/sonar": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "vercel_ai_gateway/perplexity/sonar-pro": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/perplexity/sonar-reasoning": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "vercel_ai_gateway/perplexity/sonar-reasoning-pro": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "vercel_ai_gateway/vercel/v0-1.0-md": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/vercel/v0-1.5-md": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/xai/grok-2": {
      standard: {
        input: 2,
        output: 10,
      },
    },
    "vercel_ai_gateway/xai/grok-2-vision": {
      standard: {
        input: 2,
        output: 10,
      },
    },
    "vercel_ai_gateway/xai/grok-3": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/xai/grok-3-fast": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "vercel_ai_gateway/xai/grok-3-mini": {
      standard: {
        input: 0.3,
        output: 0.5,
      },
    },
    "vercel_ai_gateway/xai/grok-3-mini-fast": {
      standard: {
        input: 0.6,
        output: 4,
      },
    },
    "vercel_ai_gateway/xai/grok-4": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vercel_ai_gateway/zai/glm-4.5": {
      standard: {
        input: 0.6,
        output: 2.2,
      },
    },
    "vercel_ai_gateway/zai/glm-4.5-air": {
      standard: {
        input: 0.19999999999999998,
        output: 1.1,
      },
    },
    "vercel_ai_gateway/zai/glm-4.6": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
        cacheRead: 0.11,
      },
    },
    "vertex_ai/claude-3-5-haiku": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "vertex_ai/claude-3-5-haiku@20241022": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "vertex_ai/claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "vertex_ai/claude-haiku-4-5@20251001": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "vertex_ai/claude-3-5-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vertex_ai/claude-3-5-sonnet@20240620": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vertex_ai/claude-3-haiku": {
      standard: {
        input: 0.25,
        output: 1.25,
      },
    },
    "vertex_ai/claude-3-haiku@20240307": {
      standard: {
        input: 0.25,
        output: 1.25,
      },
    },
    "vertex_ai/claude-3-opus": {
      standard: {
        input: 15,
        output: 75,
      },
    },
    "vertex_ai/claude-3-opus@20240229": {
      standard: {
        input: 15,
        output: 75,
      },
    },
    "vertex_ai/claude-3-sonnet": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vertex_ai/claude-3-sonnet@20240229": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "vertex_ai/claude-opus-4-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-5@20251101": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-6": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-6@default": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-7@default": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "vertex_ai/claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "vertex_ai/claude-fable-5@default": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "vertex_ai/claude-fable-5-1@default": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "vertex_ai/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-5@default": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "vertex_ai/claude-opus-5-5@default": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "vertex_ai/claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-opus-4-8@default": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "vertex_ai/claude-sonnet-4-5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "vertex_ai/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "vertex_ai/claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "vertex_ai/claude-sonnet-4-5@20250929": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "vertex_ai/mistralai/codestral-2@001": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "vertex_ai/codestral-2": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "vertex_ai/codestral-2@001": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "vertex_ai/mistralai/codestral-2": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
      },
    },
    "vertex_ai/codestral-2501": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "vertex_ai/codestral@2405": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "vertex_ai/codestral@latest": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "vertex_ai/deepseek-ai/deepseek-v3.1-maas": {
      standard: {
        input: 0.6,
        output: 1.7,
        cacheRead: 0.06,
      },
    },
    "vertex_ai/deepseek-ai/deepseek-v3.2-maas": {
      standard: {
        input: 0.56,
        output: 1.68,
        cacheRead: 0.056,
      },
    },
    "vertex_ai/deepseek-ai/deepseek-r1-0528-maas": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "vertex_ai/gemini-2.5-flash-image": {
      standard: {
        input: 0.3,
        output: 2.5,
        reasoning: 2.5,
      },
    },
    "vertex_ai/gemini-3-pro-image": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/gemini-3-pro-image-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/gemini-3.1-flash-image": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "vertex_ai/gemini-3.1-flash-image-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "vertex_ai/gemini-3.1-flash-lite-image": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
      },
    },
    "vertex_ai/gemini-3.1-flash-lite-preview": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "vertex_ai/gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
        reasoning: 1.5,
      },
    },
    "vertex_ai/gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "vertex_ai/deep-research-pro-preview-12-2025": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/jamba-1.5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "vertex_ai/jamba-1.5-large": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "vertex_ai/jamba-1.5-large@001": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "vertex_ai/jamba-1.5-mini": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "vertex_ai/jamba-1.5-mini@001": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
      },
    },
    "vertex_ai/lyria-3-clip-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/lyria-3-pro-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama-3.1-405b-instruct-maas": {
      standard: {
        input: 5,
        output: 16,
      },
    },
    "vertex_ai/meta/llama-3.1-70b-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama-3.1-8b-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama-3.2-90b-vision-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama-4-maverick-17b-128e-instruct-maas": {
      standard: {
        input: 0.35,
        output: 1.15,
      },
    },
    "vertex_ai/meta/llama-4-maverick-17b-16e-instruct-maas": {
      standard: {
        input: 0.35,
        output: 1.15,
      },
    },
    "vertex_ai/meta/llama-4-scout-17b-128e-instruct-maas": {
      standard: {
        input: 0.25,
        output: 0.7,
      },
    },
    "vertex_ai/meta/llama-4-scout-17b-16e-instruct-maas": {
      standard: {
        input: 0.25,
        output: 0.7,
      },
    },
    "vertex_ai/meta/llama3-405b-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama3-70b-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/meta/llama3-8b-instruct-maas": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "vertex_ai/minimaxai/minimax-m2-maas": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "vertex_ai/moonshotai/kimi-k2-thinking-maas": {
      standard: {
        input: 0.6,
        output: 2.5,
        cacheRead: 0.06,
      },
    },
    "vertex_ai/zai-org/glm-4.7-maas": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.06,
      },
    },
    "vertex_ai/zai-org/glm-5-maas": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
        cacheRead: 0.09999999999999999,
      },
    },
    "vertex_ai/mistral-medium-3": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "vertex_ai/mistral-medium-3@001": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "vertex_ai/mistralai/mistral-medium-3": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "vertex_ai/mistralai/mistral-medium-3@001": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
      },
    },
    "vertex_ai/mistral-large-2411": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vertex_ai/mistral-large@2407": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vertex_ai/mistral-large@2411-001": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vertex_ai/mistral-large@latest": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "vertex_ai/mistral-nemo@2407": {
      standard: {
        input: 3,
        output: 3,
      },
    },
    "vertex_ai/mistral-nemo@latest": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "vertex_ai/mistral-small-2503": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vertex_ai/mistral-small-2503@001": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "vertex_ai/deepseek-ai/deepseek-ocr-maas": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "vertex_ai/google/gemma-4-26b-a4b-it-maas": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "vertex_ai/openai/gpt-oss-120b-maas": {
      standard: {
        input: 0.09,
        output: 0.36,
      },
    },
    "vertex_ai/openai/gpt-oss-20b-maas": {
      standard: {
        input: 0.07,
        output: 0.25,
        cacheRead: 0.007,
      },
    },
    "vertex_ai/xai/grok-4.1-fast-non-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "vertex_ai/xai/grok-4.1-fast-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "vertex_ai/xai/grok-4.20-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/xai/grok-4.20-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/xai/grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "vertex_ai/xai/grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "vertex_ai/qwen/qwen3-235b-a22b-instruct-2507-maas": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "vertex_ai/qwen/qwen3-coder-480b-a35b-instruct-maas": {
      standard: {
        input: 0.22,
        output: 1.7999999999999998,
        cacheRead: 0.022,
      },
    },
    "vertex_ai/qwen/qwen3-next-80b-a3b-instruct-maas": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "vertex_ai/qwen/qwen3-next-80b-a3b-thinking-maas": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "voyage/rerank-2": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "voyage/rerank-2-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/rerank-1": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "voyage/rerank-lite-1": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/rerank-2.5": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "voyage/rerank-2.5-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/rerank-3": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "voyage/rerank-3-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/voyage-2": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "voyage/voyage-3": {
      standard: {
        input: 0.06,
        output: 0,
      },
    },
    "voyage/voyage-multilingual-2": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-3-large": {
      standard: {
        input: 0.18,
        output: 0,
      },
    },
    "voyage/voyage-3-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/voyage-3.5": {
      standard: {
        input: 0.06,
        output: 0,
      },
    },
    "voyage/voyage-3.5-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/voyage-code-2": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-code-3": {
      standard: {
        input: 0.18,
        output: 0,
      },
    },
    "voyage/voyage-context-3": {
      standard: {
        input: 0.18,
        output: 0,
      },
    },
    "voyage/voyage-finance-2": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-large-2": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-large-2-instruct": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-law-2": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-lite-01": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "voyage/voyage-lite-02-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "voyage/voyage-multimodal-3": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "wandb/openai/gpt-oss-120b": {
      standard: {
        input: 0.03,
        output: 0.16999999999999998,
      },
    },
    "wandb/openai/gpt-oss-20b": {
      standard: {
        input: 0.03,
        output: 0.13,
      },
    },
    "wandb/moonshotai/Kimi-K2.5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "wandb/meta-llama/Llama-3.1-8B-Instruct": {
      standard: {
        input: 0.22,
        output: 0.22,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V3.1": {
      standard: {
        input: 0.55,
        output: 1.6500000000000001,
      },
    },
    "wandb/meta-llama/Llama-3.3-70B-Instruct": {
      standard: {
        input: 0.71,
        output: 0.71,
      },
    },
    "watsonx/ibm/granite-3-8b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "watsonx/mistralai/mistral-large": {
      standard: {
        input: 3,
        output: 10,
      },
    },
    "watsonx/bigscience/mt0-xxl-13b": {
      standard: {
        input: 1.9080000000000001,
        output: 1.9080000000000001,
      },
    },
    "watsonx/bigscience/mt0-xxl": {
      standard: {
        input: 1.9080000000000001,
        output: 1.9080000000000001,
      },
    },
    "watsonx/core42/jais-13b-chat": {
      standard: {
        input: 500,
        output: 2000,
      },
    },
    "watsonx/google/flan-t5-xl-3b": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "watsonx/ibm/granite-13b-chat-v2": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "watsonx/ibm/granite-13b-instruct-v2": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "watsonx/ibm/granite-3-3-8b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "watsonx/ibm/granite-4-h-small": {
      standard: {
        input: 0.0636,
        output: 0.265,
      },
    },
    "watsonx/ibm/granite-guardian-3-2-2b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "watsonx/ibm/granite-guardian-3-3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "watsonx/ibm/granite-ttm-1024-96-r2": {
      standard: {
        input: 0.38,
        output: 0.38,
      },
    },
    "watsonx/ibm/granite-ttm-1536-96-r2": {
      standard: {
        input: 0.38,
        output: 0.38,
      },
    },
    "watsonx/ibm/granite-ttm-512-96-r2": {
      standard: {
        input: 0.38,
        output: 0.38,
      },
    },
    "watsonx/ibm/granite-vision-3-2-2b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "watsonx/meta-llama/llama-3-2-11b-vision-instruct": {
      standard: {
        input: 0.35,
        output: 0.35,
      },
    },
    "watsonx/meta-llama/llama-3-2-1b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "watsonx/meta-llama/llama-3-2-3b-instruct": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "watsonx/meta-llama/llama-3-2-90b-vision-instruct": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "watsonx/meta-llama/llama-3-3-70b-instruct": {
      standard: {
        input: 0.7526,
        output: 0.7526,
      },
    },
    "watsonx/meta-llama/llama-4-maverick-17b": {
      standard: {
        input: 0.371,
        output: 1.484,
      },
    },
    "watsonx/meta-llama/llama-4-maverick-17b-128e-instruct-fp8": {
      standard: {
        input: 0.371,
        output: 1.484,
      },
    },
    "watsonx/meta-llama/llama-guard-3-11b-vision": {
      standard: {
        input: 0.35,
        output: 0.35,
      },
    },
    "watsonx/mistralai/mistral-medium-2505": {
      standard: {
        input: 3,
        output: 10,
      },
    },
    "watsonx/mistralai/mistral-small-2503": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "watsonx/mistralai/mistral-small-3-1-24b-instruct-2503": {
      standard: {
        input: 0.106,
        output: 0.318,
      },
    },
    "watsonx/mistralai/pixtral-12b-2409": {
      standard: {
        input: 0.35,
        output: 0.35,
      },
    },
    "watsonx/openai/gpt-oss-120b": {
      standard: {
        input: 0.159,
        output: 0.636,
      },
    },
    "watsonx/sdaia/allam-1-13b-instruct": {
      standard: {
        input: 1.7999999999999998,
        output: 1.7999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-beta-0309": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-0309-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-0309-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-0309-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.3-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.5": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.3,
      },
    },
    "xai/grok-4.5-latest": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.3,
      },
    },
    "xai/grok-build-latest": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.3,
      },
    },
    "xai/grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "xai/grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "zai.glm-4.7": {
      standard: {
        input: 0.6,
        output: 2.2,
      },
    },
    "zai.glm-5": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
      },
    },
    "zai.glm-4.7-flash": {
      standard: {
        input: 0.07,
        output: 0.39999999999999997,
      },
    },
    "zai/glm-5": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0,
      },
    },
    "zai/glm-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
        cacheWrite: 0,
      },
    },
    "zai/glm-5.3-flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
        cacheWrite: 0,
      },
    },
    "zai/glm-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
        cacheWrite: 0,
      },
    },
    "zai/glm-5-code": {
      standard: {
        input: 1.2,
        output: 5,
        cacheRead: 0.3,
        cacheWrite: 0,
      },
    },
    "zai/glm-4.7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
        cacheWrite: 0,
      },
    },
    "zai/glm-4.7-flash": {
      standard: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    },
    "zai/glm-4.6": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
        cacheWrite: 0,
      },
    },
    "zai/glm-4.5": {
      standard: {
        input: 0.6,
        output: 2.2,
      },
    },
    "zai/glm-4.5v": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
      },
    },
    "zai/glm-4.5-x": {
      standard: {
        input: 2.2,
        output: 8.9,
      },
    },
    "zai/glm-4.5-air": {
      standard: {
        input: 0.19999999999999998,
        output: 1.1,
      },
    },
    "zai/glm-4.5-airx": {
      standard: {
        input: 1.1,
        output: 4.5,
      },
    },
    "zai/glm-4-32b-0414-128k": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "zai/glm-4.5-flash": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-coder-480b-a35b-instruct": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-kontext-pro": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "fireworks_ai/accounts/fireworks/models/SSD-1B": {
      standard: {
        input: 0.00013,
        output: 0.00013,
      },
    },
    "fireworks_ai/accounts/fireworks/models/chronos-hermes-13b-v2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-13b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-13b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-13b-python": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-34b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-34b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-34b-python": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-70b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-70b-python": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-llama-7b-python": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/code-qwen-1p5-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/codegemma-2b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/codegemma-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-671b-v2-p1": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-v1-preview-llama-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-v1-preview-llama-70b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-v1-preview-llama-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-v1-preview-qwen-14b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/cogito-v1-preview-qwen-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-kontext-max": {
      standard: {
        input: 0.08,
        output: 0.08,
      },
    },
    "fireworks_ai/accounts/fireworks/models/dbrx-instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-1b-base": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-33b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-7b-base": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-7b-base-v1p5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-7b-instruct-v1p5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-v2-lite-base": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-coder-v2-lite-instruct": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-prover-v2": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-0528-distill-qwen3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-llama-70b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-llama-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-qwen-14b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-qwen-1p5b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-qwen-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-r1-distill-qwen-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v2-lite-chat": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v2p5": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/devstral-small-2505": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/dobby-mini-unhinged-plus-llama-3-1-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/dobby-unhinged-llama-3-3-70b-new": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/dolphin-2-9-2-qwen2-72b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/dolphin-2p6-mixtral-8x7b": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ernie-4p5-21b-a3b-pt": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ernie-4p5-300b-a47b-pt": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/fare-20b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/firefunction-v1": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/firellava-13b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/firesearch-ocr-v6": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/fireworks-asr-large": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/fireworks-asr-v2": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-1-dev": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-1-dev-controlnet-union": {
      standard: {
        input: 0.001,
        output: 0.001,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-1-dev-fp8": {
      standard: {
        input: 0.0005,
        output: 0.0005,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-1-schnell": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/flux-1-schnell-fp8": {
      standard: {
        input: 0.00035,
        output: 0.00035,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gemma-2b-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gemma-3-27b-it": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gemma-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gemma-7b-it": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gemma2-9b-it": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-4p5v": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gpt-oss-safeguard-120b": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/gpt-oss-safeguard-20b": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/hermes-2-pro-mistral-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/internvl3-38b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/internvl3-78b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/internvl3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/japanese-stable-diffusion-xl": {
      standard: {
        input: 0.00013,
        output: 0.00013,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kat-coder": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kat-dev-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kat-dev-72b-exp": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-guard-2-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-guard-3-1b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-guard-3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-13b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-13b-chat": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-70b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-70b-chat": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v2-7b-chat": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3-70b-instruct-hf": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3-8b-instruct-hf": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-405b-instruct-long": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-70b-instruct-1b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-nemotron-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-1b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p2-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llamaguard-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/llava-yi-34b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/minimax-m1-80k": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/minimax-m2": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ministral-3-14b-instruct-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ministral-3-3b-instruct-2512": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ministral-3-8b-instruct-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-7b-instruct-4k": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-7b-instruct-v0p2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-7b-instruct-v3": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-7b-v0p2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-large-3-fp8": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-nemo-base-2407": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-nemo-instruct-2407": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mistral-small-24b-instruct-2501": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x22b": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x22b-instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x7b": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x7b-instruct": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mixtral-8x7b-instruct-hf": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/mythomax-l2-13b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nemotron-nano-v2-12b-vl": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-capybara-7b-v1p9": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-hermes-2-mixtral-8x7b-dpo": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-hermes-2-yi-34b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-hermes-llama2-13b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-hermes-llama2-70b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nous-hermes-llama2-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nvidia-nemotron-nano-12b-v2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nvidia-nemotron-nano-9b-v2": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/openchat-3p5-0106-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/openhermes-2-mistral-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/openhermes-2p5-mistral-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/openorca-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phi-2-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phi-3-mini-128k-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phi-3-vision-128k-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phind-code-llama-34b-python-v1": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phind-code-llama-34b-v1": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/phind-code-llama-34b-v2": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/playground-v2-1024px-aesthetic": {
      standard: {
        input: 0.00013,
        output: 0.00013,
      },
    },
    "fireworks_ai/accounts/fireworks/models/playground-v2-5-1024px-aesthetic": {
      standard: {
        input: 0.00013,
        output: 0.00013,
      },
    },
    "fireworks_ai/accounts/fireworks/models/pythia-12b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen-qwq-32b-preview": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen-v2p5-14b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen-v2p5-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen1p5-72b-chat": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2-vl-2b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2-vl-72b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2-vl-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-0p5b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-14b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-1p5b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-32b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-72b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-72b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-0p5b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-0p5b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-14b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-14b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-1p5b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-1p5b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-32b-instruct-128k": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-32b-instruct-32k-rope": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-32b-instruct-64k": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-3b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-coder-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-math-72b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-vl-32b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-vl-3b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-vl-72b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen2p5-vl-7b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-0p6b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-14b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-1p7b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-1p7b-fp8-draft": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-1p7b-fp8-draft-131072": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-1p7b-fp8-draft-40960": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-235b-a22b": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-235b-a22b-instruct-2507": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-235b-a22b-thinking-2507": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-30b-a3b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-30b-a3b-instruct-2507": {
      standard: {
        input: 0.5,
        output: 0.5,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-30b-a3b-thinking-2507": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-4b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-4b-instruct-2507": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-coder-30b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-coder-480b-instruct-bf16": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-embedding-0p6b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-embedding-4b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-reranker-0p6b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-reranker-4b": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-reranker-8b": {
      standard: {
        input: 0.19999999999999998,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-30b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-30b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-32b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-vl-8b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3p7-plus": {
      standard: {
        input: 0.39999999999999997,
        output: 1.5999999999999999,
        cacheRead: 0.08,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwq-32b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/rolm-ocr": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/snorkel-mistral-7b-pairrm-dpo": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0": {
      standard: {
        input: 0.00013,
        output: 0.00013,
      },
    },
    "fireworks_ai/accounts/fireworks/models/stablecode-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/starcoder-16b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/starcoder-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/starcoder2-15b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/starcoder2-3b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/starcoder2-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/toppy-m-7b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/yi-34b": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/yi-34b-200k-capybara": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/yi-34b-chat": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "fireworks_ai/accounts/fireworks/models/yi-6b": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/zephyr-7b-beta": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p1-fast": {
      standard: {
        input: 2.8,
        output: 8.8,
        cacheRead: 0.52,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/kimi-k2p6-fast": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/kimi-k2p7-code-fast": {
      standard: {
        input: 1.9,
        output: 8,
        cacheRead: 0.38,
      },
    },
    "scaleway/qwen/qwen3.5-397b-a17b": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
      },
    },
    "scaleway/qwen/qwen3.6-35b-a3b": {
      standard: {
        input: 0.25,
        output: 1.5,
      },
    },
    "scaleway/qwen/qwen3-235b-a22b-instruct-2507": {
      standard: {
        input: 0.75,
        output: 2.25,
      },
    },
    "scaleway/qwen/qwen3-embedding-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "scaleway/qwen/qwen3-coder-30b-a3b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7999999999999999,
      },
    },
    "scaleway/openai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "scaleway/google/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.25,
        output: 0.5,
      },
    },
    "scaleway/mistralai/mistral-medium-3.5-128b": {
      standard: {
        input: 1.5,
        output: 7.5,
      },
    },
    "scaleway/mistralai/mistral-small-3.2-24b-instruct-2506": {
      standard: {
        input: 0.15,
        output: 0.35,
      },
    },
    "scaleway/mistralai/pixtral-12b-2409": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "scaleway/BAAI/bge-multilingual-gemma2": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "scaleway/meta/llama-3.3-70b-instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "novita/deepseek/deepseek-v3.2": {
      standard: {
        input: 0.26899999999999996,
        output: 0.39999999999999997,
        cacheRead: 0.13449999999999998,
      },
    },
    "novita/minimax/minimax-m2.1": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "novita/zai-org/glm-4.7": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
      },
    },
    "novita/xiaomimimo/mimo-v2-flash": {
      standard: {
        input: 0.11,
        output: 0.33,
        cacheRead: 0.024,
      },
    },
    "novita/zai-org/autoglm-phone-9b-multilingual": {
      standard: {
        input: 0.035,
        output: 0.13799999999999998,
      },
    },
    "novita/moonshotai/kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
        cacheRead: 0.15,
      },
    },
    "novita/minimax/minimax-m2": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "novita/paddlepaddle/paddleocr-vl": {
      standard: {
        input: 0.02,
        output: 0.02,
      },
    },
    "novita/deepseek/deepseek-v3.2-exp": {
      standard: {
        input: 0.27,
        output: 0.41,
      },
    },
    "novita/qwen/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.98,
        output: 3.95,
      },
    },
    "novita/zai-org/glm-4.6v": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.055,
      },
    },
    "novita/zai-org/glm-4.6": {
      standard: {
        input: 0.55,
        output: 2.2,
        cacheRead: 0.11,
      },
    },
    "novita/kwaipilot/kat-coder-pro": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "novita/qwen/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "novita/qwen/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "novita/deepseek/deepseek-ocr": {
      standard: {
        input: 0.03,
        output: 0.03,
      },
    },
    "novita/deepseek/deepseek-v3.1-terminus": {
      standard: {
        input: 0.27,
        output: 1,
        cacheRead: 0.135,
      },
    },
    "novita/qwen/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.3,
        output: 1.5,
      },
    },
    "novita/qwen/qwen3-max": {
      standard: {
        input: 2.1100000000000003,
        output: 8.450000000000001,
      },
    },
    "novita/skywork/r1v4-lite": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
      },
    },
    "novita/deepseek/deepseek-v3.1": {
      standard: {
        input: 0.27,
        output: 1,
        cacheRead: 0.135,
      },
    },
    "novita/moonshotai/kimi-k2-0905": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "novita/qwen/qwen3-coder-480b-a35b-instruct": {
      standard: {
        input: 0.38,
        output: 1.55,
      },
    },
    "novita/qwen/qwen3-coder-30b-a3b-instruct": {
      standard: {
        input: 0.07,
        output: 0.27,
      },
    },
    "novita/openai/gpt-oss-120b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
      },
    },
    "novita/moonshotai/kimi-k2-instruct": {
      standard: {
        input: 0.5700000000000001,
        output: 2.3,
      },
    },
    "novita/deepseek/deepseek-v3-0324": {
      standard: {
        input: 0.27,
        output: 1.12,
        cacheRead: 0.135,
      },
    },
    "novita/zai-org/glm-4.5": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
      },
    },
    "novita/qwen/qwen3-235b-a22b-thinking-2507": {
      standard: {
        input: 0.3,
        output: 3,
      },
    },
    "novita/meta-llama/llama-3.1-8b-instruct": {
      standard: {
        input: 0.02,
        output: 0.049999999999999996,
      },
    },
    "novita/google/gemma-3-12b-it": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "novita/zai-org/glm-4.5v": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
        cacheRead: 0.11,
      },
    },
    "novita/openai/gpt-oss-20b": {
      standard: {
        input: 0.04,
        output: 0.15,
      },
    },
    "novita/qwen/qwen3-235b-a22b-instruct-2507": {
      standard: {
        input: 0.09,
        output: 0.58,
      },
    },
    "novita/deepseek/deepseek-r1-distill-qwen-14b": {
      standard: {
        input: 0.15,
        output: 0.15,
      },
    },
    "novita/meta-llama/llama-3.3-70b-instruct": {
      standard: {
        input: 0.135,
        output: 0.39999999999999997,
      },
    },
    "novita/qwen/qwen-2.5-72b-instruct": {
      standard: {
        input: 0.38,
        output: 0.39999999999999997,
      },
    },
    "novita/mistralai/mistral-nemo": {
      standard: {
        input: 0.04,
        output: 0.16999999999999998,
      },
    },
    "novita/minimaxai/minimax-m1-80k": {
      standard: {
        input: 0.55,
        output: 2.2,
      },
    },
    "novita/deepseek/deepseek-r1-0528": {
      standard: {
        input: 0.7,
        output: 2.5,
        cacheRead: 0.35,
      },
    },
    "novita/deepseek/deepseek-r1-distill-qwen-32b": {
      standard: {
        input: 0.3,
        output: 0.3,
      },
    },
    "novita/meta-llama/llama-3-8b-instruct": {
      standard: {
        input: 0.04,
        output: 0.04,
      },
    },
    "novita/microsoft/wizardlm-2-8x22b": {
      standard: {
        input: 0.62,
        output: 0.62,
      },
    },
    "novita/deepseek/deepseek-r1-0528-qwen3-8b": {
      standard: {
        input: 0.06,
        output: 0.09,
      },
    },
    "novita/deepseek/deepseek-r1-distill-llama-70b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "novita/meta-llama/llama-3-70b-instruct": {
      standard: {
        input: 0.51,
        output: 0.74,
      },
    },
    "novita/qwen/qwen3-235b-a22b-fp8": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7999999999999999,
      },
    },
    "novita/meta-llama/llama-4-maverick-17b-128e-instruct-fp8": {
      standard: {
        input: 0.27,
        output: 0.85,
      },
    },
    "novita/meta-llama/llama-4-scout-17b-16e-instruct": {
      standard: {
        input: 0.18,
        output: 0.59,
      },
    },
    "novita/nousresearch/hermes-2-pro-llama-3-8b": {
      standard: {
        input: 0.14,
        output: 0.14,
      },
    },
    "novita/qwen/qwen2.5-vl-72b-instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "novita/sao10k/l3-70b-euryale-v2.1": {
      standard: {
        input: 1.48,
        output: 1.48,
      },
    },
    "novita/baidu/ernie-4.5-21B-a3b-thinking": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "novita/sao10k/l3-8b-lunaris": {
      standard: {
        input: 0.049999999999999996,
        output: 0.049999999999999996,
      },
    },
    "novita/baichuan/baichuan-m2-32b": {
      standard: {
        input: 0.07,
        output: 0.07,
      },
    },
    "novita/baidu/ernie-4.5-vl-424b-a47b": {
      standard: {
        input: 0.42,
        output: 1.25,
      },
    },
    "novita/baidu/ernie-4.5-300b-a47b-paddle": {
      standard: {
        input: 0.28,
        output: 1.1,
      },
    },
    "novita/deepseek/deepseek-prover-v2-671b": {
      standard: {
        input: 0.7,
        output: 2.5,
      },
    },
    "novita/qwen/qwen3-32b-fp8": {
      standard: {
        input: 0.09999999999999999,
        output: 0.44999999999999996,
      },
    },
    "novita/qwen/qwen3-30b-a3b-fp8": {
      standard: {
        input: 0.09,
        output: 0.44999999999999996,
      },
    },
    "novita/google/gemma-3-27b-it": {
      standard: {
        input: 0.119,
        output: 0.19999999999999998,
      },
    },
    "novita/deepseek/deepseek-v3-turbo": {
      standard: {
        input: 0.39999999999999997,
        output: 1.3,
      },
    },
    "novita/deepseek/deepseek-r1-turbo": {
      standard: {
        input: 0.7,
        output: 2.5,
      },
    },
    "novita/Sao10K/L3-8B-Stheno-v3.2": {
      standard: {
        input: 0.049999999999999996,
        output: 0.049999999999999996,
      },
    },
    "novita/gryphe/mythomax-l2-13b": {
      standard: {
        input: 0.09,
        output: 0.09,
      },
    },
    "novita/baidu/ernie-4.5-vl-28b-a3b-thinking": {
      standard: {
        input: 0.39,
        output: 0.39,
      },
    },
    "novita/qwen/qwen3-vl-8b-instruct": {
      standard: {
        input: 0.08,
        output: 0.5,
      },
    },
    "novita/zai-org/glm-4.5-air": {
      standard: {
        input: 0.13,
        output: 0.85,
        cacheRead: 0.024999999999999998,
      },
    },
    "novita/qwen/qwen3-vl-30b-a3b-instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7,
      },
    },
    "novita/qwen/qwen3-vl-30b-a3b-thinking": {
      standard: {
        input: 0.19999999999999998,
        output: 1,
      },
    },
    "novita/qwen/qwen3-omni-30b-a3b-thinking": {
      standard: {
        input: 0.25,
        output: 0.9700000000000001,
      },
    },
    "novita/qwen/qwen3-omni-30b-a3b-instruct": {
      standard: {
        input: 0.25,
        output: 0.9700000000000001,
      },
    },
    "novita/qwen/qwen-mt-plus": {
      standard: {
        input: 0.25,
        output: 0.75,
      },
    },
    "novita/baidu/ernie-4.5-vl-28b-a3b": {
      standard: {
        input: 0.14,
        output: 0.56,
      },
    },
    "novita/baidu/ernie-4.5-21B-a3b": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "novita/qwen/qwen3-8b-fp8": {
      standard: {
        input: 0.035,
        output: 0.13799999999999998,
      },
    },
    "novita/qwen/qwen3-4b-fp8": {
      standard: {
        input: 0.03,
        output: 0.03,
      },
    },
    "novita/qwen/qwen2.5-7b-instruct": {
      standard: {
        input: 0.07,
        output: 0.07,
      },
    },
    "novita/meta-llama/llama-3.2-3b-instruct": {
      standard: {
        input: 0.03,
        output: 0.049999999999999996,
      },
    },
    "novita/sao10k/l31-70b-euryale-v2.2": {
      standard: {
        input: 1.48,
        output: 1.48,
      },
    },
    "novita/qwen/qwen3-embedding-0.6b": {
      standard: {
        input: 0.07,
        output: 0,
      },
    },
    "novita/qwen/qwen3-embedding-8b": {
      standard: {
        input: 0.07,
        output: 0,
      },
    },
    "novita/baai/bge-m3": {
      standard: {
        input: 0.01,
        output: 0.01,
      },
    },
    "novita/qwen/qwen3-reranker-8b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.049999999999999996,
      },
    },
    "novita/baai/bge-reranker-v2-m3": {
      standard: {
        input: 0.01,
        output: 0.01,
      },
    },
    "llamagate/llama-3.1-8b": {
      standard: {
        input: 0.03,
        output: 0.049999999999999996,
      },
    },
    "llamagate/llama-3.2-3b": {
      standard: {
        input: 0.04,
        output: 0.08,
      },
    },
    "llamagate/mistral-7b-v0.3": {
      standard: {
        input: 0.09999999999999999,
        output: 0.15,
      },
    },
    "llamagate/qwen3-8b": {
      standard: {
        input: 0.04,
        output: 0.14,
      },
    },
    "llamagate/dolphin3-8b": {
      standard: {
        input: 0.08,
        output: 0.15,
      },
    },
    "llamagate/deepseek-r1-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "llamagate/deepseek-r1-7b-qwen": {
      standard: {
        input: 0.08,
        output: 0.15,
      },
    },
    "llamagate/openthinker-7b": {
      standard: {
        input: 0.08,
        output: 0.15,
      },
    },
    "llamagate/qwen2.5-coder-7b": {
      standard: {
        input: 0.06,
        output: 0.12,
      },
    },
    "llamagate/deepseek-coder-6.7b": {
      standard: {
        input: 0.06,
        output: 0.12,
      },
    },
    "llamagate/codellama-7b": {
      standard: {
        input: 0.06,
        output: 0.12,
      },
    },
    "llamagate/qwen3-vl-8b": {
      standard: {
        input: 0.15,
        output: 0.55,
      },
    },
    "llamagate/llava-7b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "llamagate/gemma3-4b": {
      standard: {
        input: 0.03,
        output: 0.08,
      },
    },
    "llamagate/nomic-embed-text": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "llamagate/qwen3-embedding-8b": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "libertai/hermes-3-8b-tee": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "libertai/gemma-4-31b-it": {
      standard: {
        input: 0.15,
        output: 0.39999999999999997,
      },
    },
    "libertai/gemma-4-31b-it-thinking": {
      standard: {
        input: 0.15,
        output: 0.39999999999999997,
      },
    },
    "libertai/qwen3.6-27b": {
      standard: {
        input: 0.15,
        output: 0.5,
      },
    },
    "libertai/qwen3.6-27b-thinking": {
      standard: {
        input: 0.15,
        output: 0.5,
      },
    },
    "libertai/qwen3.6-35b-a3b": {
      standard: {
        input: 0.15,
        output: 0.5,
      },
    },
    "libertai/qwen3.6-35b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 0.5,
      },
    },
    "libertai/qwen3.5-122b-a10b": {
      standard: {
        input: 0.25,
        output: 1.75,
      },
    },
    "libertai/qwen3.5-122b-a10b-thinking": {
      standard: {
        input: 0.25,
        output: 1.75,
      },
    },
    "libertai/deepseek-v4-flash": {
      standard: {
        input: 0.25,
        output: 1.75,
      },
    },
    "libertai/deepseek-v4-flash-thinking": {
      standard: {
        input: 0.25,
        output: 1.75,
      },
    },
    "libertai/bge-m3": {
      standard: {
        input: 0.01,
        output: 0,
      },
    },
    "sarvam/sarvam-m": {
      standard: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cacheWriteOneHour: 0,
      },
    },
    "gpt-4o-mini-tts-2025-12-15": {
      standard: {
        input: 0.6,
        output: 10,
      },
    },
    "gpt-4o-mini-transcribe-2025-03-20": {
      standard: {
        input: 1.25,
        output: 5,
      },
    },
    "gpt-4o-mini-transcribe-2025-12-15": {
      standard: {
        input: 1.25,
        output: 5,
      },
    },
    "gpt-5-search-api": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-5-search-api-2025-10-14": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "gpt-realtime-mini-2025-12-15": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "chatgpt-image-latest": {
      standard: {
        input: 5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "gemini-2.0-flash-exp-image-generation": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemini-2.0-flash-exp-image-generation": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini-2.5-flash-native-audio-latest": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini-2.5-flash-native-audio-preview-09-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini-2.5-flash-native-audio-preview-12-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini-3.1-flash-live-preview": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "gemini-3.8-live": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "gemini-3.8-live-extended-thinking": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "gemini/gemini-2.5-flash-native-audio-latest": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini/gemini-2.5-flash-native-audio-preview-09-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini/gemini-2.5-flash-native-audio-preview-12-2025": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "gemini/gemini-3.1-flash-live-preview": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "gemini/gemini-3.1-flash-tts-preview": {
      standard: {
        input: 1,
        output: 20,
      },
    },
    "gemini/gemini-3.8-flash-tts": {
      standard: {
        input: 0.5,
        output: 9,
        cacheRead: 0.125,
      },
    },
    "gemini/gemini-3.8-flash-lite-tts": {
      standard: {
        input: 0.5,
        output: 6,
        cacheRead: 0.125,
      },
    },
    "gemini-2.5-flash-preview-tts": {
      standard: {
        input: 0.5,
        output: 10,
      },
    },
    "gemini-flash-latest": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        reasoning: 3.75,
      },
    },
    "gemini-flash-lite-latest": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "gemini-pro-latest": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini/gemini-pro-latest": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "gemini-exp-1206": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        reasoning: 2.5,
      },
    },
    "vertex_ai/claude-sonnet-5@default": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "vertex_ai/claude-sonnet-4-6@default": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        cacheWriteOneHour: 6,
      },
    },
    "bedrock_mantle/openai.gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "bedrock_mantle/openai.gpt-oss-20b": {
      standard: {
        input: 0.07,
        output: 0.3,
      },
    },
    "bedrock_mantle/openai.gpt-oss-safeguard-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "bedrock_mantle/openai.gpt-oss-safeguard-20b": {
      standard: {
        input: 0.07,
        output: 0.19999999999999998,
      },
    },
    "bedrock_mantle/openai.gpt-5.6-sol": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "bedrock_mantle/openai.gpt-5.6-terra": {
      standard: {
        input: 2.2,
        output: 13.200000000000001,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "bedrock_mantle/openai.gpt-5.6-cyber": {
      standard: {
        input: 13.75,
        output: 82.5,
        cacheRead: 1.375,
        cacheWrite: 17.1875,
      },
    },
    "bedrock_mantle/openai.gpt-daybreak-blue-5.6-sol": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "bedrock_mantle/openai.gpt-5.6-luna": {
      standard: {
        input: 0.22,
        output: 1.32,
        cacheRead: 0.022,
        cacheWrite: 0.275,
      },
    },
    "us.openai.gpt-5.6-sol": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.44,
        cacheWrite: 5.5,
      },
    },
    "global.openai.gpt-5.6-sol": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "us.openai.gpt-5.6-terra": {
      standard: {
        input: 2.2,
        output: 13.200000000000001,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "global.openai.gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "us.openai.gpt-5.6-luna": {
      standard: {
        input: 0.22,
        output: 1.32,
        cacheRead: 0.022,
        cacheWrite: 0.275,
      },
    },
    "us.openai.gpt-5.4": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "global.openai.gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "us.openai.gpt-5.5": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "global.openai.gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "global.openai.gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "bedrock_mantle/openai.gpt-6-astra": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
      },
    },
    "bedrock_mantle/openai.gpt-6-sol": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "bedrock_mantle/openai.gpt-6-luna": {
      standard: {
        input: 0.11,
        output: 0.55,
        cacheRead: 0.011,
        cacheWrite: 0.1375,
      },
    },
    "us.openai.gpt-6-astra": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
      },
    },
    "us.openai.gpt-6-sol": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
      },
    },
    "us.openai.gpt-6-luna": {
      standard: {
        input: 0.11,
        output: 0.55,
        cacheRead: 0.011,
        cacheWrite: 0.1375,
      },
    },
    "global.openai.gpt-6-astra": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "openai.gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "global.openai.gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openai.gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "global.openai.gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "bedrock_mantle/openai.gpt-5.5": {
      standard: {
        input: 5.5,
        output: 33,
        cacheRead: 0.55,
      },
    },
    "bedrock_mantle/openai.gpt-5.4": {
      standard: {
        input: 2.75,
        output: 16.5,
        cacheRead: 0.275,
      },
    },
    "bedrock_mantle/google.gemma-4-31b": {
      standard: {
        input: 0.14,
        output: 0.39999999999999997,
      },
    },
    "bedrock_mantle/google.gemma-4-26b-a4b": {
      standard: {
        input: 0.13,
        output: 0.39999999999999997,
      },
    },
    "bedrock_mantle/google.gemma-4-e2b": {
      standard: {
        input: 0.04,
        output: 0.08,
      },
    },
    "bedrock_mantle/xai.grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "bedrock_mantle/xai.grok-4.6": {
      standard: {
        input: 2.2,
        output: 6.6000000000000005,
        cacheRead: 0.55,
      },
    },
    "bedrock_mantle/anthropic.claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "bedrock_mantle/anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "bedrock_mantle/anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "us.xai.grok-4.6": {
      standard: {
        input: 2.2,
        output: 6.6000000000000005,
        cacheRead: 0.55,
      },
    },
    "global.xai.grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "volcengine/doubao-seed-2-1-pro-260628": {
      standard: {
        input: 0.8625,
        output: 4.3125,
        cacheRead: 0.1725,
      },
    },
    "volcengine/doubao-seed-2-1-turbo-260628": {
      standard: {
        input: 0.43125,
        output: 2.15625,
        cacheRead: 0.08625,
      },
    },
    "bedrock/us-east-1/zai.glm-5": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
      },
    },
    "bedrock/us-west-2/zai.glm-5": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.2,
        output: 6,
        cacheRead: 0.12,
        cacheWrite: 1.5,
        cacheWriteOneHour: 2.4,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-haiku-4-5-20251001-v1:0": {
      standard: {
        input: 1.2,
        output: 6,
        cacheRead: 0.12,
        cacheWrite: 1.5,
        cacheWriteOneHour: 2.4,
      },
    },
    "snowflake/claude-sonnet-4-5": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "snowflake/claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "snowflake/claude-4-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "snowflake/claude-4-opus": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "snowflake/claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
      },
    },
    "snowflake/claude-3-7-sonnet": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "snowflake/openai-gpt-4.1": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "snowflake/openai-gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "snowflake/openai-gpt-5-mini": {
      standard: {
        input: 0.3,
        output: 1.2,
      },
    },
    "snowflake/openai-gpt-5-nano": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "snowflake/llama4-maverick": {
      standard: {
        input: 0.24,
        output: 0.9700000000000001,
      },
    },
    "snowflake/snowflake-arctic-embed-l-v2.0": {
      standard: {
        input: 0.07,
        output: 0,
      },
    },
    "snowflake/snowflake-arctic-embed-m-v2.0": {
      standard: {
        input: 0.07,
        output: 0,
      },
    },
    "tensormesh/Qwen/Qwen3.5-397B-A17B-FP8": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
        cacheRead: 0,
      },
    },
    "tensormesh/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
        cacheRead: 0,
      },
    },
    "tensormesh/Qwen/Qwen3.6-27B-FP8": {
      standard: {
        input: 0.32,
        output: 3.1999999999999997,
        cacheRead: 0,
      },
    },
    "tensormesh/lukealonso/GLM-5.1-NVFP4-MTP": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0,
      },
    },
    "tensormesh/deepseek-ai/DeepSeek-V4-Flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0,
      },
    },
    "tensormesh/moonshotai/Kimi-K2.6": {
      standard: {
        input: 0.96,
        output: 4,
        cacheRead: 0,
      },
    },
    "tensormesh/MiniMaxAI/MiniMax-M2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0,
      },
    },
    "tensormesh/google/gemma-4-31B-it": {
      standard: {
        input: 0.14,
        output: 0.56,
        cacheRead: 0,
      },
    },
    "tensormesh/openai/gpt-oss-120b": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0,
      },
    },
    "tensormesh/openai/gpt-oss-20b": {
      standard: {
        input: 0.07,
        output: 0.28,
        cacheRead: 0,
      },
    },
    "deepseek-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek-v4-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek-v4-pro": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.044,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-v4-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: 0,
      },
    },
    "deepseek/deepseek-v4-pro": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.044,
        cacheWrite: 0,
      },
    },
    "tencent/deepseek-v4-pro": {
      standard: {
        input: 0.435,
        output: 0.87,
        cacheRead: 0.003625,
        cacheWrite: 0,
      },
    },
    "tencent/deepseek-v4-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.0028,
        cacheWrite: 0,
      },
    },
    "tencent/minimax-m3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
        cacheWrite: 0,
      },
    },
    "cognition/swe-1.6": {
      standard: {
        input: 0.5,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "cognition/swe-1.7": {
      standard: {
        input: 0.5,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "cognition/swe-1.7-lightning": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 1,
      },
    },
    "pinstripes/ps/glm-4.5-air": {
      standard: {
        input: 0.125,
        output: 0.44999999999999996,
      },
    },
    "pinstripes/ps/qwen3.6-35b-a3b": {
      standard: {
        input: 0.14,
        output: 0.44999999999999996,
      },
    },
    "pinstripes/ps/qwen3-30b-a3b": {
      standard: {
        input: 0.09,
        output: 0.19999999999999998,
      },
    },
    "pinstripes/ps/qwen3-coder-30b-a3b": {
      standard: {
        input: 0.3,
        output: 0.6,
      },
    },
    "pinstripes/ps/deepseek-v4-flash": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "pinstripes/ps/minimax-m2.7": {
      standard: {
        input: 0.255,
        output: 0.55,
      },
    },
    "darkbloom/gemma-4-26b": {
      standard: {
        input: 0.03,
        output: 0.165,
      },
    },
    "darkbloom/gpt-oss-20b": {
      standard: {
        input: 0.0145,
        output: 0.07,
      },
    },
    "xai/grok-4.20-0309-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-0309": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-build-0.1": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "claude-mythos-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "claude-mythos-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "claude-mythos-preview": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "gemini/gemini-robotics-er-2-streaming-preview": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "mistral/mistral-small-2603": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "mistral/labs-leanstral-1-5": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "mistral/mistral-moderation-2603": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/gemini-3.5-live-translate-preview": {
      standard: {
        input: 3.5,
        output: 21,
      },
    },
    "gemini/gemini-3.5-transcribe": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "gemini/gemini-3.5-transcribe-live": {
      standard: {
        input: 3.5,
        output: 21,
      },
    },
    "vertex_ai/gemini-3.5-transcribe-preview": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "vertex_ai/gemini-3.5-transcribe-live-preview": {
      standard: {
        input: 3.5,
        output: 21,
      },
    },
    "vertex_ai/gemini-3.5-live-translate-preview": {
      standard: {
        input: 3.5,
        output: 21,
      },
    },
    "perplexity/pplx-embed-context-v1-0.6b": {
      standard: {
        input: 0.008,
        output: 0,
      },
    },
    "perplexity/pplx-embed-context-v1-4b": {
      standard: {
        input: 0.049999999999999996,
        output: 0,
      },
    },
    "voyage/voyage-4-large": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-4": {
      standard: {
        input: 0.06,
        output: 0,
      },
    },
    "voyage/voyage-4-lite": {
      standard: {
        input: 0.02,
        output: 0,
      },
    },
    "voyage/voyage-code-4": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-context-4": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "voyage/voyage-multimodal-3.5": {
      standard: {
        input: 0.12,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4-flash-0731": {
      standard: {
        input: 0.22,
        output: 0.66,
        cacheRead: 0.007,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-us": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
        cacheRead: 0.009,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.22,
        output: 0.66,
        cacheRead: 0.007,
      },
    },
    "fireworks_ai/accounts/fireworks/models/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/deepseek-v4-flash-0731": {
      standard: {
        input: 0.22,
        output: 0.66,
        cacheRead: 0.007,
      },
    },
    "fireworks_ai/deepseek-v4p1-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "fireworks_ai/deepseek-v4p1-flash-us": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
        cacheRead: 0.009,
      },
    },
    "fireworks_ai/deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.22,
        output: 0.66,
        cacheRead: 0.007,
      },
    },
    "fireworks_ai/glm-5p2-fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "fireworks_ai/glm-5p2-fast-us": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "fireworks_ai/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "fireworks_ai/kimi-k3-fast": {
      standard: {
        input: 4.5,
        output: 22.5,
        cacheRead: 0.44999999999999996,
      },
    },
    "fireworks_ai/kimi-k3-us": {
      standard: {
        input: 4.5,
        output: 22.5,
        cacheRead: 0.44999999999999996,
      },
    },
    "fireworks_ai/qwen3p8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "fireworks_ai/muse-glimmer-30b": {
      standard: {
        input: 0.35,
        output: 1.5,
        cacheRead: 0.04,
      },
    },
    "fireworks_ai/nemotron-lightning-3p5-30b-a3b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.01,
      },
    },
    "fireworks_ai/nemotron-3-ultra-nvfp4": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.12,
      },
    },
    "fireworks_ai/accounts/fireworks/models/muse-glimmer-30b": {
      standard: {
        input: 0.35,
        output: 1.5,
        cacheRead: 0.04,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.01,
      },
    },
    "fireworks_ai/accounts/fireworks/models/nemotron-3-ultra-nvfp4": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.12,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3p8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p2-fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p2-fast-us": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/kimi-k3-fast": {
      standard: {
        input: 4.5,
        output: 22.5,
        cacheRead: 0.44999999999999996,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/kimi-k3-us": {
      standard: {
        input: 4.5,
        output: 22.5,
        cacheRead: 0.44999999999999996,
      },
    },
    "novita/zai-org/glm-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "novita/deepseek/deepseek-v4-pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.132,
      },
    },
    "novita/moonshotai/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "novita/tencent/hy3": {
      standard: {
        input: 0.14,
        output: 0.58,
        cacheRead: 0.035,
      },
    },
    "novita/zai-org/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "novita/moonshotai/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "novita/deepseek/deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.44,
        output: 1.32,
        cacheRead: 0.028,
      },
    },
    "novita/deepseek/deepseek-v4-flash-0731": {
      standard: {
        input: 0.44,
        output: 1.32,
        cacheRead: 0.028,
      },
    },
    "novita/mindai/macaron-v1-venti": {
      standard: {
        input: 1.5,
        output: 4.5,
        cacheRead: 0.3,
      },
    },
    "novita/minimax/minimax-m3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "novita/deepseek/deepseek-v4-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.028,
      },
    },
    "novita/deepseek/deepseek-v4-pro": {
      standard: {
        input: 1.6,
        output: 3.2,
        cacheRead: 0.135,
      },
    },
    "novita/inclusionai/ling-3.0-flash-fast": {
      standard: {
        input: 0.06,
        output: 0.18,
        cacheRead: 0.012,
      },
    },
    "novita/qwen/qwen3.8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "novita/inclusionai/ling-3.0-flash": {
      standard: {
        input: 0.06,
        output: 0.18,
        cacheRead: 0.012,
      },
    },
    "novita/mindai/macaron-v1-tall": {
      standard: {
        input: 0.45,
        output: 2.6,
        cacheRead: 0.08,
      },
    },
    "novita/stepfun/step-3.7-flash": {
      standard: {
        input: 0.2,
        output: 1.15,
        cacheRead: 0.04,
      },
    },
    "novita/nvidia/nemotron-3-nano-30b-a3b": {
      standard: {
        input: 0.05,
        output: 0.2,
      },
    },
    "novita/baidu/cobuddy": {
      standard: {
        input: 0.28,
        output: 1.13,
        cacheRead: 0.07,
      },
    },
    "novita/xiaomimimo/mimo-v2.5": {
      standard: {
        input: 0.168,
        output: 0.336,
        cacheRead: 0.0034,
      },
    },
    "novita/qwen/qwen3.7-max": {
      standard: {
        input: 1.25,
        output: 3.75,
        cacheRead: 0.25,
      },
    },
    "novita/xiaomimimo/mimo-v2.5-pro": {
      standard: {
        input: 0.522,
        output: 1.044,
        cacheRead: 0.0043,
      },
    },
    "novita/qwen/qwen3.6-27b": {
      standard: {
        input: 0.6,
        output: 3.6,
      },
    },
    "novita/moonshotai/kimi-k2.6": {
      standard: {
        input: 0.8,
        output: 3.4,
        cacheRead: 0.16,
      },
    },
    "novita/zai-org/glm-5.1": {
      standard: {
        input: 1.38,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "novita/minimax/minimax-m2.7-highspeed": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.06,
      },
    },
    "novita/zai-org/glm-5v-turbo": {
      standard: {
        input: 1.2,
        output: 4,
        cacheRead: 0.24,
      },
    },
    "novita/google/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.13,
        output: 0.4,
      },
    },
    "novita/google/gemma-4-31b-it": {
      standard: {
        input: 0.14,
        output: 0.4,
      },
    },
    "novita/zai-org/glm-5-turbo": {
      standard: {
        input: 1.2,
        output: 4,
        cacheRead: 0.24,
      },
    },
    "novita/minimax/minimax-m2.7": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "novita/minimax/minimax-m2.5-highspeed": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.03,
      },
    },
    "novita/qwen/qwen3.5-27b": {
      standard: {
        input: 0.3,
        output: 2.4,
      },
    },
    "novita/qwen/qwen3.5-122b-a10b": {
      standard: {
        input: 0.4,
        output: 3.2,
      },
    },
    "novita/qwen/qwen3.5-35b-a3b": {
      standard: {
        input: 0.25,
        output: 2,
      },
    },
    "novita/qwen/qwen3.5-397b-a17b": {
      standard: {
        input: 0.6,
        output: 3.6,
      },
    },
    "novita/minimax/minimax-m2.5": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "novita/zai-org/glm-5": {
      standard: {
        input: 1,
        output: 3.2,
        cacheRead: 0.2,
      },
    },
    "novita/qwen/qwen3-coder-next": {
      standard: {
        input: 0.2,
        output: 1.5,
      },
    },
    "novita/deepseek/deepseek-ocr-2": {
      standard: {
        input: 0.03,
        output: 0.03,
      },
    },
    "novita/moonshotai/kimi-k2.5": {
      standard: {
        input: 0.6,
        output: 3,
        cacheRead: 0.1,
      },
    },
    "novita/zai-org/glm-4.7-h": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
      },
    },
    "novita/zai-org/glm-4.7-flash": {
      standard: {
        input: 0.07,
        output: 0.4,
        cacheRead: 0.01,
      },
    },
    "novita/qwen/qwen3.6-35b-a3b": {
      standard: {
        input: 0.248,
        output: 1.485,
      },
    },
    "novita/deepseek/deepseek_v3": {
      standard: {
        input: 0.89,
        output: 0.89,
      },
    },
    "novita/deepseek/deepseek-r1": {
      standard: {
        input: 4,
        output: 4,
      },
    },
    "novita/deepseek/deepseek-v3/community": {
      standard: {
        input: 0.89,
        output: 0.89,
      },
    },
    "novita/deepseek/deepseek-r1/community": {
      standard: {
        input: 4,
        output: 4,
      },
    },
    "novita/thudm/glm-4-32b-0414": {
      standard: {
        input: 0.55,
        output: 1.66,
      },
    },
    "novita/meta-llama/llama-3.2-1b-instruct": {
      standard: {
        input: 0.02,
        output: 0.02,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V4-Flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.07,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.13,
        output: 0.28,
        cacheRead: 0.07,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V4-Pro": {
      standard: {
        input: 1.15,
        output: 2.5500000000000003,
        cacheRead: 0.19999999999999998,
      },
    },
    "wandb/google/gemma-4-31B-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.33999999999999997,
      },
    },
    "wandb/ibm-granite/granite-4.1-8b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "wandb/JetBrains/Mellum2-12B-A2.5B-Instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "wandb/meta-llama/Llama-3.1-70B-Instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "wandb/MiniMaxAI/MiniMax-M3": {
      standard: {
        input: 0.22999999999999998,
        output: 0.96,
        cacheRead: 0.049999999999999996,
      },
    },
    "wandb/moonshotai/Kimi-K2.7-Code": {
      standard: {
        input: 0.71,
        output: 3.5,
        cacheRead: 0.15,
      },
    },
    "wandb/moonshotai/Kimi-K2.6": {
      standard: {
        input: 0.65,
        output: 3.41,
        cacheRead: 0.15,
      },
    },
    "wandb/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B": {
      standard: {
        input: 0.07,
        output: 0.19999999999999998,
        cacheRead: 0.04,
      },
    },
    "wandb/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B": {
      standard: {
        input: 0.5,
        output: 2.1500000000000004,
        cacheRead: 0.09999999999999999,
      },
    },
    "wandb/OpenPipe/Qwen3-14B-Instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.22,
      },
    },
    "wandb/Qwen/Qwen3.8-27B": {
      standard: {
        input: 0.39999999999999997,
        output: 3,
        cacheRead: 0.15,
      },
    },
    "wandb/Qwen/Qwen3.6-35B-A3B": {
      standard: {
        input: 0.25,
        output: 1.25,
      },
    },
    "wandb/Qwen/Qwen3.6-27B": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
        cacheRead: 0.12,
      },
    },
    "wandb/Qwen/Qwen3.5-35B-A3B": {
      standard: {
        input: 0.25,
        output: 1.25,
      },
    },
    "wandb/Qwen/Qwen3-30B-A3B-Instruct-2507": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 1.31,
        output: 3.9600000000000004,
        cacheRead: 0.044,
      },
    },
    "wandb/ibm-granite/granite-4.2-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.15,
        cacheRead: 0.049999999999999996,
      },
    },
    "wandb/zai-org/GLM-5.2": {
      standard: {
        input: 0.76,
        output: 2.42,
        cacheRead: 0.14,
      },
    },
    "deepinfra/openai/gpt-oss-120b-Turbo": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "deepinfra/MiniMaxAI/MiniMax-M2.7": {
      standard: {
        input: 0.25,
        output: 1,
        cacheRead: 0.049999999999999996,
      },
    },
    "deepinfra/Qwen/Qwen3.8-27B": {
      standard: {
        input: 0.39999999999999997,
        output: 3,
        cacheRead: 0.04,
      },
    },
    "deepinfra/google/gemma-4-31B-it-Ultra": {
      standard: {
        input: 0.27,
        output: 0.76,
      },
    },
    "deepinfra/moonshotai/Kimi-K2.5": {
      standard: {
        input: 0.44999999999999996,
        output: 2.25,
        cacheRead: 0.07,
      },
    },
    "deepinfra/zai-org/GLM-4.7-Flash": {
      standard: {
        input: 0.06,
        output: 0.39999999999999997,
        cacheRead: 0.01,
      },
    },
    "deepinfra/zai-org/GLM-4.6": {
      standard: {
        input: 0.5,
        output: 2,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/anthropic/claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "deepinfra/anthropic/claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "deepinfra/google/gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
      },
    },
    "deepinfra/XiaomiMiMo/MiMo-V2.5": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.08,
      },
    },
    "deepinfra/Qwen/Qwen3-Max": {
      standard: {
        input: 1.2,
        output: 6,
        cacheRead: 0.24,
      },
    },
    "deepinfra/google/gemma-4-31B-it-turbo": {
      standard: {
        input: 0.09,
        output: 0.33999999999999997,
        cacheRead: 0.049999999999999996,
      },
    },
    "deepinfra/thinkingmachines/Inkling-Small": {
      standard: {
        input: 0.44999999999999996,
        output: 1.2,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/meta-models/Muse-Glimmer-30B": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.04,
      },
    },
    "deepinfra/Qwen/Qwen3-Max-Thinking": {
      standard: {
        input: 1.2,
        output: 6,
        cacheRead: 0.24,
      },
    },
    "deepinfra/Qwen/Qwen3-VL-235B-A22B-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.88,
        cacheRead: 0.11,
      },
    },
    "deepinfra/Qwen/Qwen3-VL-30B-A3B-Instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "deepinfra/Qwen/Qwen3.5-27B": {
      standard: {
        input: 0.26,
        output: 2.6,
      },
    },
    "deepinfra/Qwen/Qwen3.6-35B-A3B": {
      standard: {
        input: 0.09999999999999999,
        output: 0.95,
      },
    },
    "deepinfra/nvidia/Nemotron-Content-Safety-3.5": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "deepinfra/anthropic/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "deepinfra/thinkingmachines/Inkling": {
      standard: {
        input: 0.95,
        output: 4.05,
        cacheRead: 0.16,
      },
    },
    "deepinfra/moonshotai/Kimi-K2.6": {
      standard: {
        input: 0.75,
        output: 3.5,
        cacheRead: 0.15,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 1.3,
        output: 2.6,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/Qwen/Qwen3.7-Max": {
      standard: {
        input: 2.5,
        output: 7.5,
        cacheRead: 0.5,
      },
    },
    "deepinfra/ByteDance/Seed-2.0-mini": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.02,
      },
    },
    "deepinfra/Qwen/Qwen3.8-2.4T-A95B": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "deepinfra/MiniMaxAI/MiniMax-M3": {
      standard: {
        input: 0.28,
        output: 1.1,
        cacheRead: 0.056,
      },
    },
    "deepinfra/google/gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
      },
    },
    "deepinfra/google/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
      },
    },
    "deepinfra/inclusionAI/Ling-3.0-flash": {
      standard: {
        input: 0.06,
        output: 0.18,
        cacheRead: 0.012,
      },
    },
    "deepinfra/stepfun-ai/Step-3.7-Flash": {
      standard: {
        input: 0.19999999999999998,
        output: 1.15,
        cacheRead: 0.04,
      },
    },
    "deepinfra/Qwen/Qwen3.5-35B-A3B": {
      standard: {
        input: 0.14,
        output: 1,
        cacheRead: 0.049999999999999996,
      },
    },
    "deepinfra/ByteDance/Seed-1.8": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.049999999999999996,
      },
    },
    "deepinfra/tencent/Hy3": {
      standard: {
        input: 0.14,
        output: 0.58,
        cacheRead: 0.035,
      },
    },
    "deepinfra/ByteDance/Seed-2.0-code": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/ByteDance/Seed-2.0-pro": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/zai-org/GLM-5": {
      standard: {
        input: 0.6,
        output: 2.08,
        cacheRead: 0.12,
      },
    },
    "deepinfra/nvidia/Nemotron-3-Nano-30B-A3B": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.024999999999999998,
      },
    },
    "deepinfra/moonshotai/Kimi-K2.7-Code": {
      standard: {
        input: 0.6799999999999999,
        output: 3.4,
        cacheRead: 0.136,
      },
    },
    "deepinfra/anthropic/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
      },
    },
    "deepinfra/Qwen/Qwen3.5-397B-A17B": {
      standard: {
        input: 0.44999999999999996,
        output: 3,
        cacheRead: 0.22,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.08,
        output: 0.18,
        cacheRead: 0.016,
      },
    },
    "deepinfra/google/gemma-4-E4B-it": {
      standard: {
        input: 0.02,
        output: 0.09999999999999999,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V3.2": {
      standard: {
        input: 0.26,
        output: 0.38,
        cacheRead: 0.13,
      },
    },
    "deepinfra/Qwen/Qwen3.8-Max": {
      standard: {
        input: 1.6500000000000001,
        output: 4.951,
        cacheRead: 0.206,
      },
    },
    "deepinfra/anthropic/claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
      },
    },
    "deepinfra/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B": {
      standard: {
        input: 0.5,
        output: 2.2,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/Qwen/Qwen3.5-122B-A10B": {
      standard: {
        input: 0.29,
        output: 2.4,
      },
    },
    "deepinfra/zai-org/GLM-5.1": {
      standard: {
        input: 1.0499999999999998,
        output: 3.5,
        cacheRead: 0.205,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V4-Pro": {
      standard: {
        input: 1.3,
        output: 2.6,
        cacheRead: 0.09999999999999999,
      },
    },
    "deepinfra/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B": {
      standard: {
        input: 0.08499999999999999,
        output: 0.39999999999999997,
      },
    },
    "deepinfra/zai-org/GLM-5.2": {
      standard: {
        input: 0.75,
        output: 2.4,
        cacheRead: 0.14,
      },
    },
    "deepinfra/moonshotai/Kimi-K3": {
      standard: {
        input: 2.8499999999999996,
        output: 14.25,
        cacheRead: 0.28500000000000003,
      },
    },
    "deepinfra/anthropic/claude-opus-4-7": {
      standard: {
        input: 5,
        output: 25,
      },
    },
    "deepinfra/Qwen/Qwen3.6-27B": {
      standard: {
        input: 0.32,
        output: 3.1999999999999997,
      },
    },
    "deepinfra/google/gemma-4-26B-A4B-it": {
      standard: {
        input: 0.07,
        output: 0.33999999999999997,
      },
    },
    "deepinfra/google/gemini-3.1-pro": {
      standard: {
        input: 2,
        output: 12,
      },
    },
    "deepinfra/XiaomiMiMo/MiMo-V2.5-Pro": {
      standard: {
        input: 1,
        output: 3,
        cacheRead: 0.19999999999999998,
      },
    },
    "deepinfra/anthropic/claude-haiku-4-5": {
      standard: {
        input: 1,
        output: 5,
      },
    },
    "deepinfra/deepseek-ai/DeepSeek-V4-Flash": {
      standard: {
        input: 0.09,
        output: 0.18,
        cacheRead: 0.018,
      },
    },
    "deepinfra/openai/gpt-oss-120b-Ultra": {
      standard: {
        input: 0.19999999999999998,
        output: 0.95,
      },
    },
    "deepinfra/Qwen/Qwen3.5-9B": {
      standard: {
        input: 0.09999999999999999,
        output: 0.15,
      },
    },
    "deepinfra/MiniMaxAI/MiniMax-M2.7-Turbo": {
      standard: {
        input: 0.38,
        output: 1.7,
        cacheRead: 0.07,
      },
    },
    "deepinfra/zai-org/GLM-4.7": {
      standard: {
        input: 0.39999999999999997,
        output: 1.75,
        cacheRead: 0.08,
      },
    },
    "deepinfra/google/gemma-4-31B-it": {
      standard: {
        input: 0.13,
        output: 0.38,
      },
    },
    "gemini/gemini-omni-1.1-flash": {
      standard: {
        input: 1.5,
        output: 9,
        reasoning: 9,
      },
    },
    "xai/grok-4.20": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-reasoning-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-non-reasoning-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "groq/qwen/qwen3.8-27b": {
      standard: {
        input: 0.7999999999999999,
        output: 4,
      },
    },
    "mistral/mistral-medium-3.5": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-vibe-cli-latest": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-vibe-cli-with-tools": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "mistral/mistral-vibe-cli-fast": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "mistral/mistral-code-latest": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.03,
      },
    },
    "mistral/mistral-code-fim-latest": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.03,
      },
    },
    "mistral/mistral-code-agent-latest": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "mistral/labs-leanstral-1-5-1": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-5p3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p3-us": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.39,
      },
    },
    "fireworks_ai/glm-5p3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "fireworks_ai/glm-5p3-us": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.39,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p3-fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.39,
      },
    },
    "fireworks_ai/glm-5p3-fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.39,
      },
    },
    "fireworks_ai/accounts/fireworks/models/glm-5p3-flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "fireworks_ai/accounts/fireworks/routers/glm-5p3-flash-us": {
      standard: {
        input: 0.22499999999999998,
        output: 0.75,
        cacheRead: 0.045,
      },
    },
    "fireworks_ai/glm-5p3-flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "fireworks_ai/glm-5p3-flash-us": {
      standard: {
        input: 0.22499999999999998,
        output: 0.75,
        cacheRead: 0.045,
      },
    },
    "fireworks_ai/accounts/fireworks/models/inkling": {
      standard: {
        input: 1,
        output: 4.05,
        cacheRead: 0.16999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/qwen3-embedding-8b": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "zai/glm-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
        cacheWrite: 0,
      },
    },
    "together_ai/Qwen/Qwen3.8-Flash": {
      standard: {
        input: 0.09,
        output: 0.28200000000000003,
      },
    },
    "together_ai/moonshotai/Kimi-K2.5-fp4": {
      standard: {
        input: 0.5,
        output: 2.8,
      },
    },
    "together_ai/MiniMaxAI/MiniMax-M2.7": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-R1-0528": {
      standard: {
        input: 3,
        output: 7,
      },
    },
    "together_ai/mistralai/Ministral-3-14B-Instruct-2512": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together_ai/nvidia/NVIDIA-Nemotron-Nano-9B-v2": {
      standard: {
        input: 0.06,
        output: 0.25,
      },
    },
    "together_ai/mistralai/Mistral-7B-Instruct-v0.3": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "cerebras/gemma-4-31b": {
      standard: {
        input: 0.9900000000000001,
        output: 1.49,
      },
    },
    "scaleway/glm-5.2": {
      standard: {
        input: 1.7999999999999998,
        output: 5.5,
      },
    },
    "scaleway/deepseek-v4-flash-0731": {
      standard: {
        input: 0.39999999999999997,
        output: 0.7999999999999999,
        cacheRead: 0.08,
      },
    },
    "azure_ai/kimi-k2.7-code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "azure_ai/deepseek-v4.1-flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "azure_ai/FW-DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.375,
        output: 1.5,
        cacheRead: 0.008,
      },
    },
    "azure_ai/FW-DeepSeek-V4-Flash": {
      standard: {
        input: 0.15,
        output: 0.31,
        cacheRead: 0.03,
      },
    },
    "azure_ai/FW-GLM-5.3": {
      standard: {
        input: 1.75,
        output: 5.5,
        cacheRead: 0.325,
      },
    },
    "azure_ai/FW-GLM-5.3-Flash": {
      standard: {
        input: 0.188,
        output: 0.625,
        cacheRead: 0.038000000000000006,
      },
    },
    "azure_ai/FW-GPT-OSS-120B": {
      standard: {
        input: 0.165,
        output: 0.66,
        cacheRead: 0.082,
      },
    },
    "azure_ai/Cohere-command-a-plus-05-2026": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
      },
    },
    "azure_ai/mistral-medium-3-5": {
      standard: {
        input: 1.5,
        output: 7.5,
      },
    },
    "azure_ai/deepseek-r1": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "azure_ai/deepseek-v3-0324": {
      standard: {
        input: 1.1400000000000001,
        output: 4.5600000000000005,
      },
    },
    "azure_ai/deepseek-v3.1": {
      standard: {
        input: 1.23,
        output: 4.94,
      },
    },
    "azure_ai/grok-3": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "azure_ai/grok-3-mini": {
      standard: {
        input: 0.25,
        output: 1.27,
      },
    },
    "azure_ai/grok-4-fast-non-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
      },
    },
    "azure_ai/grok-4-fast-reasoning": {
      standard: {
        input: 0.19999999999999998,
        output: 0.5,
      },
    },
    "bedrock/us-gov-west-1/nvidia.nemotron-nano-3-30b": {
      standard: {
        input: 0.072,
        output: 0.288,
      },
    },
    "bedrock/us-gov-west-1/nvidia.nemotron-nano-12b-v2": {
      standard: {
        input: 0.24,
        output: 0.72,
      },
    },
    "bedrock/us-gov-west-1/nvidia.nemotron-nano-9b-v2": {
      standard: {
        input: 0.072,
        output: 0.27599999999999997,
      },
    },
    "bedrock/us-gov-west-1/nvidia.nemotron-super-3-120b": {
      standard: {
        input: 0.18,
        output: 0.78,
      },
    },
    "bedrock/us-gov-west-1/openai.gpt-oss-20b-1:0": {
      standard: {
        input: 0.08399999999999999,
        output: 0.36,
      },
    },
    "bedrock/us-gov-west-1/openai.gpt-oss-120b-1:0": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-sonnet-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-opus-4-8": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-opus-5": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-opus-5-5": {
      standard: {
        input: 4.8,
        output: 24,
        cacheRead: 0.24,
        cacheWrite: 6,
        cacheWriteOneHour: 9.6,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-fable-5-1": {
      standard: {
        input: 12,
        output: 60,
        cacheRead: 0.3,
        cacheWrite: 15,
        cacheWriteOneHour: 24,
      },
    },
    "bedrock/us-gov-east-1/nvidia.nemotron-nano-3-30b": {
      standard: {
        input: 0.072,
        output: 0.288,
      },
    },
    "bedrock/us-gov-east-1/nvidia.nemotron-nano-12b-v2": {
      standard: {
        input: 0.24,
        output: 0.72,
      },
    },
    "bedrock/us-gov-east-1/nvidia.nemotron-nano-9b-v2": {
      standard: {
        input: 0.072,
        output: 0.27599999999999997,
      },
    },
    "bedrock/us-gov-east-1/nvidia.nemotron-super-3-120b": {
      standard: {
        input: 0.18,
        output: 0.78,
      },
    },
    "bedrock/us-gov-east-1/openai.gpt-oss-20b-1:0": {
      standard: {
        input: 0.08399999999999999,
        output: 0.36,
      },
    },
    "bedrock/us-gov-east-1/openai.gpt-oss-120b-1:0": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-sonnet-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-opus-4-8": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-opus-5": {
      standard: {
        input: 6,
        output: 30,
        cacheRead: 0.6,
        cacheWrite: 7.5,
        cacheWriteOneHour: 12,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-opus-5-5": {
      standard: {
        input: 4.8,
        output: 24,
        cacheRead: 0.24,
        cacheWrite: 6,
        cacheWriteOneHour: 9.6,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-fable-5-1": {
      standard: {
        input: 12,
        output: 60,
        cacheRead: 0.3,
        cacheWrite: 15,
        cacheWriteOneHour: 24,
      },
    },
    "bedrock_mantle/us-gov-west-1/openai.gpt-5.6-terra": {
      standard: {
        input: 2.64,
        output: 15.840000000000002,
        cacheRead: 0.26399999999999996,
        cacheWrite: 3.3000000000000003,
      },
    },
    "bedrock_mantle/us-gov-west-1/openai.gpt-5.6-luna": {
      standard: {
        input: 0.26399999999999996,
        output: 1.584,
        cacheRead: 0.0264,
        cacheWrite: 0.33,
      },
    },
    "bedrock_mantle/us-gov-west-1/openai.gpt-5.4": {
      standard: {
        input: 3.3000000000000003,
        output: 19.8,
        cacheRead: 0.33,
      },
    },
    "bedrock_mantle/us-gov-west-1/xai.grok-4.3": {
      standard: {
        input: 1.5,
        output: 3,
        cacheRead: 0.24,
      },
    },
    "bedrock_mantle/us-gov-west-1/xai.grok-4.6": {
      standard: {
        input: 2.64,
        output: 7.920000000000001,
        cacheRead: 0.66,
      },
    },
    "bedrock_mantle/us-gov-west-1/google.gemma-4-e2b": {
      standard: {
        input: 0.048,
        output: 0.096,
      },
    },
    "bedrock_mantle/us-gov-west-1/google.gemma-4-26b-a4b": {
      standard: {
        input: 0.156,
        output: 0.48,
      },
    },
    "bedrock_mantle/us-gov-west-1/google.gemma-4-31b": {
      standard: {
        input: 0.16799999999999998,
        output: 0.48,
      },
    },
    "bedrock_mantle/us-gov-west-1/openai.gpt-oss-20b": {
      standard: {
        input: 0.08399999999999999,
        output: 0.36,
      },
    },
    "bedrock_mantle/us-gov-west-1/openai.gpt-oss-120b": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "bedrock_mantle/us-gov-west-1/anthropic.claude-opus-5-5": {
      standard: {
        input: 4.8,
        output: 24,
        cacheRead: 0.24,
        cacheWrite: 6,
        cacheWriteOneHour: 9.6,
      },
    },
    "bedrock_mantle/us-gov-west-1/anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "bedrock_mantle/us-gov-east-1/openai.gpt-5.4": {
      standard: {
        input: 3.3000000000000003,
        output: 19.8,
        cacheRead: 0.33,
      },
    },
    "bedrock_mantle/us-gov-east-1/xai.grok-4.6": {
      standard: {
        input: 2.64,
        output: 7.920000000000001,
        cacheRead: 0.66,
      },
    },
    "bedrock_mantle/us-gov-east-1/openai.gpt-oss-20b": {
      standard: {
        input: 0.08399999999999999,
        output: 0.36,
      },
    },
    "bedrock_mantle/us-gov-east-1/openai.gpt-oss-120b": {
      standard: {
        input: 0.18,
        output: 0.72,
      },
    },
    "bedrock_mantle/deepseek.v3.1": {
      standard: {
        input: 0.58,
        output: 1.68,
      },
    },
    "bedrock_mantle/moonshotai.kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "bedrock_mantle/qwen.qwen3-235b-a22b-2507": {
      standard: {
        input: 0.22,
        output: 0.88,
      },
    },
    "bedrock_mantle/qwen.qwen3-32b": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "bedrock_mantle/qwen.qwen3-coder-30b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "bedrock_mantle/qwen.qwen3-coder-480b-a35b-instruct": {
      standard: {
        input: 0.44999999999999996,
        output: 1.7999999999999998,
      },
    },
    "bedrock_mantle/qwen.qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.14,
        output: 1.2,
      },
    },
    "bedrock_mantle/qwen.qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.53,
        output: 2.66,
      },
    },
    "azure/us-gov/gpt-5.1": {
      standard: {
        input: 1.71875,
        output: 13.75,
        cacheRead: 0.171875,
      },
    },
    "azure/us-gov/o3-mini": {
      standard: {
        input: 1.513,
        output: 6.05,
        cacheRead: 0.757,
      },
    },
    "azure/us-gov/text-embedding-3-large": {
      standard: {
        input: 0.16299999999999998,
        output: 0,
      },
    },
    "azure/us-gov/text-embedding-3-small": {
      standard: {
        input: 0.024999999999999998,
        output: 0,
      },
    },
    "gemini/lyria-3.5-clip-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/lyria-3.5-pro-preview": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/lyria-3.5": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "gemini/lyria-realtime-exp": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "perplexity/anthropic/claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
      },
    },
    "perplexity/anthropic/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "perplexity/anthropic/claude-opus-4-8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "perplexity/anthropic/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/anthropic/claude-sonnet-4-6": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "perplexity/openai/gpt-5.6-sol": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
      },
    },
    "perplexity/openai/gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/openai/gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
      },
    },
    "perplexity/openai/gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "perplexity/openai/gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "perplexity/openai/gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "perplexity/openai/gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "perplexity/openai/gpt-5": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "perplexity/google/gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/google/gemini-3.1-flash-lite": {
      standard: {
        input: 0.25,
        output: 1.5,
        cacheRead: 0.024999999999999998,
      },
    },
    "perplexity/google/gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
        cacheRead: 0.15,
      },
    },
    "perplexity/google/gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
      },
    },
    "perplexity/google/gemini-3.6-flash": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
      },
    },
    "perplexity/google/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
      },
    },
    "perplexity/xai/grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "perplexity/xai/grok-4.5": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.3,
      },
    },
    "perplexity/xai/grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/xai/grok-4.20-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/xai/grok-4.20-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/xai/grok-4.20-multi-agent": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/perplexity/glm-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "perplexity/perplexity/glm-5.3-flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "perplexity/perplexity/nemotron-3.5-lightning-30b-a3b": {
      standard: {
        input: 0.0115,
        output: 0.16999999999999998,
        cacheRead: 0.00115,
      },
    },
    "perplexity/perplexity/nemotron-3-ultra-550b-a55b": {
      standard: {
        input: 0.25,
        output: 2.5,
        cacheRead: 0.25,
      },
    },
    "openrouter/anthropic/claude-fable-5": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "openrouter/anthropic/claude-fable-5.1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "openrouter/anthropic/claude-opus-4.8": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "openrouter/google/gemini-2.5-flash-lite": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
        cacheRead: 0.01,
        cacheWrite: 0.0833333333333333,
      },
    },
    "openrouter/google/gemini-3.5-flash": {
      standard: {
        input: 1.5,
        output: 9,
        cacheRead: 0.15,
        cacheWrite: 0.0833333333333333,
      },
    },
    "openrouter/google/gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        cacheWrite: 0.0833333333333333,
      },
    },
    "openrouter/google/gemini-3.6-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/google/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/google/gemini-3.8-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/openai/gpt-4o-mini": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "openrouter/openai/gpt-5.1": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5.3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "openrouter/openai/gpt-5.4": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "openrouter/openai/gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "openrouter/openai/gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "openrouter/openai/gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "openrouter/openai/gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "openrouter/openai/gpt-5.6-luna-pro": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "openrouter/openai/gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/gpt-5.6-terra-pro": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/o3": {
      standard: {
        input: 2,
        output: 8,
        cacheRead: 0.5,
      },
    },
    "openrouter/openai/o4-mini": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "openrouter/x-ai/grok-4.20": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/x-ai/grok-4.20-multi-agent": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/x-ai/grok-4.3": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/x-ai/grok-4.5": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.3,
      },
    },
    "openrouter/x-ai/grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "openrouter/x-ai/grok-build-0.1": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "baseten/zai-org/GLM-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "baseten/zai-org/GLM-5.3-Fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "openrouter/minimax/minimax-m3": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
      },
    },
    "openrouter/qwen/qwen3.7-plus": {
      standard: {
        input: 0.32,
        output: 1.28,
        cacheRead: 0.064,
        cacheWrite: 0.39999999999999997,
      },
    },
    "openrouter/openai/gpt-6-astra": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "openrouter/openai/gpt-6-astra-pro": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "openrouter/qwen/qwen3.8-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
        cacheWrite: 0.19999999999999998,
      },
    },
    "openrouter/z-ai/glm-5.3-flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "openrouter/deepseek/deepseek-v4-flash-vision-exp": {
      standard: {
        input: 0.21559999999999999,
        output: 0.6468,
        cacheRead: 0.00686,
      },
    },
    "openrouter/z-ai/glm-5.3": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "openrouter/qwen/qwen3.8-27b": {
      standard: {
        input: 0.42,
        output: 3,
        cacheRead: 0.08499999999999999,
      },
    },
    "openrouter/qwen/qwen3.8-2.4t-a95b": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "openrouter/nvidia/nemotron-3.5-lightning:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/qwen/qwen3.8-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
        cacheWrite: 2.5,
      },
    },
    "openrouter/qwen/qwen3.8-max-0902": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
        cacheWrite: 2.5,
      },
    },
    "openrouter/qwen/qwen3.8-max-prime": {
      standard: {
        input: 4,
        output: 12,
        cacheRead: 0.5,
      },
    },
    "openrouter/deepseek/deepseek-v4-flash-0731": {
      standard: {
        input: 0.0152,
        output: 1.28,
        cacheRead: 0.0137,
      },
    },
    "openrouter/qwen/qwen3.7-flash": {
      standard: {
        input: 0.03,
        output: 0.13,
        cacheRead: 0.006,
        cacheWrite: 0.038000000000000006,
      },
    },
    "openrouter/poolside/laguna-s-2.1": {
      standard: {
        input: 0.09,
        output: 0.18,
        cacheRead: 0.009,
      },
    },
    "openrouter/poolside/laguna-s-2.1:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/moonshotai/kimi-k3": {
      standard: {
        input: 0.499,
        output: 13,
        cacheRead: 0.49,
      },
    },
    "openrouter/poolside/laguna-xs-2.1": {
      standard: {
        input: 0.06,
        output: 0.12,
        cacheRead: 0.03,
      },
    },
    "openrouter/poolside/laguna-xs-2.1:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/google/gemini-3.1-flash-lite-image": {
      standard: {
        input: 0.25,
        output: 1.5,
      },
    },
    "openrouter/google/gemini-3.1-flash-image": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "openrouter/google/gemini-3-pro-image": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/z-ai/glm-5.2": {
      standard: {
        input: 0.3,
        output: 3.49,
        cacheRead: 0.26,
      },
    },
    "openrouter/z-ai/glm-5.2:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/moonshotai/kimi-k2.7-code": {
      standard: {
        input: 0.6712,
        output: 3.35,
        cacheRead: 0.18,
      },
    },
    "openrouter/nvidia/nemotron-3.5-content-safety": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "openrouter/nvidia/nemotron-3.5-content-safety:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/nvidia/nemotron-3-ultra-550b-a55b": {
      standard: {
        input: 0.5,
        output: 2.2,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/minimax/minimax-m3:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/qwen/qwen3.7-max": {
      standard: {
        input: 1.475,
        output: 4.425,
        cacheRead: 0.295,
        cacheWrite: 1.84375,
      },
    },
    "openrouter/mistralai/mistral-medium-3-5": {
      standard: {
        input: 1.5,
        output: 7.5,
      },
    },
    "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/qwen/qwen3.5-plus-20260420": {
      standard: {
        input: 0.3,
        output: 1.7999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/qwen/qwen3.6-flash": {
      standard: {
        input: 0.1875,
        output: 1.125,
        cacheWrite: 0.234375,
      },
    },
    "openrouter/qwen/qwen3.6-35b-a3b": {
      standard: {
        input: 0.15,
        output: 1,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/qwen/qwen3.6-max-preview": {
      standard: {
        input: 1.0270000000000001,
        output: 6.162,
        cacheWrite: 1.28375,
      },
    },
    "openrouter/qwen/qwen3.6-27b": {
      standard: {
        input: 0.32,
        output: 3.1999999999999997,
        cacheRead: 0.15,
      },
    },
    "openrouter/openai/gpt-5.5-pro": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "openrouter/openai/gpt-chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "openrouter/deepseek/deepseek-v4-flash": {
      standard: {
        input: 0.028,
        output: 0.056,
        cacheRead: 0.0056,
      },
    },
    "openrouter/moonshotai/kimi-k2.6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "openrouter/google/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.0675,
        output: 0.22499999999999998,
        cacheRead: 0.0375,
      },
    },
    "openrouter/google/gemma-4-26b-a4b-it:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/google/gemma-4-31b-it": {
      standard: {
        input: 0.09,
        output: 0.33999999999999997,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/google/gemma-4-31b-it:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/z-ai/glm-5v-turbo": {
      standard: {
        input: 1.2,
        output: 4,
        cacheRead: 0.24,
      },
    },
    "openrouter/minimax/minimax-m2.7": {
      standard: {
        input: 0.21,
        output: 0.84,
        cacheRead: 0.041999999999999996,
      },
    },
    "openrouter/minimax/minimax-m2.7:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/mistralai/mistral-small-2603": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "openrouter/z-ai/glm-5-turbo": {
      standard: {
        input: 1.2,
        output: 4,
        cacheRead: 0.24,
      },
    },
    "openrouter/nvidia/nemotron-3-super-120b-a12b": {
      standard: {
        input: 0.08,
        output: 0.44999999999999996,
      },
    },
    "openrouter/nvidia/nemotron-3-super-120b-a12b:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/qwen/qwen3.5-9b": {
      standard: {
        input: 0.09999999999999999,
        output: 0.15,
      },
    },
    "openrouter/openai/gpt-5.4-pro": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "openrouter/google/gemini-3.1-flash-image-preview": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "openrouter/google/gemini-3.1-pro-preview-customtools": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/qwen/qwen3-max-thinking": {
      standard: {
        input: 0.78,
        output: 3.9,
      },
    },
    "openrouter/qwen/qwen3-coder-next": {
      standard: {
        input: 0.12,
        output: 0.7999999999999999,
        cacheRead: 0.07,
      },
    },
    "openrouter/minimax/minimax-m2-her": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.03,
      },
    },
    "openrouter/openai/gpt-audio": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "openrouter/openai/gpt-audio-mini": {
      standard: {
        input: 0.6,
        output: 2.4,
      },
    },
    "openrouter/nvidia/nemotron-3-nano-30b-a3b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.03,
      },
    },
    "openrouter/z-ai/glm-4.6v": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/google/gemini-3-pro-image-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/openai/gpt-5.1-codex": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.13,
      },
    },
    "openrouter/openai/gpt-5.1-codex-mini": {
      standard: {
        input: 0.25,
        output: 2,
        cacheRead: 0.03,
      },
    },
    "openrouter/moonshotai/kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
        cacheRead: 0.15,
      },
    },
    "openrouter/mistralai/voxtral-small-24b-2507": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
        cacheRead: 0.01,
      },
    },
    "openrouter/openai/gpt-oss-safeguard-20b": {
      standard: {
        input: 0.075,
        output: 0.3,
        cacheRead: 0.0375,
      },
    },
    "openrouter/qwen/qwen3-vl-32b-instruct": {
      standard: {
        input: 0.10400000000000001,
        output: 0.41600000000000004,
      },
    },
    "openrouter/qwen/qwen3-vl-8b-thinking": {
      standard: {
        input: 0.18,
        output: 2.0999999999999996,
      },
    },
    "openrouter/qwen/qwen3-vl-8b-instruct": {
      standard: {
        input: 0.117,
        output: 0.45499999999999996,
      },
    },
    "openrouter/google/gemini-2.5-flash-image": {
      standard: {
        input: 0.3,
        output: 2.5,
        cacheRead: 0.03,
        cacheWrite: 0.0833333333333333,
      },
    },
    "openrouter/qwen/qwen3-vl-30b-a3b-thinking": {
      standard: {
        input: 0.19999999999999998,
        output: 2.4,
      },
    },
    "openrouter/qwen/qwen3-vl-30b-a3b-instruct": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "openrouter/openai/gpt-5-pro": {
      standard: {
        input: 15,
        output: 120,
      },
    },
    "openrouter/qwen/qwen3-vl-235b-a22b-thinking": {
      standard: {
        input: 0.39999999999999997,
        output: 4,
      },
    },
    "openrouter/qwen/qwen3-vl-235b-a22b-instruct": {
      standard: {
        input: 0.21,
        output: 1.9,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/qwen/qwen3-max": {
      standard: {
        input: 0.78,
        output: 3.9,
        cacheRead: 0.156,
        cacheWrite: 0.975,
      },
    },
    "openrouter/deepseek/deepseek-v3.1-terminus": {
      standard: {
        input: 0.27,
        output: 1,
        cacheRead: 0.135,
      },
    },
    "openrouter/qwen/qwen3-coder-flash": {
      standard: {
        input: 0.195,
        output: 0.975,
        cacheRead: 0.039,
        cacheWrite: 0.24375,
      },
    },
    "openrouter/qwen/qwen3-next-80b-a3b-thinking": {
      standard: {
        input: 0.15,
        output: 1.2,
      },
    },
    "openrouter/qwen/qwen3-next-80b-a3b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 1.1,
        cacheRead: 0.07,
      },
    },
    "openrouter/qwen/qwen-plus-2025-07-28": {
      standard: {
        input: 0.26,
        output: 0.78,
        cacheRead: 0.052000000000000005,
        cacheWrite: 0.325,
      },
    },
    "openrouter/moonshotai/kimi-k2-0905": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
    "openrouter/qwen/qwen3-30b-a3b-thinking-2507": {
      standard: {
        input: 0.19999999999999998,
        output: 2.4,
      },
    },
    "openrouter/mistralai/mistral-medium-3.1": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "openrouter/z-ai/glm-4.5v": {
      standard: {
        input: 0.6,
        output: 1.7999999999999998,
        cacheRead: 0.11,
      },
    },
    "openrouter/mistralai/codestral-2508": {
      standard: {
        input: 0.3,
        output: 0.8999999999999999,
        cacheRead: 0.03,
      },
    },
    "openrouter/qwen/qwen3-coder-30b-a3b-instruct": {
      standard: {
        input: 0.07,
        output: 0.28,
      },
    },
    "openrouter/qwen/qwen3-30b-a3b-instruct-2507": {
      standard: {
        input: 0.04815,
        output: 0.19305,
      },
    },
    "openrouter/z-ai/glm-4.5": {
      standard: {
        input: 0.6,
        output: 2.2,
        cacheRead: 0.11,
      },
    },
    "openrouter/z-ai/glm-4.5-air": {
      standard: {
        input: 0.13,
        output: 0.85,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/moonshotai/kimi-k2": {
      standard: {
        input: 0.5700000000000001,
        output: 2.3,
      },
    },
    "openrouter/minimax/minimax-m1": {
      standard: {
        input: 0.55,
        output: 2.2,
      },
    },
    "openrouter/openai/o3-pro": {
      standard: {
        input: 20,
        output: 80,
      },
    },
    "openrouter/google/gemini-2.5-pro-preview": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
        cacheWrite: 0.375,
      },
    },
    "openrouter/mistralai/mistral-medium-3": {
      standard: {
        input: 0.39999999999999997,
        output: 2,
        cacheRead: 0.04,
      },
    },
    "openrouter/google/gemini-2.5-pro-preview-05-06": {
      standard: {
        input: 1.25,
        output: 10,
        cacheRead: 0.125,
        cacheWrite: 0.375,
      },
    },
    "openrouter/meta-llama/llama-guard-4-12b": {
      standard: {
        input: 0.18,
        output: 0.18,
      },
    },
    "openrouter/qwen/qwen3-30b-a3b": {
      standard: {
        input: 0.12,
        output: 0.5,
      },
    },
    "openrouter/qwen/qwen3-8b": {
      standard: {
        input: 0.117,
        output: 0.45499999999999996,
      },
    },
    "openrouter/qwen/qwen3-14b": {
      standard: {
        input: 0.12,
        output: 0.24,
      },
    },
    "openrouter/qwen/qwen3-32b": {
      standard: {
        input: 0.08,
        output: 0.28,
      },
    },
    "openrouter/qwen/qwen3-235b-a22b": {
      standard: {
        input: 0.45499999999999996,
        output: 1.8199999999999998,
      },
    },
    "openrouter/openai/o4-mini-high": {
      standard: {
        input: 1.1,
        output: 4.4,
        cacheRead: 0.275,
      },
    },
    "openrouter/meta-llama/llama-4-maverick": {
      standard: {
        input: 0.1875,
        output: 0.6525,
      },
    },
    "openrouter/meta-llama/llama-4-scout": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "openrouter/openai/o1-pro": {
      standard: {
        input: 150,
        output: 600,
      },
    },
    "openrouter/google/gemma-3-4b-it": {
      standard: {
        input: 0.049999999999999996,
        output: 0.09999999999999999,
      },
    },
    "openrouter/google/gemma-3-12b-it": {
      standard: {
        input: 0.049999999999999996,
        output: 0.15,
      },
    },
    "openrouter/google/gemma-3-27b-it": {
      standard: {
        input: 0.08,
        output: 0.44999999999999996,
        cacheRead: 0.04,
      },
    },
    "openrouter/mistralai/mistral-saba": {
      standard: {
        input: 0.19999999999999998,
        output: 0.6,
        cacheRead: 0.02,
      },
    },
    "openrouter/qwen/qwen2.5-vl-72b-instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 1,
        cacheRead: 0.39999999999999997,
      },
    },
    "openrouter/qwen/qwen-plus": {
      standard: {
        input: 0.26,
        output: 0.78,
        cacheRead: 0.052000000000000005,
        cacheWrite: 0.325,
      },
    },
    "openrouter/mistralai/mistral-small-24b-instruct-2501": {
      standard: {
        input: 0.049999999999999996,
        output: 0.08,
      },
    },
    "openrouter/deepseek/deepseek-r1-distill-llama-70b": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "openrouter/minimax/minimax-01": {
      standard: {
        input: 0.19999999999999998,
        output: 1.1,
      },
    },
    "openrouter/meta-llama/llama-3.3-70b-instruct": {
      standard: {
        input: 0.22,
        output: 0.5,
        cacheRead: 0.11,
      },
    },
    "openrouter/openai/gpt-4o-2024-11-20": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "openrouter/mistralai/mistral-large-2407": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/qwen/qwen-2.5-7b-instruct": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "openrouter/meta-llama/llama-3.2-1b-instruct": {
      standard: {
        input: 0.027,
        output: 0.201,
      },
    },
    "openrouter/meta-llama/llama-3.2-3b-instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.33,
      },
    },
    "openrouter/qwen/qwen-2.5-72b-instruct": {
      standard: {
        input: 0.36,
        output: 0.39999999999999997,
      },
    },
    "openrouter/openai/gpt-4o-2024-08-06": {
      standard: {
        input: 2.5,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "openrouter/meta-llama/llama-3.1-70b-instruct": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "openrouter/meta-llama/llama-3.1-8b-instruct": {
      standard: {
        input: 0.049999999999999996,
        output: 0.08,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/mistralai/mistral-nemo": {
      standard: {
        input: 0.019000000000000003,
        output: 0.03,
      },
    },
    "openrouter/openai/gpt-4o-mini-2024-07-18": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.075,
      },
    },
    "openrouter/google/gemma-2-27b-it": {
      standard: {
        input: 0.65,
        output: 0.65,
      },
    },
    "openrouter/openai/gpt-4-turbo": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "openrouter/openai/gpt-4-turbo-preview": {
      standard: {
        input: 10,
        output: 30,
      },
    },
    "openrouter/openai/gpt-3.5-turbo-instruct": {
      standard: {
        input: 1.5,
        output: 2,
      },
    },
    "together_ai/arcee-ai/trinity-mini": {
      standard: {
        input: 0.045,
        output: 0.15,
      },
    },
    "vertex_ai/gemini-2.5-flash-native-audio": {
      standard: {
        input: 0.5,
        output: 2,
      },
    },
    "vertex_ai/gemini-2.5-flash-preview-tts": {
      standard: {
        input: 0.5,
        output: 10,
      },
    },
    "vertex_ai/gemini-3.1-flash-tts-preview": {
      standard: {
        input: 1,
        output: 20,
      },
    },
    "vertex_ai/gemini-omni-1.1-flash": {
      standard: {
        input: 1.5,
        output: 9,
        reasoning: 9,
      },
    },
    "vertex_ai/gemini-omni-1.1-flash-preview": {
      standard: {
        input: 1.5,
        output: 9,
        reasoning: 9,
      },
    },
    "vertex_ai/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "gpt-5.5-cyber": {
      standard: {
        input: 12.5,
        output: 75,
        cacheRead: 1.25,
      },
    },
    "gpt-rosalind-research": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
      },
    },
    "together_ai/meta-llama/Llama-3.1-405B-Instruct": {
      standard: {
        input: 3.5,
        output: 3.5,
      },
    },
    "together_ai/meta-llama/Llama-3.2-1B-Instruct": {
      standard: {
        input: 0.06,
        output: 0.06,
      },
    },
    "together_ai/meta-llama/Llama-3.2-3B-Instruct": {
      standard: {
        input: 0.06,
        output: 0.06,
      },
    },
    "together_ai/Qwen/Qwen2-1.5B-Instruct": {
      standard: {
        input: 0.02,
        output: 0.02,
      },
    },
    "together_ai/Qwen/Qwen2.5-14B-Instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "together_ai/Qwen/Qwen2.5-72B-Instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "together_ai/Salesforce/Llama-Rank-V1": {
      standard: {
        input: 0.09999999999999999,
        output: 0,
      },
    },
    "together_ai/meta-llama/Meta-Llama-3.1-8B": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together_ai/together/Tev1-4B-experimental": {
      standard: {
        input: 0.041999999999999996,
        output: 0,
        cacheRead: 0.041999999999999996,
      },
    },
    "together_ai/NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "together_ai/Qwen/QwQ-32B": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "together_ai/Qwen/Qwen2-72B-Instruct": {
      standard: {
        input: 0.8999999999999999,
        output: 0.8999999999999999,
      },
    },
    "together_ai/Qwen/Qwen2-VL-72B-Instruct": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo": {
      standard: {
        input: 1.2,
        output: 1.2,
      },
    },
    "together_ai/Qwen/Qwen2.5-Coder-32B-Instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "together_ai/Qwen/Qwen2.5-VL-72B-Instruct": {
      standard: {
        input: 1.95,
        output: 8,
      },
    },
    "together_ai/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "together_ai/Qwen/Qwen3-Coder-Next-FP8": {
      standard: {
        input: 0.5,
        output: 1.2,
      },
    },
    "together_ai/Qwen/Qwen3-Next-80B-A3B-Instruct": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "together_ai/Qwen/Qwen3-Next-80B-A3B-Thinking": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "together_ai/Qwen/Qwen3-VL-32B-Instruct": {
      standard: {
        input: 0.5,
        output: 1.5,
      },
    },
    "together_ai/Qwen/Qwen3-VL-8B-Instruct": {
      standard: {
        input: 0.18,
        output: 0.6799999999999999,
      },
    },
    "together_ai/Qwen/Qwen3.5-397B-A17B": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
        cacheRead: 0.35,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
      standard: {
        input: 2,
        output: 2,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
      standard: {
        input: 0.18,
        output: 0.18,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B": {
      standard: {
        input: 1.5999999999999999,
        output: 1.5999999999999999,
      },
    },
    "together_ai/deepseek-ai/DeepSeek-V3.1": {
      standard: {
        input: 0.6,
        output: 1.7,
      },
    },
    "together_ai/deepseek-ai/deepseek-coder-33b-instruct": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "together_ai/google/gemma-2-27b-it": {
      standard: {
        input: 0.7999999999999999,
        output: 0.7999999999999999,
      },
    },
    "together_ai/google/gemma-4-31B-it": {
      standard: {
        input: 0.39,
        output: 0.9700000000000001,
      },
    },
    "together_ai/meta-llama/Llama-3-8b-chat-hf": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together_ai/meta-llama/Llama-4-Scout-17B-16E-Instruct": {
      standard: {
        input: 0.18,
        output: 0.59,
      },
    },
    "together_ai/meta-llama/Meta-Llama-3-70B-Instruct-Turbo": {
      standard: {
        input: 0.88,
        output: 0.88,
      },
    },
    "together_ai/meta-llama/Meta-Llama-3-8B-Instruct": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
      standard: {
        input: 0.88,
        output: 0.88,
      },
    },
    "together_ai/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
      standard: {
        input: 0.18,
        output: 0.18,
      },
    },
    "together_ai/mistralai/Mistral-7B-Instruct-v0.1": {
      standard: {
        input: 0.19999999999999998,
        output: 0.19999999999999998,
      },
    },
    "together_ai/mistralai/Mistral-Small-24B-Instruct-2501": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1": {
      standard: {
        input: 0.6,
        output: 0.6,
      },
    },
    "together_ai/moonshotai/Kimi-K2.6": {
      standard: {
        input: 1.2,
        output: 4.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "together_ai/moonshotai/Kimi-K2.7-Code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
      },
    },
    "together_ai/nvidia/Llama-3.1-Nemotron-70B-Instruct-HF": {
      standard: {
        input: 0.88,
        output: 0.88,
      },
    },
    "together_ai/nvidia/nemotron-3-ultra-550b-a55b": {
      standard: {
        input: 0.6,
        output: 3.5999999999999996,
        cacheRead: 0.19999999999999998,
      },
    },
    "together_ai/openai/gpt-oss-20b": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
      },
    },
    "together_ai/zai-org/GLM-4.5-Air-FP8": {
      standard: {
        input: 0.19999999999999998,
        output: 1.1,
      },
    },
    "together_ai/zai-org/GLM-4.7": {
      standard: {
        input: 0.44999999999999996,
        output: 2,
      },
    },
    "together_ai/zai-org/GLM-5": {
      standard: {
        input: 1,
        output: 3.1999999999999997,
      },
    },
    "together_ai/zai-org/GLM-5.1": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.26,
      },
    },
    "azure/eu/codex-mini": {
      standard: {
        input: 1.6500000000000001,
        output: 6.6000000000000005,
        cacheRead: 0.413,
      },
    },
    "azure/eu/computer-use-preview": {
      standard: {
        input: 3.3000000000000003,
        output: 13.200000000000001,
      },
    },
    "azure/eu/gpt-4.1": {
      standard: {
        input: 2.2,
        output: 8.8,
        cacheRead: 0.55,
      },
    },
    "azure/eu/gpt-4.1-mini": {
      standard: {
        input: 0.44,
        output: 1.76,
        cacheRead: 0.11,
      },
    },
    "azure/eu/gpt-4.1-nano": {
      standard: {
        input: 0.11,
        output: 0.44,
        cacheRead: 0.028,
      },
    },
    "azure/eu/gpt-4o-2024-05-13": {
      standard: {
        input: 5.5,
        output: 16.5,
      },
    },
    "azure/eu/gpt-5": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5-codex": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.13799999999999998,
      },
    },
    "azure/eu/gpt-5-mini": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/eu/gpt-5-nano": {
      standard: {
        input: 0.055,
        output: 0.44,
        cacheRead: 0.0055,
      },
    },
    "azure/eu/gpt-5-pro": {
      standard: {
        input: 16.5,
        output: 132,
      },
    },
    "azure/eu/gpt-5.1-codex-max": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/eu/gpt-5.2": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/eu/gpt-5.2-codex": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/eu/gpt-5.2-pro": {
      standard: {
        input: 23.099999999999998,
        output: 184.79999999999998,
      },
    },
    "azure/eu/gpt-5.3-codex": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/eu/gpt-5.4-mini": {
      standard: {
        input: 0.8250000000000001,
        output: 4.95,
        cacheRead: 0.0825,
      },
    },
    "azure/eu/gpt-5.4-nano": {
      standard: {
        input: 0.22,
        output: 1.375,
        cacheRead: 0.022,
      },
    },
    "azure/eu/gpt-5.4-pro": {
      standard: {
        input: 33,
        output: 198,
      },
    },
    "azure/eu/gpt-6-astra": {
      standard: {
        input: 12,
        output: 60,
        cacheRead: 1.2,
        cacheWrite: 15,
      },
    },
    "azure/eu/gpt-6-luna": {
      standard: {
        input: 0.12,
        output: 0.6,
        cacheRead: 0.012,
        cacheWrite: 0.15,
      },
    },
    "azure/eu/gpt-6-sol": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
      },
    },
    "azure/eu/o1-mini": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/eu/o3-2025-04-16": {
      standard: {
        input: 2.2,
        output: 8.8,
        cacheRead: 0.55,
      },
    },
    "azure/eu/o3-deep-research": {
      standard: {
        input: 11,
        output: 44,
        cacheRead: 2.75,
      },
    },
    "azure/eu/o4-mini-2025-04-16": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.303,
      },
    },
    "gemini/gemini-3.8-live": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "gemini/gemini-3.8-live-extended-thinking": {
      standard: {
        input: 0.75,
        output: 4.5,
      },
    },
    "azure/us/codex-mini": {
      standard: {
        input: 1.6500000000000001,
        output: 6.6000000000000005,
        cacheRead: 0.413,
      },
    },
    "azure/us/computer-use-preview": {
      standard: {
        input: 3.3000000000000003,
        output: 13.200000000000001,
      },
    },
    "azure/us/gpt-4.1": {
      standard: {
        input: 2.2,
        output: 8.8,
        cacheRead: 0.55,
      },
    },
    "azure/us/gpt-4.1-mini": {
      standard: {
        input: 0.44,
        output: 1.76,
        cacheRead: 0.11,
      },
    },
    "azure/us/gpt-4.1-nano": {
      standard: {
        input: 0.11,
        output: 0.44,
        cacheRead: 0.028,
      },
    },
    "azure/us/gpt-4o-2024-05-13": {
      standard: {
        input: 5.5,
        output: 16.5,
      },
    },
    "azure/us/gpt-5": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5-codex": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.13799999999999998,
      },
    },
    "azure/us/gpt-5-mini": {
      standard: {
        input: 0.275,
        output: 2.2,
        cacheRead: 0.0275,
      },
    },
    "azure/us/gpt-5-nano": {
      standard: {
        input: 0.055,
        output: 0.44,
        cacheRead: 0.0055,
      },
    },
    "azure/us/gpt-5-pro": {
      standard: {
        input: 16.5,
        output: 132,
      },
    },
    "azure/us/gpt-5.1-codex-max": {
      standard: {
        input: 1.375,
        output: 11,
        cacheRead: 0.1375,
      },
    },
    "azure/us/gpt-5.2": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/us/gpt-5.2-codex": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/us/gpt-5.2-pro": {
      standard: {
        input: 23.099999999999998,
        output: 184.79999999999998,
      },
    },
    "azure/us/gpt-5.3-codex": {
      standard: {
        input: 1.9250000000000003,
        output: 15.400000000000002,
        cacheRead: 0.1925,
      },
    },
    "azure/us/gpt-5.4-mini": {
      standard: {
        input: 0.8250000000000001,
        output: 4.95,
        cacheRead: 0.0825,
      },
    },
    "azure/us/gpt-5.4-nano": {
      standard: {
        input: 0.22,
        output: 1.375,
        cacheRead: 0.022,
      },
    },
    "azure/us/gpt-5.4-pro": {
      standard: {
        input: 33,
        output: 198,
      },
    },
    "azure/us/o1-mini": {
      standard: {
        input: 1.21,
        output: 4.84,
        cacheRead: 0.605,
      },
    },
    "azure/us/o3-deep-research": {
      standard: {
        input: 11,
        output: 44,
        cacheRead: 2.75,
      },
    },
    "azure/gpt-realtime-2": {
      standard: {
        input: 4,
        output: 24,
        cacheRead: 0.39999999999999997,
      },
    },
    "aihubmix/agnes-2.5-flash": {
      standard: {
        input: 0.03,
        output: 0.15,
      },
    },
    "aihubmix/agnes-2.5-pro": {
      standard: {
        input: 0.44999999999999996,
        output: 0.8999999999999999,
        cacheRead: 0.00378,
      },
    },
    "aihubmix/cc-glm-5.1": {
      standard: {
        input: 0.06,
        output: 0.22,
      },
    },
    "aihubmix/claude-fable-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
      },
    },
    "aihubmix/claude-haiku-4-5": {
      standard: {
        input: 1.1,
        output: 5.5,
        cacheRead: 0.11,
        cacheWrite: 1.375,
      },
    },
    "aihubmix/claude-opus-4-8-think": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "aihubmix/claude-opus-5": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "aihubmix/claude-sonnet-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "aihubmix/coding-glm-5.3": {
      standard: {
        input: 0.06,
        output: 0.22,
        cacheRead: 0.015,
      },
    },
    "aihubmix/coding-kimi-k3": {
      standard: {
        input: 0.44,
        output: 1.6133300000000002,
        cacheRead: 0.06599999999999999,
      },
    },
    "aihubmix/coding-xiaomi-mimo-v2-omni": {
      standard: {
        input: 0.08,
        output: 0.39999999999999997,
        cacheRead: 0.016,
      },
    },
    "aihubmix/coding-xiaomi-mimo-v2.5": {
      standard: {
        input: 0.08,
        output: 0.16,
        cacheRead: 0.0016,
      },
    },
    "aihubmix/coding-xiaomi-mimo-v2.5-pro": {
      standard: {
        input: 0.19999999999999998,
        output: 0.39999999999999997,
        cacheRead: 0.0016,
      },
    },
    "aihubmix/command-a-plus-05-2026": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "aihubmix/deepseek-v4-flash": {
      standard: {
        input: 0.142,
        output: 0.284,
        cacheRead: 0.028399999999999998,
      },
    },
    "aihubmix/deepseek-v4-pro": {
      standard: {
        input: 1.69,
        output: 3.38,
        cacheRead: 0.14027,
      },
    },
    "aihubmix/doubao-seed-2-0-code-preview": {
      standard: {
        input: 0.4822,
        output: 2.411,
        cacheRead: 0.09644,
      },
    },
    "aihubmix/doubao-seed-2-0-lite-260428": {
      standard: {
        input: 0.09041,
        output: 0.5424599999999999,
        cacheRead: 0.018082,
      },
    },
    "aihubmix/doubao-seed-2-0-mini": {
      standard: {
        input: 0.030136,
        output: 0.30136,
        cacheRead: 0.006027,
      },
    },
    "aihubmix/doubao-seed-2-0-pro": {
      standard: {
        input: 0.4822,
        output: 2.411,
        cacheRead: 0.09644,
      },
    },
    "aihubmix/doubao-seed-2-1-turbo": {
      standard: {
        input: 0.46475,
        output: 2.32375,
        cacheRead: 0.09294999999999999,
      },
    },
    "aihubmix/ernie-5.1": {
      standard: {
        input: 0.5634,
        output: 2.5353,
        cacheRead: 0.5634,
      },
    },
    "aihubmix/gemini-3-flash-preview": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "aihubmix/gemini-3-flash-preview-search": {
      standard: {
        input: 0.5,
        output: 3,
        cacheRead: 0.049999999999999996,
      },
    },
    "aihubmix/gemini-3.1-pro-preview": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "aihubmix/gemini-3.1-pro-preview-customtools": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
      },
    },
    "aihubmix/gemini-3.5-flash-lite": {
      standard: {
        input: 0.3,
        output: 2.499999,
        cacheRead: 0.03,
      },
    },
    "aihubmix/gemini-3.7-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
      },
    },
    "aihubmix/gemma-4-26b-a4b-it": {
      standard: {
        input: 0.14,
        output: 0.39998,
      },
    },
    "aihubmix/gemma-4-31b-it": {
      standard: {
        input: 0.14,
        output: 0.39998,
      },
    },
    "aihubmix/glm-5.2-fast-preview": {
      standard: {
        input: 2.254,
        output: 7.889,
        cacheRead: 0.5635,
      },
    },
    "aihubmix/glm-5.3": {
      standard: {
        input: 1.1268,
        output: 3.9438000000000004,
        cacheRead: 0.2817,
      },
    },
    "aihubmix/glm-5.3-flash": {
      standard: {
        input: 0.11268,
        output: 0.39438,
        cacheRead: 0.02817,
      },
    },
    "aihubmix/glm-5v-turbo": {
      standard: {
        input: 0.7041999999999999,
        output: 3.09848,
        cacheRead: 0.169008,
      },
    },
    "aihubmix/gpt-5.3-codex": {
      standard: {
        input: 1.75,
        output: 14,
        cacheRead: 0.175,
      },
    },
    "aihubmix/gpt-5.4-high": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "aihubmix/gpt-5.4-low": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "aihubmix/gpt-5.4-mini": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "aihubmix/gpt-5.4-nano": {
      standard: {
        input: 0.19999999999999998,
        output: 1.25,
        cacheRead: 0.02,
      },
    },
    "aihubmix/gpt-5.5": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "aihubmix/gpt-5.5-pro": {
      standard: {
        input: 30,
        output: 180,
      },
    },
    "aihubmix/gpt-5.6-luna": {
      standard: {
        input: 0.19999999999999998,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
      },
    },
    "aihubmix/gpt-5.6-sol-disc": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.39999999999999997,
        cacheWrite: 5,
      },
    },
    "aihubmix/gpt-5.6-terra": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "aihubmix/gpt-chat-latest": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "aihubmix/grok-4-20-non-reasoning": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "aihubmix/grok-4-20-reasoning": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.19999999999999998,
      },
    },
    "aihubmix/grok-4.6": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "aihubmix/grok-build-0.1": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "aihubmix/hy3": {
      standard: {
        input: 0.1562,
        output: 0.6248,
        cacheRead: 0.03905,
      },
    },
    "aihubmix/hy4-preview": {
      standard: {
        input: 0.845,
        output: 2.5349999999999997,
        cacheRead: 0.042249999999999996,
      },
    },
    "aihubmix/kimi-k2.6": {
      standard: {
        input: 0.95,
        output: 3.9995000000000003,
        cacheRead: 0.160835,
      },
    },
    "aihubmix/kimi-k2.7-code-highspeed": {
      standard: {
        input: 1.9,
        output: 7.9990000000000006,
        cacheRead: 0.32167,
      },
    },
    "aihubmix/kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "aihubmix/longcat-2.0": {
      standard: {
        input: 0.7746,
        output: 3.0984,
        cacheRead: 0.015492,
      },
    },
    "aihubmix/mai-thinking-1": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "aihubmix/mimo-v2-omni": {
      standard: {
        input: 0.44,
        output: 2.2,
        cacheRead: 0.088,
      },
    },
    "aihubmix/mimo-v2-pro": {
      standard: {
        input: 1.1,
        output: 3.3000000000000003,
        cacheRead: 0.22,
      },
    },
    "aihubmix/minimax-m2.7": {
      standard: {
        input: 0.2958,
        output: 1.1832,
        cacheRead: 0.059160000000000004,
      },
    },
    "aihubmix/minimax-m3": {
      standard: {
        input: 0.288,
        output: 1.152,
      },
    },
    "aihubmix/muse-spark-1.2": {
      standard: {
        input: 1.375,
        output: 4.675,
      },
    },
    "aihubmix/qwen3-coder-next": {
      standard: {
        input: 0.13699999999999998,
        output: 0.5479999999999999,
      },
    },
    "aihubmix/qwen3.5-122b-a10b": {
      standard: {
        input: 0.1126,
        output: 0.9008,
      },
    },
    "aihubmix/qwen3.5-397b-a17b": {
      standard: {
        input: 0.1644,
        output: 0.9863999999999999,
      },
    },
    "aihubmix/qwen3.6-27b": {
      standard: {
        input: 0.422,
        output: 2.532,
      },
    },
    "aihubmix/qwen3.6-35b-a3b": {
      standard: {
        input: 0.254,
        output: 1.524,
      },
    },
    "aihubmix/qwen3.6-max-preview": {
      standard: {
        input: 1.268,
        output: 7.608,
        cacheRead: 0.1268,
        cacheWrite: 1.585,
      },
    },
    "aihubmix/qwen3.7-plus": {
      standard: {
        input: 0.28200000000000003,
        output: 1.1280000000000001,
        cacheRead: 0.0564,
        cacheWrite: 0.35250000000000004,
      },
    },
    "aihubmix/qwen3.8-2.4t-a95b": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "aihubmix/qwen3.8-flash": {
      standard: {
        input: 0.1126,
        output: 0.380025,
        cacheRead: 0.014075,
        cacheWrite: 0.17593699999999998,
      },
    },
    "aihubmix/qwen3.8-max": {
      standard: {
        input: 1.69,
        output: 5.069999999999999,
        cacheRead: 0.16899999999999998,
        cacheWrite: 2.1125000000000003,
      },
    },
    "aihubmix/step-3.7-flash": {
      standard: {
        input: 0.22,
        output: 1.32,
        cacheRead: 0.044,
      },
    },
    "openrouter/typesafe/jev-1.13": {
      standard: {
        input: 0.041999999999999996,
        output: 0,
      },
    },
    "openrouter/typesafe/jev-router": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "bespoke/nimble-latest": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "bespoke/nimble": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "bespoke/bespokelabs/Bespoke-Nimble-9B": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "laya/english": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "laya/multilingual": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "laya/typed-decisions": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "strands_decider/strands-decider-2B-hobson-v19": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "typesafe/jev-1.13.0": {
      standard: {
        input: 0.041999999999999996,
        output: 0,
      },
    },
    "typesafe/jev-latest": {
      standard: {
        input: 0.041999999999999996,
        output: 0,
      },
    },
    "typesafe/jev-preview": {
      standard: {
        input: 0.041999999999999996,
        output: 0,
      },
    },
    "wandb/deepseek-ai/DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.19999999999999998,
        output: 0.65,
        cacheRead: 0.03,
      },
    },
    "wandb/google/gemma-4-26B-A4B-it": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
        cacheRead: 0.049999999999999996,
      },
    },
    "wandb/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/~anthropic/claude-fable-latest": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "openrouter/~anthropic/claude-haiku-latest": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "openrouter/~anthropic/claude-opus-latest": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
        cacheWrite: 5,
        cacheWriteOneHour: 8,
      },
    },
    "openrouter/~anthropic/claude-sonnet-latest": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "openrouter/~deepseek/deepseek-flash-latest": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "openrouter/~deepseek/deepseek-pro-latest": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.044,
      },
    },
    "openrouter/~deepseek/deepseek-v4-flash-latest": {
      standard: {
        input: 0.04,
        output: 0.64,
        cacheRead: 0.016,
      },
    },
    "openrouter/~google/gemini-flash-latest": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/~google/gemini-pro-latest": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 0.375,
      },
    },
    "openrouter/~moonshotai/kimi-latest": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "openrouter/~openai/gpt-astra-latest": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
      },
    },
    "openrouter/~openai/gpt-luna-latest": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "openrouter/~openai/gpt-mini-latest": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "openrouter/~openai/gpt-sol-latest": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/~openai/gpt-terra-latest": {
      standard: {
        input: 2,
        output: 12,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/~x-ai/grok-latest": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "openrouter/~z-ai/glm-flash-latest": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/~z-ai/glm-latest": {
      standard: {
        input: 0.6537999999999999,
        output: 2.0547999999999997,
        cacheRead: 0.12142000000000001,
      },
    },
    "openrouter/aion-labs/aion-2.0": {
      standard: {
        input: 0.7999999999999999,
        output: 1.5999999999999999,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/aion-labs/aion-3.0": {
      standard: {
        input: 3,
        output: 6,
        cacheRead: 0.75,
      },
    },
    "openrouter/aion-labs/aion-3.0-mini": {
      standard: {
        input: 0.7,
        output: 1.4,
        cacheRead: 0.18,
      },
    },
    "openrouter/aion-labs/aion-3.5": {
      standard: {
        input: 3,
        output: 6,
        cacheRead: 0.75,
      },
    },
    "openrouter/aion-labs/aion-3.5-mini": {
      standard: {
        input: 0.7,
        output: 1.4,
        cacheRead: 0.18,
      },
    },
    "openrouter/aion-labs/aion-rp-llama-3.1-8b": {
      standard: {
        input: 0.7999999999999999,
        output: 1.5999999999999999,
      },
    },
    "openrouter/amazon/nova-2-lite-v1": {
      standard: {
        input: 0.3,
        output: 2.5,
      },
    },
    "openrouter/amazon/nova-lite-v1": {
      standard: {
        input: 0.06,
        output: 0.24,
      },
    },
    "openrouter/amazon/nova-micro-v1": {
      standard: {
        input: 0.035,
        output: 0.14,
      },
    },
    "openrouter/amazon/nova-premier-v1": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.625,
      },
    },
    "openrouter/amazon/nova-pro-v1": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
      },
    },
    "openrouter/anthracite-org/magnum-v4-72b": {
      standard: {
        input: 2.5,
        output: 5,
      },
    },
    "openrouter/anthropic/claude-fable-5:batch": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-fable-5.1:batch": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.125,
        cacheWrite: 6.25,
        cacheWriteOneHour: 10,
      },
    },
    "openrouter/anthropic/claude-haiku-4.5:batch": {
      standard: {
        input: 0.5,
        output: 2.5,
        cacheRead: 0.049999999999999996,
        cacheWrite: 0.625,
        cacheWriteOneHour: 1,
      },
    },
    "openrouter/anthropic/claude-opus-4.1:batch": {
      standard: {
        input: 7.5,
        output: 37.5,
        cacheRead: 0.75,
        cacheWrite: 9.375,
        cacheWriteOneHour: 15,
      },
    },
    "openrouter/anthropic/claude-opus-4.5:batch": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
        cacheWrite: 3.125,
        cacheWriteOneHour: 5,
      },
    },
    "openrouter/anthropic/claude-opus-4.6:batch": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
        cacheWrite: 3.125,
        cacheWriteOneHour: 5,
      },
    },
    "openrouter/anthropic/claude-opus-4.7:batch": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
        cacheWrite: 3.125,
        cacheWriteOneHour: 5,
      },
    },
    "openrouter/anthropic/claude-opus-4.8:batch": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
        cacheWrite: 3.125,
        cacheWriteOneHour: 5,
      },
    },
    "openrouter/anthropic/claude-opus-5:batch": {
      standard: {
        input: 2.5,
        output: 12.5,
        cacheRead: 0.25,
        cacheWrite: 3.125,
        cacheWriteOneHour: 5,
      },
    },
    "openrouter/anthropic/claude-sonnet-4.5:batch": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
        cacheWrite: 1.875,
        cacheWriteOneHour: 3,
      },
    },
    "openrouter/anthropic/claude-sonnet-4.6:batch": {
      standard: {
        input: 1.5,
        output: 7.5,
        cacheRead: 0.15,
        cacheWrite: 1.875,
        cacheWriteOneHour: 3,
      },
    },
    "openrouter/anthropic/claude-sonnet-5:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "openrouter/arcee-ai/trinity-large-thinking": {
      standard: {
        input: 0.25,
        output: 0.7999999999999999,
        cacheRead: 0.06,
      },
    },
    "openrouter/baidu/ernie-4.5-vl-424b-a47b": {
      standard: {
        input: 0.42,
        output: 1.25,
      },
    },
    "openrouter/bytedance-seed/seed-1.6": {
      standard: {
        input: 0.25,
        output: 2,
      },
    },
    "openrouter/bytedance-seed/seed-1.6-flash": {
      standard: {
        input: 0.075,
        output: 0.3,
      },
    },
    "openrouter/bytedance-seed/seed-2-1-turbo": {
      standard: {
        input: 0.5,
        output: 2.5,
      },
    },
    "openrouter/bytedance-seed/seed-2.0-code": {
      standard: {
        input: 0.5,
        output: 3,
      },
    },
    "openrouter/bytedance-seed/seed-2.0-lite": {
      standard: {
        input: 0.25,
        output: 2,
      },
    },
    "openrouter/bytedance-seed/seed-2.0-mini": {
      standard: {
        input: 0.09999999999999999,
        output: 0.39999999999999997,
      },
    },
    "openrouter/cognitivecomputations/dolphin-mistral-24b-venice-edition": {
      standard: {
        input: 0.19999999999999998,
        output: 0.8999999999999999,
      },
    },
    "openrouter/cohere/command-a": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "openrouter/cohere/command-r-08-2024": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "openrouter/cohere/command-r-plus-08-2024": {
      standard: {
        input: 2.5,
        output: 10,
      },
    },
    "openrouter/cohere/command-r7b-12-2024": {
      standard: {
        input: 0.0375,
        output: 0.15,
      },
    },
    "openrouter/cohere/north-mini-code:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/apodex/apodex-1.1-mini:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/unbiased/pareto-26.10-preview": {
      standard: {
        input: 0.7999999999999999,
        output: 3.1999999999999997,
        cacheRead: 0.03,
      },
    },
    "openrouter/dots-studio/dots-3-note-preview:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/google/gemini-2.5-flash-lite:batch": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.01,
      },
    },
    "openrouter/google/gemini-2.5-flash:batch": {
      standard: {
        input: 0.15,
        output: 1.25,
        cacheRead: 0.03,
      },
    },
    "openrouter/google/gemini-2.5-pro:batch": {
      standard: {
        input: 0.625,
        output: 5,
        cacheRead: 0.125,
      },
    },
    "openrouter/google/gemini-3-flash-preview:batch": {
      standard: {
        input: 0.25,
        output: 1.5,
      },
    },
    "openrouter/google/gemini-3.1-flash-lite:batch": {
      standard: {
        input: 0.125,
        output: 0.75,
        cacheRead: 0.012499999999999999,
      },
    },
    "openrouter/google/gemini-3.1-pro-preview:batch": {
      standard: {
        input: 1,
        output: 6,
      },
    },
    "openrouter/google/gemini-3.5-flash-lite:batch": {
      standard: {
        input: 0.15,
        output: 1.25,
        cacheRead: 0.015,
      },
    },
    "openrouter/google/gemini-3.5-flash:batch": {
      standard: {
        input: 0.75,
        output: 4.5,
        cacheRead: 0.075,
      },
    },
    "openrouter/google/gemini-3.6-flash:batch": {
      standard: {
        input: 0.375,
        output: 1.875,
        cacheRead: 0.0375,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/google/gemini-3.7-flash:batch": {
      standard: {
        input: 0.375,
        output: 1.875,
        cacheRead: 0.0375,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/google/gemini-3.8-flash:batch": {
      standard: {
        input: 0.375,
        output: 1.875,
        cacheRead: 0.0375,
        cacheWrite: 0.0416666666666667,
      },
    },
    "openrouter/ibm-granite/granite-4.0-h-micro": {
      standard: {
        input: 0.017,
        output: 0.112,
      },
    },
    "openrouter/ibm-granite/granite-4.2-8b": {
      standard: {
        input: 0.06,
        output: 0.25,
        cacheRead: 0.015,
      },
    },
    "openrouter/inception/mercury-2": {
      standard: {
        input: 0.25,
        output: 0.75,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/inception/mercury-2.5": {
      standard: {
        input: 0.04,
        output: 0.15,
        cacheRead: 0.004,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash": {
      standard: {
        input: 0.020999999999999998,
        output: 0.063,
        cacheRead: 0.004200000000000001,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash-fin": {
      standard: {
        input: 0.041999999999999996,
        output: 0.12319999999999999,
        cacheRead: 0.008400000000000001,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash-fin:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash-sante:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash-vl": {
      standard: {
        input: 0.020999999999999998,
        output: 0.061599999999999995,
        cacheRead: 0.004200000000000001,
      },
    },
    "openrouter/inclusionai/ling-3.0-flash-vl:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/inference-net/schematron-v2-small": {
      standard: {
        input: 0.049999999999999996,
        output: 0.22999999999999998,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/inference-net/schematron-v2-turbo": {
      standard: {
        input: 0.03,
        output: 0.15,
        cacheRead: 0.03,
      },
    },
    "openrouter/kwaipilot/kat-coder-pro-v2.5": {
      standard: {
        input: 0.74,
        output: 2.96,
        cacheRead: 0.15,
      },
    },
    "openrouter/liquid/lfm-2.5-2.6b:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/meituan/longcat-2.0": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
      },
    },
    "openrouter/meta/muse-glimmer-30b": {
      standard: {
        input: 0.35,
        output: 1.5,
        cacheRead: 0.04,
      },
    },
    "openrouter/meta/muse-spark-1.1": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "openrouter/meta/muse-spark-1.2": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "openrouter/meta/muse-spark-1.2-contributor": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
        cacheRead: 0.002,
      },
    },
    "openrouter/meta/muse-spark-1.3": {
      standard: {
        input: 1.25,
        output: 4.25,
        cacheRead: 0.15,
      },
    },
    "openrouter/meta/muse-spark-1.3-contributor": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
        cacheRead: 0.002,
      },
    },
    "openrouter/microsoft/phi-4": {
      standard: {
        input: 0.07,
        output: 0.14,
      },
    },
    "openrouter/microsoft/wizardlm-2-8x22b": {
      standard: {
        input: 0.62,
        output: 0.62,
      },
    },
    "openrouter/mistralai/codestral-2508:batch": {
      standard: {
        input: 0.15,
        output: 0.44999999999999996,
        cacheRead: 0.015,
      },
    },
    "openrouter/mistralai/ministral-8b-2512:batch": {
      standard: {
        input: 0.075,
        output: 0.075,
        cacheRead: 0.0075,
      },
    },
    "openrouter/mistralai/mistral-large-2512": {
      standard: {
        input: 0.5,
        output: 1.5,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/mistralai/mistral-large-2512:batch": {
      standard: {
        input: 0.25,
        output: 0.75,
        cacheRead: 0.024999999999999998,
      },
    },
    "openrouter/mistralai/mistral-medium-3-5:batch": {
      standard: {
        input: 0.75,
        output: 3.75,
      },
    },
    "openrouter/mistralai/mistral-medium-3.1:batch": {
      standard: {
        input: 0.19999999999999998,
        output: 1,
        cacheRead: 0.02,
      },
    },
    "openrouter/mistralai/mistral-small-2603:batch": {
      standard: {
        input: 0.075,
        output: 0.3,
        cacheRead: 0.0075,
      },
    },
    "openrouter/moonshotai/kimi-k3:batch": {
      standard: {
        input: 2.2800000000000002,
        output: 11.399999999999999,
        cacheRead: 0.228,
      },
    },
    "openrouter/morph/morph-v3-fast": {
      standard: {
        input: 0.7999999999999999,
        output: 1.2,
      },
    },
    "openrouter/morph/morph-v3-large": {
      standard: {
        input: 0.8999999999999999,
        output: 1.9,
      },
    },
    "openrouter/nex-agi/nex-n2.5-mini:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/nex-agi/nex-n2.5-pro:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/nousresearch/hermes-3-llama-3.1-405b": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "openrouter/nousresearch/hermes-3-llama-3.1-70b": {
      standard: {
        input: 0.7,
        output: 0.7,
      },
    },
    "openrouter/nousresearch/hermes-4-405b": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "openrouter/openai/gpt-3.5-turbo-0613": {
      standard: {
        input: 1,
        output: 2,
      },
    },
    "openrouter/openai/gpt-3.5-turbo:batch": {
      standard: {
        input: 0.25,
        output: 0.75,
      },
    },
    "openrouter/openai/gpt-4-turbo:batch": {
      standard: {
        input: 5,
        output: 15,
      },
    },
    "openrouter/openai/gpt-4.1-mini:batch": {
      standard: {
        input: 0.19999999999999998,
        output: 0.7999999999999999,
        cacheRead: 0.049999999999999996,
      },
    },
    "openrouter/openai/gpt-4.1-nano:batch": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.012499999999999999,
      },
    },
    "openrouter/openai/gpt-4.1:batch": {
      standard: {
        input: 1,
        output: 4,
        cacheRead: 0.25,
      },
    },
    "openrouter/openai/gpt-4o-mini:batch": {
      standard: {
        input: 0.075,
        output: 0.3,
        cacheRead: 0.0375,
      },
    },
    "openrouter/openai/gpt-4o:batch": {
      standard: {
        input: 1.25,
        output: 5,
        cacheRead: 0.625,
      },
    },
    "openrouter/openai/gpt-5-image": {
      standard: {
        input: 10,
        output: 10,
        cacheRead: 1.25,
      },
    },
    "openrouter/openai/gpt-5-image-mini": {
      standard: {
        input: 2.5,
        output: 2,
        cacheRead: 0.25,
      },
    },
    "openrouter/openai/gpt-5-mini:batch": {
      standard: {
        input: 0.125,
        output: 1,
        cacheRead: 0.012499999999999999,
      },
    },
    "openrouter/openai/gpt-5-nano:batch": {
      standard: {
        input: 0.024999999999999998,
        output: 0.19999999999999998,
        cacheRead: 0.0025,
      },
    },
    "openrouter/openai/gpt-5-pro:batch": {
      standard: {
        input: 7.5,
        output: 60,
      },
    },
    "openrouter/openai/gpt-5:batch": {
      standard: {
        input: 0.625,
        output: 5,
        cacheRead: 0.0625,
      },
    },
    "openrouter/openai/gpt-5.1:batch": {
      standard: {
        input: 0.625,
        output: 5,
        cacheRead: 0.0625,
      },
    },
    "openrouter/openai/gpt-5.2-pro:batch": {
      standard: {
        input: 10.5,
        output: 84,
      },
    },
    "openrouter/openai/gpt-5.2:batch": {
      standard: {
        input: 0.875,
        output: 7,
        cacheRead: 0.0875,
      },
    },
    "openrouter/openai/gpt-5.4-image-2": {
      standard: {
        input: 8,
        output: 15,
        cacheRead: 2,
      },
    },
    "openrouter/openai/gpt-5.4-mini:batch": {
      standard: {
        input: 0.375,
        output: 2.25,
        cacheRead: 0.0375,
      },
    },
    "openrouter/openai/gpt-5.4-nano:batch": {
      standard: {
        input: 0.09999999999999999,
        output: 0.625,
        cacheRead: 0.01,
      },
    },
    "openrouter/openai/gpt-5.4-pro:batch": {
      standard: {
        input: 15,
        output: 90,
      },
    },
    "openrouter/openai/gpt-5.4:batch": {
      standard: {
        input: 1.25,
        output: 7.5,
        cacheRead: 0.125,
      },
    },
    "openrouter/openai/gpt-5.5-pro:batch": {
      standard: {
        input: 15,
        output: 90,
      },
    },
    "openrouter/openai/gpt-5.5:batch": {
      standard: {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
      },
    },
    "openrouter/openai/gpt-5.6-luna-pro:batch": {
      standard: {
        input: 0.09999999999999999,
        output: 0.6,
        cacheRead: 0.01,
      },
    },
    "openrouter/openai/gpt-5.6-luna:batch": {
      standard: {
        input: 0.09999999999999999,
        output: 0.6,
        cacheRead: 0.01,
      },
    },
    "openrouter/openai/gpt-5.6-sol-pro:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-5.6-sol:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-5.6-terra-pro:batch": {
      standard: {
        input: 1,
        output: 6,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/openai/gpt-5.6-terra:batch": {
      standard: {
        input: 1,
        output: 6,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/openai/gpt-6-astra-pro:batch": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "openrouter/openai/gpt-6-astra:batch": {
      standard: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
    },
    "openrouter/openai/gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "openrouter/openai/gpt-6-luna-pro": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
      },
    },
    "openrouter/openai/gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/gpt-6-sol-pro": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/o3-mini:batch": {
      standard: {
        input: 0.55,
        output: 2.2,
        cacheRead: 0.275,
      },
    },
    "openrouter/openai/o3:batch": {
      standard: {
        input: 1,
        output: 4,
        cacheRead: 0.25,
      },
    },
    "openrouter/openai/o4-mini:batch": {
      standard: {
        input: 0.55,
        output: 2.2,
        cacheRead: 0.1375,
      },
    },
    "openrouter/perceptron/perceptron-mk1": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "openrouter/perplexity/sonar": {
      standard: {
        input: 1,
        output: 1,
      },
    },
    "openrouter/perplexity/sonar-deep-research": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "openrouter/perplexity/sonar-pro": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "openrouter/perplexity/sonar-pro-search": {
      standard: {
        input: 3,
        output: 15,
      },
    },
    "openrouter/perplexity/sonar-reasoning-pro": {
      standard: {
        input: 2,
        output: 8,
      },
    },
    "openrouter/qwen/qwen3.8-27b:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/rekaai/reka-edge": {
      standard: {
        input: 0.09999999999999999,
        output: 0.09999999999999999,
      },
    },
    "openrouter/rekaai/reka-flash-3": {
      standard: {
        input: 0.09999999999999999,
        output: 0.19999999999999998,
      },
    },
    "openrouter/relace/relace-apply-3": {
      standard: {
        input: 0.85,
        output: 1.25,
      },
    },
    "openrouter/relace/relace-search": {
      standard: {
        input: 1,
        output: 3,
      },
    },
    "openrouter/sakana/fugu-max": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.25,
      },
    },
    "openrouter/sakana/fugu-ultra": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "openrouter/sakana/fugu-ultra-v2": {
      standard: {
        input: 5,
        output: 30,
        cacheRead: 0.5,
      },
    },
    "openrouter/sakana/sakana-namazu": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.15,
      },
    },
    "openrouter/sao10k/l3-lunaris-8b": {
      standard: {
        input: 0.04,
        output: 0.049999999999999996,
      },
    },
    "openrouter/sao10k/l3.1-euryale-70b": {
      standard: {
        input: 0.85,
        output: 0.85,
      },
    },
    "openrouter/sao10k/l3.3-euryale-70b": {
      standard: {
        input: 0.65,
        output: 0.75,
      },
    },
    "openrouter/stealth/space-bunny-alpha": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/stepfun/step-3.5-flash": {
      standard: {
        input: 0.09999999999999999,
        output: 0.3,
      },
    },
    "openrouter/stepfun/step-3.7-flash": {
      standard: {
        input: 0.19999999999999998,
        output: 1.15,
        cacheRead: 0.04,
      },
    },
    "openrouter/tencent/hunyuan-a13b-instruct": {
      standard: {
        input: 0.14,
        output: 0.5700000000000001,
      },
    },
    "openrouter/tencent/hy-mt2-1.8b": {
      standard: {
        input: 0.044,
        output: 0.17700000000000002,
      },
    },
    "openrouter/tencent/hy-mt2-30b-a3b": {
      standard: {
        input: 0.074,
        output: 0.295,
      },
    },
    "openrouter/tencent/hy-mt2-7b": {
      standard: {
        input: 0.074,
        output: 0.295,
      },
    },
    "openrouter/tencent/hy3": {
      standard: {
        input: 0.13199999999999998,
        output: 0.5279999999999999,
        cacheRead: 0.032999999999999995,
      },
    },
    "openrouter/tencent/hy3-preview": {
      standard: {
        input: 0.18,
        output: 0.6,
        cacheRead: 0.06,
      },
    },
    "openrouter/tencent/hy4-preview": {
      standard: {
        input: 0.834,
        output: 2.501,
        cacheRead: 0.041999999999999996,
      },
    },
    "openrouter/thedrummer/cydonia-24b-v4.1": {
      standard: {
        input: 0.3,
        output: 0.5,
        cacheRead: 0.15,
      },
    },
    "openrouter/thedrummer/skyfall-36b-v2": {
      standard: {
        input: 0.55,
        output: 0.7999999999999999,
        cacheRead: 0.25,
      },
    },
    "openrouter/thedrummer/unslopnemo-12b": {
      standard: {
        input: 0.39999999999999997,
        output: 0.39999999999999997,
      },
    },
    "openrouter/thinkingmachines/inkling": {
      standard: {
        input: 0.95,
        output: 4.05,
        cacheRead: 0.16,
      },
    },
    "openrouter/thinkingmachines/inkling-small": {
      standard: {
        input: 0.44999999999999996,
        output: 1.2,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/thinkingmachines/inkling-small:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/thinkingmachines/inkling:free": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "openrouter/unbiased/pareto": {
      standard: {
        input: 2.5,
        output: 7.5,
        cacheRead: 0.25,
      },
    },
    "openrouter/upstage/solar-pro-3": {
      standard: {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
      },
    },
    "openrouter/upstage/solar-pro4": {
      standard: {
        input: 0.09,
        output: 0.36,
        cacheRead: 0.018,
      },
    },
    "openrouter/upstage/solar-mini4": {
      standard: {
        input: 0.049999999999999996,
        output: 0.19999999999999998,
        cacheRead: 0.005,
      },
    },
    "openrouter/writer/palmyra-x5": {
      standard: {
        input: 0.6,
        output: 6,
      },
    },
    "openrouter/x-ai/grok-4.3:batch": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.16,
      },
    },
    "openrouter/z-ai/glm-5.3-flash:batch": {
      standard: {
        input: 0.06,
        output: 0.19999999999999998,
        cacheRead: 0.012,
      },
    },
    "openrouter/z-ai/glm-5.3:batch": {
      standard: {
        input: 0.44999999999999996,
        output: 2,
        cacheRead: 0.09999999999999999,
      },
    },
    "openrouter/prism-ml/ternary-bonsai-2-27b": {
      standard: {
        input: 0.075,
        output: 0.5,
        cacheRead: 0.0375,
      },
    },
    "openrouter/z-ai/glm-5.3-prime": {
      standard: {
        input: 2.8,
        output: 8.8,
        cacheRead: 0.56,
      },
    },
    "openrouter/z-ai/glm-5.3-flashx": {
      standard: {
        input: 0.37,
        output: 1.25,
        cacheRead: 0.09,
      },
    },
    "openrouter/x-ai/grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "moonshotai.kimi-k3": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
      },
    },
    "global.moonshotai.kimi-k3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
      },
    },
    "us.moonshotai.kimi-k3": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
      },
    },
    "openrouter/xiaomi/mimo-v2.6-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.0028,
      },
    },
    "openrouter/xiaomi/mimo-v2.6-pro": {
      standard: {
        input: 0.435,
        output: 0.87,
        cacheRead: 0.0036,
      },
    },
    "openrouter/xiaomi/mimo-v2.6-pro-ultraspeed": {
      standard: {
        input: 4.35,
        output: 8.7,
        cacheRead: 0.036,
      },
    },
    "xiaomi_mimo/mimo-v2.6-pro": {
      standard: {
        input: 0.435,
        output: 0.87,
        cacheRead: 0.0036,
      },
    },
    "xiaomi_mimo/mimo-v2.6-flash": {
      standard: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.0028,
      },
    },
    "xai/grok-4.20-0309": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-0309": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-latest-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-latest-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-beta-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-0304": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-0304-non-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-0304-reasoning": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-non-reasoning-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-experimental-beta-reasoning-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-beta-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-experimental-beta-0304": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-multi-agent-experimental-beta-latest": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-non-reasoning-gv2": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-4.20-reasoning-gv2": {
      standard: {
        input: 1.25,
        output: 2.5,
        cacheRead: 0.19999999999999998,
      },
    },
    "openrouter/nex-agi/nex-n2.5-mini": {
      standard: {
        input: 0.024999999999999998,
        output: 0.09999999999999999,
        cacheRead: 0.0025,
      },
    },
    "openrouter/nex-agi/nex-n2.5-pro": {
      standard: {
        input: 0.075,
        output: 0.25,
        cacheRead: 0.015,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V4.1-Flash": {
      standard: {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.007,
      },
    },
    "baseten/moonshotai/Kimi-K2.6": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "baseten/moonshotai/Kimi-K2.7-Code": {
      standard: {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
      },
    },
    "baseten/moonshotai/Kimi-K3": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "baseten/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.12,
      },
    },
    "baseten/thinkingmachines/inkling": {
      standard: {
        input: 1,
        output: 4.05,
        cacheRead: 0.16999999999999998,
      },
    },
    "baseten/thinkingmachines/inkling-small": {
      standard: {
        input: 0.5,
        output: 1.2,
        cacheRead: 0.09999999999999999,
      },
    },
    "baseten/zai-org/GLM-5.2": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "baseten/zai-org/GLM-5.3-Flash": {
      standard: {
        input: 0.15,
        output: 0.5,
        cacheRead: 0.03,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V4-Flash-0731": {
      standard: {
        input: 0.13,
        output: 0.26,
        cacheRead: 0.028,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V4-Pro": {
      standard: {
        input: 1.74,
        output: 3.48,
        cacheRead: 0.145,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V4-Pro-0813": {
      standard: {
        input: 1.32,
        output: 3.9600000000000004,
        cacheRead: 0.13199999999999998,
      },
    },
    "baseten/zai-org/GLM-5.2-Fast": {
      standard: {
        input: 2.0999999999999996,
        output: 6.6000000000000005,
        cacheRead: 0.21,
      },
    },
    "xai/grok-code-fast": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-code-fast-1": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "xai/grok-code-fast-1-0825": {
      standard: {
        input: 1,
        output: 2,
        cacheRead: 0.19999999999999998,
      },
    },
    "fireworks_ai/accounts/fireworks/models/deepseek-v4-pro": {
      standard: {
        input: 1.2,
        output: 1.2,
        cacheRead: 0.6,
      },
    },
    "fireworks_ai/accounts/fireworks/models/ember-1": {
      standard: {
        input: 3,
        output: 15,
        cacheRead: 0.3,
      },
    },
    "openrouter/anthropic/claude-opus-5.5:batch": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "openrouter/cohere/command-a-plus": {
      standard: {
        input: 0.3,
        output: 1.5,
        cacheRead: 0.15,
      },
    },
    "openrouter/deepseek/deepseek-v4.1-flash:batch": {
      standard: {
        input: 0.112,
        output: 0.33599999999999997,
        cacheRead: 0.00336,
      },
    },
    "openrouter/openai/gpt-6-luna-pro:batch": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
        cacheRead: 0.005,
        cacheWrite: 0.0625,
      },
    },
    "openrouter/openai/gpt-6-luna:batch": {
      standard: {
        input: 0.049999999999999996,
        output: 0.25,
        cacheRead: 0.005,
        cacheWrite: 0.0625,
      },
    },
    "openrouter/openai/gpt-6-sol-pro:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-6-sol:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/gpt-6.1-sol-pro": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "openrouter/openai/gpt-6.1-sol-pro:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.049999999999999996,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-6.1-sol:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.049999999999999996,
        cacheWrite: 1.25,
      },
    },
    "openrouter/openai/gpt-oss-20b:batch": {
      standard: {
        input: 0.024,
        output: 0.112,
      },
    },
    "openrouter/qwen/qwen3.8-omni-flash": {
      standard: {
        input: 0.15,
        output: 0.47,
        cacheRead: 0.016,
      },
    },
    "openrouter/perceptron/perceptron-mk1.5": {
      standard: {
        input: 0.15,
        output: 1.5,
      },
    },
    "vertex_ai/gemini-2.0-flash": {
      standard: {
        input: 0.15,
        output: 0.6,
      },
    },
    "vertex_ai/gemini-2.0-flash-lite": {
      standard: {
        input: 0.075,
        output: 0.3,
      },
    },
    "vertex_ai/zai-org/glm-5.2-maas": {
      standard: {
        input: 1.4,
        output: 4.4,
        cacheRead: 0.14,
      },
    },
    "vertex_ai/meta/llama-3.3-70b-instruct-maas": {
      standard: {
        input: 0.72,
        output: 0.72,
      },
    },
    "vertex_ai/gemini-2.5-flash-tts": {
      standard: {
        input: 0.5,
        output: 10,
      },
    },
    "vertex_ai/gemini-2.5-pro-tts": {
      standard: {
        input: 1,
        output: 20,
      },
    },
    "anthropic.claude-mythos-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "global.anthropic.claude-mythos-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
        cacheWrite: 12.5,
        cacheWriteOneHour: 20,
      },
    },
    "us.anthropic.claude-mythos-5-1": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 0.275,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "us.anthropic.claude-mythos-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "apac.anthropic.claude-fable-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "au.anthropic.claude-fable-5": {
      standard: {
        input: 11,
        output: 55,
        cacheRead: 1.1,
        cacheWrite: 13.75,
        cacheWriteOneHour: 22,
      },
    },
    "apac.anthropic.claude-opus-4-7": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "apac.anthropic.claude-opus-4-8": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "apac.anthropic.claude-opus-5": {
      standard: {
        input: 5.5,
        output: 27.5,
        cacheRead: 0.55,
        cacheWrite: 6.875,
        cacheWriteOneHour: 11,
      },
    },
    "apac.anthropic.claude-opus-5-5": {
      standard: {
        input: 4.4,
        output: 22,
        cacheRead: 0.22,
        cacheWrite: 5.5,
        cacheWriteOneHour: 8.8,
      },
    },
    "apac.anthropic.claude-sonnet-4-6": {
      standard: {
        input: 3.3000000000000003,
        output: 16.5,
        cacheRead: 0.33,
        cacheWrite: 4.125,
        cacheWriteOneHour: 6.6000000000000005,
      },
    },
    "apac.anthropic.claude-sonnet-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "us.anthropic.claude-mythos-preview": {
      standard: {
        input: 27.5,
        output: 137.5,
        cacheRead: 2.75,
        cacheWrite: 34.375,
        cacheWriteOneHour: 55,
      },
    },
    "apac.anthropic.claude-mythos-preview": {
      standard: {
        input: 27.5,
        output: 137.5,
        cacheRead: 2.75,
        cacheWrite: 34.375,
        cacheWriteOneHour: 55,
      },
    },
    "au.anthropic.claude-mythos-preview": {
      standard: {
        input: 27.5,
        output: 137.5,
        cacheRead: 2.75,
        cacheWrite: 34.375,
        cacheWriteOneHour: 55,
      },
    },
    "deepseek.r1-v1:0": {
      standard: {
        input: 1.35,
        output: 5.4,
      },
    },
    "mistral.pixtral-large-2502-v1:0": {
      standard: {
        input: 2,
        output: 6,
      },
    },
    "azure_ai/MAI-Cyber-1-Flash": {
      standard: {
        input: 0.6,
        output: 3.5,
        cacheRead: 0.06,
      },
    },
    "anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "apac.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "au.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "azure_ai/claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "bedrock/us-gov-east-1/anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "bedrock/us-gov-west-1/anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "eu.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "global.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "jp.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "openrouter/anthropic/claude-sonnet-5.5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "perplexity/anthropic/claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/anthropic/claude-fable-5-1": {
      standard: {
        input: 10,
        output: 50,
        cacheRead: 0.25,
      },
    },
    "perplexity/anthropic/claude-opus-5-5": {
      standard: {
        input: 4,
        output: 20,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/openai/gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
      },
    },
    "perplexity/openai/gpt-6-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
      },
    },
    "perplexity/openai/gpt-6-luna": {
      standard: {
        input: 0.09999999999999999,
        output: 0.5,
        cacheRead: 0.01,
      },
    },
    "perplexity/google/gemini-3.8-flash": {
      standard: {
        input: 0.75,
        output: 3.75,
        cacheRead: 0.075,
      },
    },
    "perplexity/xai/grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "us-gov.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.4,
        output: 12,
        cacheRead: 0.24,
        cacheWrite: 3,
        cacheWriteOneHour: 4.8,
      },
    },
    "us.anthropic.claude-sonnet-5-5": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.22,
        cacheWrite: 2.75,
        cacheWriteOneHour: 4.4,
      },
    },
    "vertex_ai/claude-sonnet-5-5": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "vertex_ai/claude-sonnet-5-5@default": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.19999999999999998,
        cacheWrite: 2.5,
        cacheWriteOneHour: 4,
      },
    },
    "prism/deepseek-v4.1-flash": {
      standard: {
        input: 0.16999999999999998,
        output: 0.63,
        cacheRead: 0.07,
      },
    },
    "prism/deepseek-v4-flash": {
      standard: {
        input: 0.16999999999999998,
        output: 0.21,
        cacheRead: 0.07,
      },
    },
    "global.xai.grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "us.xai.grok-4.7": {
      standard: {
        input: 2.2,
        output: 6.6000000000000005,
        cacheRead: 0.55,
      },
    },
    "xai.grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "openrouter/anthropic/claude-sonnet-5.5:batch": {
      standard: {
        input: 1,
        output: 5,
        cacheRead: 0.09999999999999999,
        cacheWrite: 1.25,
        cacheWriteOneHour: 2,
      },
    },
    "baseten/deepseek-ai/DeepSeek-V4.1-Flash-Fast": {
      standard: {
        input: 0.6,
        output: 2.4,
        cacheRead: 0.14,
      },
    },
    "gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "global.openai.gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "openai.gpt-6.1-sol": {
      standard: {
        input: 2,
        output: 10,
        cacheRead: 0.09999999999999999,
        cacheWrite: 2.5,
      },
    },
    "bedrock_mantle/openai.gpt-6.1-sol": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.11,
        cacheWrite: 2.75,
      },
    },
    "us.openai.gpt-6.1-sol": {
      standard: {
        input: 2.2,
        output: 11,
        cacheRead: 0.11,
        cacheWrite: 2.75,
      },
    },
    "vertex_ai/gemini-3.8-flash-tts": {
      standard: {
        input: 0.5,
        output: 9,
      },
    },
    "vertex_ai/gemini-3.8-flash-lite-tts": {
      standard: {
        input: 0.5,
        output: 6,
      },
    },
    "vertex_ai/xai/grok-4.7": {
      standard: {
        input: 2,
        output: 6,
        cacheRead: 0.5,
      },
    },
    "openrouter/inclusionai/ling-3.1-flash": {
      standard: {
        input: 0,
        output: 0,
      },
    },
    "azure_ai/kimi-k2-thinking": {
      standard: {
        input: 0.6,
        output: 2.5,
      },
    },
  },
};
