/**
 * Output Utilities
 * Common utilities for processing terminal output
 */

/**
 * Escape HTML special characters to prevent XSS
 * This is critical for security when using dangerouslySetInnerHTML
 */
export function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Convert ANSI escape codes to HTML with proper sanitization
 * 1. Escapes HTML special characters (prevents XSS)
 * 2. Converts ANSI color codes to HTML spans
 * 3. Removes terminal control sequences (cursor movement, etc.)
 */
export function convertAnsiToHtml(text: string): string {
  // CRITICAL: Escape HTML first to prevent XSS attacks
  const escapedText = escapeHtml(text);

  // 1. Process all ANSI CSI sequences (ESC [ ... final_byte)
  // final byte is in range 0x40-0x7E (@-~)
  // Keep color codes (ending with 'm'), remove control codes
  const allCsiRegex = /\x1b\[[0-9;?]*[@-~]/g;
  let cleanedText = escapedText.replace(allCsiRegex, (match) => {
    // Keep color codes (ending with 'm')
    if (match.endsWith('m')) {
      return match;
    }
    // Remove control codes (H, J, K, X, C, A, B, D, h, l, etc.)
    return '';
  });

  // 2. Convert ANSI color codes to HTML
  const ansiColorRegex = /\x1b\[([0-9;?]*)m/g;

  let result = '';
  let lastIndex = 0;
  let currentStyles: string[] = [];

  const styleMap: Record<string, string> = {
    '0': '',           // Reset
    '1': 'font-weight:bold',  // Bold
    '2': 'opacity:0.7',  // Dim
    '3': 'font-style:italic',  // Italic
    '4': 'text-decoration:underline',  // Underline
    '30': 'color:black',
    '31': 'color:#ef5350',  // Red
    '32': 'color:#a5d6a7',  // Green
    '33': 'color:#ffca28',  // Yellow
    '34': 'color:#42a5f5',  // Blue
    '35': 'color:#ab47bc',  // Magenta
    '36': 'color:#26c6da',  // Cyan
    '37': 'color:#ffffff',  // White
    '90': 'color:#616161',  // Bright Black (Dark Gray)
    '91': 'color:#ef5350',  // Bright Red
    '92': 'color:#a5d6a7',  // Bright Green
    '93': 'color:#ffca28',  // Bright Yellow
    '94': 'color:#42a5f5',  // Bright Blue
    '95': 'color:#ab47bc',  // Bright Magenta
    '96': 'color:#26c6da',  // Bright Cyan
    '97': 'color:#ffffff',  // Bright White
  };

  cleanedText.replace(ansiColorRegex, (match, codes, offset) => {
    result += cleanedText.slice(lastIndex, offset);

    const codeList = codes.split(';');
    for (const code of codeList) {
      if (code === '0') {
        // Reset - close all open spans
        while (currentStyles.length > 0) {
          result += '</span>';
          currentStyles.pop();
        }
      } else if (code.startsWith('38') || code.startsWith('48')) {
        // 256-color and RGB codes - skip for now
        continue;
      } else if (styleMap[code]) {
        const style = styleMap[code];
        if (style && !currentStyles.includes(style)) {
          result += `<span style="${style}">`;
          currentStyles.push(style);
        }
      }
    }

    lastIndex = offset + match.length;
    return '';
  });

  result += cleanedText.slice(lastIndex);

  // Close any remaining open spans
  while (currentStyles.length > 0) {
    result += '</span>';
    currentStyles.pop();
  }

  return result;
}
