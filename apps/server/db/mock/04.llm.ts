const LLM_MOCK = [
  { id: 'gemini-2.5-pro', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
  { id: 'claude-sonnet-4-5', costPerMillionInputTokens: 3.3, costPerMillionOutputTokens: 16.5 },
  { id: 'gpt-5-codex', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
  { id: 'o3', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
  { id: 'o4-mini', costPerMillionInputTokens: 1.1, costPerMillionOutputTokens: 4.4 },
  { id: 'gpt-4.1', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
  { id: 'gemini-flash-latest', costPerMillionInputTokens: 0.5, costPerMillionOutputTokens: 1.5 },
]

export { LLM_MOCK }
