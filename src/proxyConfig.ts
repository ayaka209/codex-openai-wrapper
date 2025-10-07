/**
 * Proxy configuration module
 * Handles HTTP_PROXY and HTTPS_PROXY settings for upstream ChatGPT API requests only
 * Does NOT affect other requests (e.g., GitHub instructions fetch)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let proxyAgent: any = null;
let proxyChecked = false;
let tlsConfigured = false;

/**
 * Configure TLS settings based on NODE_TLS_REJECT_UNAUTHORIZED environment variable
 * Should be called early in the application lifecycle
 */
export function configureTLS(): void {
	if (tlsConfigured) {
		return;
	}

	tlsConfigured = true;

	const tlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

	if (tlsRejectUnauthorized === "0") {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		console.warn("⚠️  TLS certificate validation DISABLED (NODE_TLS_REJECT_UNAUTHORIZED=0)");
		console.warn("⚠️  This is insecure and should only be used in development with self-signed certificates");
	}
}

/**
 * Get proxy agent for upstream requests
 * Returns null if no proxy is configured
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProxyAgent(): Promise<any> {
	if (proxyChecked) {
		return proxyAgent;
	}

	proxyChecked = true;

	// Configure TLS settings first
	configureTLS();

	const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
	const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || httpProxy;

	if (httpProxy || httpsProxy) {
		// Use HTTPS_PROXY for HTTPS URLs, fallback to HTTP_PROXY
		const proxyUrl = httpsProxy || httpProxy;

		if (!proxyUrl) {
			return null;
		}

		console.log(`🌐 Proxy configured for upstream API: ${proxyUrl}`);

		try {
			// Dynamic import to avoid TypeScript issues with undici types
			const { ProxyAgent } = await import("undici");
			proxyAgent = new ProxyAgent(proxyUrl);
		} catch (error) {
			console.error("Failed to configure proxy:", error);
		}
	}

	return proxyAgent;
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured(): boolean {
	return proxyAgent !== null;
}
