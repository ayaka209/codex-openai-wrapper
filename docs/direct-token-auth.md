# Direct Token Authentication

This project now supports two authentication methods:

## Method 1: OAuth2 (Original)

Uses `codex login` to get OAuth2 credentials from OpenAI Codex CLI.

Required environment variables:
- `OPENAI_CODEX_AUTH` - Full OAuth2 JSON from `~/.codex/auth.json`

## Method 2: Direct Token (New, Simpler)

Use an access token directly without OAuth flow.

Required environment variables:
- `CHATGPT_ACCESS_TOKEN` - Your ChatGPT access token (Bearer token)
- `CHATGPT_ACCOUNT_ID` - Your ChatGPT account ID (optional but recommended)

### Setup

1. **Get your access token**
   - Log in to ChatGPT in your browser
   - Open Developer Tools (F12)
   - Go to Network tab
   - Make a request (e.g., send a message)
   - Find a request to `chatgpt.com/backend-api/`
   - Copy the `Authorization: Bearer sk-...` token

2. **Update your `.env` file**:
   ```bash
   # Direct token authentication
   CHATGPT_ACCESS_TOKEN=sk-proj-your-actual-token-here
   CHATGPT_ACCOUNT_ID=user-your-account-id-here
   ```

3. **Start the server**:
   ```bash
   npm run start:local
   ```

### Advantages

- ✅ No need to install Codex CLI
- ✅ No OAuth flow complexity
- ✅ Simpler setup
- ✅ Direct control over tokens

### Notes

- If both `CHATGPT_ACCESS_TOKEN` and `OPENAI_CODEX_AUTH` are set, `CHATGPT_ACCESS_TOKEN` takes precedence
- Token refresh is not automatic with direct tokens (you'll need to update manually when expired)
- The `CHATGPT_ACCOUNT_ID` is optional but may be required for some API features

### Security

⚠️ **Important**: Keep your access token secure! Never commit it to version control.

- Use `.env` files (already in `.gitignore`)
- For production, use environment variables or secrets management
