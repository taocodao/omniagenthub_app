// utils/tokenStorage.ts
export const userTokens = new Map<string, any>();

export function getTokens(notebookId: string) {
  console.log(`🔍 [TOKEN-STORAGE] Getting tokens for: ${notebookId}`);
  console.log(`   📊 Total tokens in storage: ${userTokens.size}`);
  console.log(`   🗂️ Available IDs: [${Array.from(userTokens.keys()).join(', ')}]`);
  const tokens = userTokens.get(notebookId);
  console.log(`   ✅ Found tokens: ${tokens ? 'YES' : 'NO'}`);
  return tokens;
}

export function setTokens(notebookId: string, tokens: any) {
  console.log(`💾 [TOKEN-STORAGE] Storing tokens for: ${notebookId}`);
  userTokens.set(notebookId, tokens);
  console.log(`   📊 Total tokens now: ${userTokens.size}`);
  console.log(`   🗂️ All IDs: [${Array.from(userTokens.keys()).join(', ')}]`);
}
