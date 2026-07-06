/**
 * Environment variable utilities.
 * Never prints API keys in output.
 */

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

export function getEnvVar(name: string): string | undefined {
  return process.env[name];
}

export function requireEnvVar(name: string, provider: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} for provider "${provider}". Set it in your environment or run: media-gen config init`,
    );
  }
  return value;
}
