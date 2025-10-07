import * as fs from "fs";
import * as path from "path";

// Cache for instructions
let instructionsCache: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Fetch instructions from local file or remote URL at runtime
export async function getBaseInstructions(): Promise<string> {
	// Check if cache is valid
	const now = Date.now();
	if (instructionsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
		return instructionsCache;
	}


	// Fallback to remote fetch (with proxy support)
	try {
		// In Node.js, HTTP_PROXY environment variable is automatically respected by fetch
		const response = await fetch("https://raw.githubusercontent.com/openai/codex/refs/heads/main/codex-rs/core/gpt_5_codex_prompt.md");
		if (!response.ok) {
			throw new Error(`Failed to fetch instructions: ${response.status}`);
		}
		const instructions = await response.text();

		// Update cache
		instructionsCache = instructions;
		cacheTimestamp = now;

		return instructions;
	} catch (error) {
		console.error("Error fetching instructions:", error);

		// If we have stale cache, use it as fallback
		if (instructionsCache) {
			console.warn("Using stale cache due to fetch error");
			return instructionsCache;
		}

		// Try to read from local file first
		try {
			const localPath = path.join(__dirname, "gpt_5_codex_prompt.md");
			console.warn(localPath,"Use local instructions");
			if (fs.existsSync(localPath)) {
				const instructions = fs.readFileSync(localPath, "utf-8");

				// Update cache
				instructionsCache = instructions;
				cacheTimestamp = now;

				return instructions;
			}
		} catch (error) {
			console.warn("Failed to read localgpt_5_codex_prompt.md:", error);
		}

		// Fallback to minimal instructions if fetch fails and no cache
		return `You are a coding agent running in the Codex CLI, a terminal-based coding assistant. You are expected to be precise, safe, and helpful.`;
	}
}
