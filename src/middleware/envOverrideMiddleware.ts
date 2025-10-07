import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { getEnvOverrides } from "../envOverrides";

export function envOverrideMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const overrides = await getEnvOverrides();
		if (overrides) {
			const target = c.env as unknown as Record<string, string>;
			for (const [key, value] of Object.entries(overrides)) {
				target[key] = value;
			}
		}
		await next();
	};
}
