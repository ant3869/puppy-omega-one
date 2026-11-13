export function isTrustedGuiUrl(candidate: string, port: number): boolean {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port === String(port) &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export function allowedExternalUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}
