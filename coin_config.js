window.TrenchCoinConfig = {
  // After creating the Pump.fun coin, paste the token mint address here.
  mint: "9m7AQ8LUHi8gbrtjh8fdcyoTLFgD4AzGQh2mZiTFpump",
  minHoldTokens: 100,
  requireHolderToPlay: false,
  rpcUrl: "https://solana-rpc.publicnode.com",
  rpcFallbackUrls: [
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com"
  ],
  // After creating the Pump.fun coin, paste the direct coin page URL here.
  purchaseUrl: "https://pump.fun/coin/9m7AQ8LUHi8gbrtjh8fdcyoTLFgD4AzGQh2mZiTFpump",
  // Treasury wallet that receives the SOL DEX-fund contribution.
  dexFundWallet: "2v6ZGBSLEiA8YA4nfkMbtudybNSeUafhjGttg4EK3JR8",
  dexContributionUsd: 1,
  dexGoalUsd: 299,
  // After deploying the settlement API, paste its HTTPS URL here.
  settlementApiBase: ""
};
