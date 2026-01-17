// 날짜/시간 포맷 유틸리티
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// 문자열 축약
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * ANSI escape 코드 제거
 * 터미널 출력에서 색상/스타일 코드를 제거하여 깔끔하게 표시
 *
 * 예: "\x1b[38;2;153;153;153mHello\x1b[0m" → "Hello"
 */
export function stripAnsiCodes(text: string): string {
  // ANSI escape 시퀀스 패턴: ESC[ ... (문자) 또는 [ ... (문자)
  // \x1b\[ 또는 \[ 로 시작하여 [0-9;?]* 뒤에 [a-zA-Z]가 오는 패턴
  const ansiRegex = /(\x1b\[|\[)[0-9;?]*[a-zA-Z]/g;
  return text.replace(ansiRegex, '');
}
