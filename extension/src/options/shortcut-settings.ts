export function shortcutSettingsUrl(userAgent = navigator.userAgent): string {
  return /\bEdg\//u.test(userAgent)
    ? 'edge://extensions/shortcuts'
    : 'chrome://extensions/shortcuts'
}
