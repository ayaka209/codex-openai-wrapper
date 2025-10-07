import { serve } from "@hono/node-server";
import app from "../src/index";
import { getEnvOverrides } from "../src/envOverrides";
import type { Env } from "../src/types";

async function main() {
	await getEnvOverrides();

	function requireEnvVar(key: keyof Env): string {
		const value = process.env[key as string];
		if (!value) {
			throw new Error(`Missing required environment variable: ${String(key)}`);
		}
		return value;
	}

	function getEnvVar(key: string, defaultValue: string = ""): string {
		return process.env[key] || defaultValue;
	}

	const bindings: Env = {
		OPENAI_API_KEY: requireEnvVar("OPENAI_API_KEY"),
		OPENAI_CODEX_AUTH: getEnvVar("OPENAI_CODEX_AUTH", "{}"),
		CHATGPT_LOCAL_CLIENT_ID: getEnvVar("CHATGPT_LOCAL_CLIENT_ID", "app_EMoamEEZ73f0CkXaXp7hrann"),
		CHATGPT_RESPONSES_URL: getEnvVar("CHATGPT_RESPONSES_URL", "https://chatgpt.com/backend-api/responses"),
		CHATGPT_ACCESS_TOKEN: process.env.CHATGPT_ACCESS_TOKEN,
		CHATGPT_ACCOUNT_ID: process.env.CHATGPT_ACCOUNT_ID,
		OLLAMA_API_URL: process.env.OLLAMA_API_URL,
		DEBUG_MODEL: process.env.DEBUG_MODEL,
		REASONING_EFFORT: process.env.REASONING_EFFORT as Env["REASONING_EFFORT"],
		REASONING_SUMMARY: process.env.REASONING_SUMMARY as Env["REASONING_SUMMARY"],
		REASONING_COMPAT: process.env.REASONING_COMPAT as Env["REASONING_COMPAT"],
		VERBOSE: process.env.VERBOSE as Env["VERBOSE"],
		NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
		KV: undefined
	};

	const port = Number.parseInt(process.env.PORT || "8787", 10);

	serve({
		port,
		fetch: (request) => {
			const ctx: ExecutionContext = {
				waitUntil: (promise) => promise.catch((err) => console.error("waitUntil error", err)),
				passThroughOnException: () => {},
				props: {}
			};
			return app.fetch(request, bindings, ctx);
		}
	});

	console.log(`Local server listening on http://localhost:${port}`);
}

main().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
