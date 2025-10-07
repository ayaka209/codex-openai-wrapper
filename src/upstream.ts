import { normalizeModelName } from "./utils";
import { getRefreshedAuth, refreshAccessToken } from "./auth_kv"; // Updated import
import { getBaseInstructions } from "./instructions";
import { Env, InputItem, Tool } from "./types"; // Import types
import { getProxyAgent } from "./proxyConfig";

type ReasoningParam = {
	effort?: string;
	summary?: string;
};

type ToolChoice = "auto" | "none" | { type: string; function: { name: string } };

type OllamaPayload = Record<string, unknown>;

type ErrorBody = {
	error?: {
		message: string;
	};
	raw?: string;
	[key: string]: unknown;
};

async function generateSessionId(instructions: string | undefined, inputItems: InputItem[]): Promise<string> {
	const content = `${instructions || ""}|${JSON.stringify(inputItems)}`;
	const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function startUpstreamRequest(
	env: Env, // Pass the environment object
	model: string,
	inputItems: InputItem[],
	options?: {
		instructions?: string;
		tools?: Tool[];
		toolChoice?: ToolChoice;
		parallelToolCalls?: boolean;
		reasoningParam?: ReasoningParam;
		ollamaPath?: string; // Added for Ollama specific paths
		ollamaPayload?: OllamaPayload; // Added for Ollama specific payloads
		verbose?: boolean; // Added for verbose logging
	}
): Promise<{ response: Response | null; error: Response | null }> {
	const { instructions, tools, toolChoice, parallelToolCalls, reasoningParam, verbose } = options || {};

	if (verbose) {
		console.log("🔍 [VERBOSE] startUpstreamRequest called");
		console.log("  Model:", model);
		console.log("  Input items count:", inputItems.length);
		console.log("  Tools count:", tools?.length || 0);
		console.log("  Reasoning effort:", reasoningParam?.effort || "none");
	}

	const { accessToken, accountId } = await getRefreshedAuth(env);

	if (verbose) {
		console.log("  Auth method:", env.CHATGPT_ACCESS_TOKEN ? "Direct Token" : "OAuth2");
		console.log("  Account ID:", accountId || "not set");
	}

	// Access token is required, account ID is optional
	if (!accessToken) {
		return {
			response: null,
			error: new Response(
				JSON.stringify({
					error: {
						message: "Missing ChatGPT access token. Set CHATGPT_ACCESS_TOKEN or run 'codex login'"
					}
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			)
		};
	}

	const include: string[] = [];
	if (reasoningParam?.effort !== "none") {
		include.push("reasoning.encrypted_content");
	}

	const isOllamaRequest = Boolean(options?.ollamaPath);
	const requestUrl = isOllamaRequest
		? `${env.OLLAMA_API_URL}${options?.ollamaPath}` // Assuming OLLAMA_API_URL is in Env
		: env.CHATGPT_RESPONSES_URL;

	const sessionId = isOllamaRequest ? undefined : await generateSessionId(instructions, inputItems);

	const baseInstructions = await getBaseInstructions();

	const requestBody = isOllamaRequest
		? JSON.stringify(options?.ollamaPayload)
		: JSON.stringify({
				model: normalizeModelName(model, env.DEBUG_MODEL),
				instructions: instructions || baseInstructions, // Use fetched instructions
				input: inputItems,
				tools: tools || [],
				tool_choice:
					(toolChoice && (toolChoice === "auto" || toolChoice === "none" || typeof toolChoice === "object")) ||
					toolChoice === undefined
						? toolChoice || "auto"
						: "auto",
				parallel_tool_calls: parallelToolCalls || false,
				store: false,
				stream: true,
				include: include,
				prompt_cache_key: sessionId,
				...(reasoningParam && { reasoning: reasoningParam })
			});

	const headers: HeadersInit = {
		"Content-Type": "application/json"
	};

	if (!isOllamaRequest) {
		headers["Authorization"] = `Bearer ${accessToken}`;
		headers["Accept"] = "text/event-stream";
		if (accountId) {
			headers["chatgpt-account-id"] = accountId;
		}
		headers["OpenAI-Beta"] = "responses=experimental";
		if (sessionId) {
			headers["session_id"] = sessionId;
		}
	}

	if (verbose) {
		console.log("🌐 [VERBOSE] Sending upstream request");
		console.log("  URL:", requestUrl);
		console.log("  Method: POST");
		console.log("  Headers:", JSON.stringify({
			...headers,
			Authorization: headers["Authorization"] ? `Bearer ${(headers["Authorization"] as string).substring(0, 20)}...` : undefined
		}, null, 2));
		console.log("  Request body preview:", requestBody.substring(0, 500) + (requestBody.length > 500 ? "..." : ""));
		console.log("  Session ID:", sessionId || "none");
	}

	const startTime = Date.now();

	try {
		// Get proxy agent if configured (only for upstream API, not for GitHub)
		const proxyAgent = await getProxyAgent();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fetchOptions: RequestInit & { dispatcher?: any } = {
			method: "POST",
			headers: headers,
			body: requestBody
			// Cloudflare Workers fetch does not have a 'timeout' option like requests.
			// You might need to implement a custom timeout using AbortController if necessary.
		};

		// Add proxy dispatcher if available (Node.js undici-based fetch)
		if (proxyAgent) {
			fetchOptions.dispatcher = proxyAgent;
			if (verbose) {
				console.log("  Using proxy for upstream request");
			}
		}

		let upstreamResponse = await fetch(requestUrl, fetchOptions);

		// Response received
		const duration = Date.now() - startTime;

		if (verbose) {
			console.log("✅ [VERBOSE] Received upstream response");
			console.log("  Status:", upstreamResponse.status, upstreamResponse.statusText);
			console.log("  Duration:", duration + "ms");
			console.log("  Headers:", JSON.stringify(Object.fromEntries(upstreamResponse.headers.entries()), null, 2));

			// Preview response body for verbose logging (if it's a stream)
			if (upstreamResponse.body && upstreamResponse.ok) {
				try {
					const [previewStream, actualStream] = upstreamResponse.body.tee();
					const reader = previewStream.getReader();
					const decoder = new TextDecoder();
					let previewText = "";
					let bytesRead = 0;
					const maxPreviewBytes = 500;

					// Read first chunk for preview
					while (bytesRead < maxPreviewBytes) {
						const { done, value } = await reader.read();
						if (done) break;
						previewText += decoder.decode(value, { stream: true });
						bytesRead += value.length;
						if (bytesRead >= maxPreviewBytes) break;
					}

					reader.releaseLock();
					console.log("  Response body preview:", previewText.substring(0, 500) + (previewText.length > 500 || bytesRead >= maxPreviewBytes ? "..." : ""));

					// Replace the body with the actual stream for downstream processing
					upstreamResponse = new Response(actualStream, {
						status: upstreamResponse.status,
						statusText: upstreamResponse.statusText,
						headers: upstreamResponse.headers
					});
				} catch (previewError) {
					console.warn("  Failed to preview response body:", previewError);
				}
			}
		}

		if (!upstreamResponse.ok) {
			// Handle HTTP errors from upstream
			const errorBody = (await upstreamResponse
				.json()
				.catch(() => ({ raw: upstreamResponse.statusText }))) as ErrorBody;

			// Log complete error details for OpenAI failures
			console.error("=== OPENAI API ERROR ===");
			console.error("Status:", upstreamResponse.status, upstreamResponse.statusText);
			console.error("URL:", requestUrl);
			console.error("Headers:", Object.fromEntries(upstreamResponse.headers.entries()));
			console.error("Error Body:", JSON.stringify(errorBody, null, 2));
			console.error("Request Body:", requestBody);
			console.error("========================");

			// Check if it's a 401 Unauthorized and we can refresh the token
			if (upstreamResponse.status === 401 && env.OPENAI_CODEX_AUTH) {
				const refreshedTokens = await refreshAccessToken(env);
				if (refreshedTokens) {
					const headers: HeadersInit = {
						"Content-Type": "application/json"
					};

				if (!isOllamaRequest) {
					headers["Authorization"] = `Bearer ${refreshedTokens.access_token}`;
					headers["Accept"] = "text/event-stream";
					const retryAccountId = refreshedTokens.account_id || accountId;
					if (retryAccountId) {
						headers["chatgpt-account-id"] = retryAccountId;
					}
					headers["OpenAI-Beta"] = "responses=experimental";
					if (sessionId) {
						headers["session_id"] = sessionId;
					}
				}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const retryFetchOptions: RequestInit & { dispatcher?: any } = {
						method: "POST",
						headers: headers,
						body: requestBody
					};

					// Use proxy for retry as well
					if (proxyAgent) {
						retryFetchOptions.dispatcher = proxyAgent;
					}

					const retryResponse = await fetch(requestUrl, retryFetchOptions);

					if (retryResponse.ok) {
						return { response: retryResponse, error: null };
					}
				}
			}

			return {
				response: null,
				error: new Response(
					JSON.stringify({
						error: {
							message: (errorBody.error && errorBody.error.message) || "Upstream error"
						}
					}),
					{ status: upstreamResponse.status, headers: { "Content-Type": "application/json" } }
				)
			};
		}

		return { response: upstreamResponse, error: null };
	} catch (e: unknown) {
		// Log complete error details for fetch failures
		console.error("=== UPSTREAM REQUEST FAILURE ===");
		console.error("URL:", requestUrl);
		console.error("Request Body:", requestBody);
		console.error("Headers:", headers);
		console.error("Error:", e);
		if (e instanceof Error) {
			console.error("Error Message:", e.message);
			console.error("Error Stack:", e.stack);
		}
		console.error("================================");

		return {
			response: null,
			error: new Response(
				JSON.stringify({
					error: {
						message: `Upstream ChatGPT request failed: ${e instanceof Error ? e.message : String(e)}`
					}
				}),
				{ status: 502, headers: { "Content-Type": "application/json" } }
			)
		};
	}
}
