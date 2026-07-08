function configuredCronSecrets() {
  return [process.env.CRON_SECRET, process.env.PORTFOLIO_SNAPSHOT_SECRET].filter(
    (secret): secret is string => Boolean(secret)
  );
}

export function cronAuthorized(request: Request) {
  const secrets = configuredCronSecrets();
  if (secrets.length === 0) return false;

  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  return secrets.some((secret) => authorization === `Bearer ${secret}` || querySecret === secret);
}
