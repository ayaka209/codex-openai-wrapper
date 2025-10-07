type EnvOverrideMap = Record<string, string>;

let cachedOverrides: Promise<EnvOverrideMap | null> | undefined;
let loggedSuccess = false;
let loggedFailure = false;

function parseEnvContent(content: string): EnvOverrideMap {
	const overrides: EnvOverrideMap = {};
	const lines = content.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}

		const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
		if (!match) {
			continue;
		}

		const key = match[1];
		let value = match[2] ?? "";

		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1).replace(/\\n/g, "\n");
		} else if (value.startsWith("'") && value.endsWith("'")) {
			value = value.slice(1, -1);
		}

		overrides[key] = value;
	}

	return overrides;
}

async function loadOverrides(): Promise<EnvOverrideMap | null> {
	try {
		const fs = (await import("fs/promises")) as typeof import("fs/promises");
		const content = await fs.readFile(".env", "utf8");
		const overrides = parseEnvContent(content);

		if (typeof process !== "undefined" && process?.env) {
			for (const [key, value] of Object.entries(overrides)) {
				process.env[key] = value;
			}
		}

		if (!loggedSuccess) {
			console.log("Loaded environment overrides from .env");
			loggedSuccess = true;
		}

		return overrides;
	} catch (error) {
		// Ignore missing file errors, log other failures only once
		const code = error instanceof Error && "code" in error ? (error as { code?: string }).code : undefined;
		const message = error instanceof Error ? error.message || "" : "";
		const isMissingFile = code === "ENOENT";
		const isModuleMissing = code === "ERR_MODULE_NOT_FOUND" || message.includes("Cannot find module");
		const isNotImplemented = message.includes("not implemented") || message.includes("not supported");

		if (!isMissingFile && !isModuleMissing && !isNotImplemented && !loggedFailure) {
			console.warn("Failed to load .env overrides", error);
			loggedFailure = true;
		}

		return null;
	}
}

export function getEnvOverrides(): Promise<EnvOverrideMap | null> {
	if (!cachedOverrides) {
		cachedOverrides = loadOverrides();
	}
	return cachedOverrides;
}

// Attempt to load overrides eagerly so process.env is populated asap in Node environments.
void getEnvOverrides();
