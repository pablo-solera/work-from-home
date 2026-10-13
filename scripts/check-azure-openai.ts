import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";
import { getAzureConfig } from "../lib/assistant/chat-service";

try {
  const config = getAzureConfig();
  const model = createAzure({
    apiKey: config.apiKey,
    apiVersion: config.apiVersion,
    baseURL: config.baseURL,
    useDeploymentBasedUrls: config.useDeploymentBasedUrls,
  }).chat(config.deployment);

  console.log(`Azure endpoint: ${config.baseURL}`);
  console.log(`Azure deployment: ${config.deployment}`);
  console.log("Azure API key: configurada");
  console.log(`Azure URL mode: ${config.isFoundryProject ? "Foundry project" : config.useDeploymentBasedUrls ? "deployment-based" : "versioned v1"}`);

  const result = await generateText({ model, maxOutputTokens: 8, prompt: "Responde únicamente: OK" });
  console.log(`Azure response: ${result.text.trim()}`);
  console.log("Azure OpenAI connection OK.");
} catch (error) {
  console.error("Azure OpenAI connection failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
