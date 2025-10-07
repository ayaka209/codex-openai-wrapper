# Recent Changes

## New Features

### 1. Direct Token Authentication (Alternative to OAuth2)

Added a simpler authentication method that doesn't require the Codex CLI or OAuth2 flow.

**New Environment Variables:**
- `CHATGPT_ACCESS_TOKEN` - Direct ChatGPT access token (Bearer token)
- `CHATGPT_ACCOUNT_ID` - ChatGPT account ID (optional)

**Usage:**
```bash
# Get your token from ChatGPT browser session
CHATGPT_ACCESS_TOKEN=sk-proj-your-actual-token-here
CHATGPT_ACCOUNT_ID=user-your-account-id  # Optional
```

**Advantages:**
- ✅ No Codex CLI installation needed
- ✅ No OAuth2 setup complexity
- ✅ Immediate setup

**Limitations:**
- ⚠️ Manual token refresh required (when token expires)
- ⚠️ Best for development/testing

### 2. Local Instructions File Support

The system now prioritizes reading instructions from the local `src/prompt.md` file before fetching from GitHub.

**Benefits:**
- ✅ Faster startup (no network request)
- ✅ Works offline
- ✅ Customizable instructions
- ✅ Falls back to remote fetch if local file not found

### 3. Optional Account ID

Made `CHATGPT_ACCOUNT_ID` optional in requests. The system will:
- Use the account ID if provided
- Omit the `chatgpt-account-id` header if not available
- Most API features work without it

## Backward Compatibility

✅ **All changes are backward compatible**

- Existing OAuth2 authentication (`OPENAI_CODEX_AUTH`) still works exactly as before
- No breaking changes to existing configurations
- Token refresh logic unchanged for OAuth2 users
- All existing environment variables function as expected

## Configuration Priority

When both authentication methods are configured:
1. `CHATGPT_ACCESS_TOKEN` takes precedence (direct token)
2. Falls back to `OPENAI_CODEX_AUTH` (OAuth2) if direct token not set

## Updated Documentation

- ✅ README.md updated with authentication method comparison
- ✅ New guide: `docs/direct-token-auth.md`
- ✅ Environment variable documentation updated
- ✅ Quick start examples for both methods

## Files Modified

1. `src/types.ts` - Added new environment variable types
2. `src/auth_kv.ts` - Added direct token support with priority logic
3. `src/upstream.ts` - Made account ID optional
4. `src/instructions.ts` - Added local file reading with cache
5. `scripts/start-local.ts` - Added new environment variable bindings
6. `README.md` - Comprehensive documentation updates
7. `.env` - Example configuration updated
8. `docs/direct-token-auth.md` - New authentication guide

## Testing

Run the following to verify:
```bash
# Type check
npm run tsc

# Start local server
npm run start:local

# Test health endpoint
curl http://localhost:8787/health
```

## Migration Guide

### For existing users (OAuth2):
No action required. Your existing configuration continues to work.

### For new users wanting simpler setup:
1. Get your ChatGPT access token from browser (see `docs/direct-token-auth.md`)
2. Set `CHATGPT_ACCESS_TOKEN` in your `.env` file
3. Optionally set `CHATGPT_ACCOUNT_ID`
4. Start the server

### To switch from OAuth2 to Direct Token:
Simply add `CHATGPT_ACCESS_TOKEN` to your configuration. It will take precedence over `OPENAI_CODEX_AUTH`.
