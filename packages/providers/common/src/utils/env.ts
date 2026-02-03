/**
 * 안전한 환경 변수 빌드
 * process.env를 안전하게 병합
 */
export function buildSafeEnv(
  configEnv?: Record<string, string>
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (configEnv) {
    for (const [key, value] of Object.entries(configEnv)) {
      env[key] = value;
    }
  }

  return env;
}
