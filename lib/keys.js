// One Superstat key per club (NXT, Frosh and Prep are separate clubs). Accepts a
// comma-separated SUPERSTAT_API_KEYS and/or one variable per division.
export function apiKeysFromEnv(env = process.env) {
  return [...new Set(
    [env.SUPERSTAT_API_KEYS, env.SUPERSTAT_API_KEY, env.NXT_KEY, env.FROSH_KEY, env.PREP_KEY]
      .flatMap(v => String(v || '').split(','))
      .map(k => k.trim())
      .filter(Boolean),
  )];
}
