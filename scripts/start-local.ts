import { serve } from "@hono/node-server";
import app from "../src/index";
import { getEnvOverrides } from "../src/envOverrides";
import type { Env } from "../src/types";

await getEnvOverrides();

function requireEnvVar(key: keyof Env): string {
	const value = process.env[key as string];
	if (!value) {
		throw new Error(`Missing required environment variable: ${String(key)}`);
	}
	return value;
}

const bindings: Env = {
	OPENAI_API_KEY: requireEnvVar("OPENAI_API_KEY"),
	OPENAI_CODEX_AUTH: requireEnvVar("OPENAI_CODEX_AUTH"),
	CHATGPT_LOCAL_CLIENT_ID: requireEnvVar("CHATGPT_LOCAL_CLIENT_ID"),
	CHATGPT_RESPONSES_URL: requireEnvVar("CHATGPT_RESPONSES_URL"),
	OLLAMA_API_URL: process.env.OLLAMA_API_URL,
	DEBUG_MODEL: process.env.DEBUG_MODEL,
	REASONING_EFFORT: process.env.REASONING_EFFORT as Env["REASONING_EFFORT"],
	REASONING_SUMMARY: process.env.REASONING_SUMMARY as Env["REASONING_SUMMARY"],
	REASONING_COMPAT: process.env.REASONING_COMPAT as Env["REASONING_COMPAT"],
	VERBOSE: process.env.VERBOSE as Env["VERBOSE"],
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
