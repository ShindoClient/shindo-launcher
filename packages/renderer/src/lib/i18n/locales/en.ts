export const en = {
  // TitleBar
  'titleBar.minimize': 'Minimize',
  'titleBar.close': 'Close',
  'titleBar.settings': 'Settings',
  'titleBar.logs': 'Logs',

  // Home
  'home.play': 'PLAY',
  'home.stop': 'STOP',
  'home.launching': 'LAUNCHING...',
  'home.updating': 'UPDATING...',
  'home.accountRequired': 'SELECT AN ACCOUNT',
  'home.status.started': 'ShindoClient started.',
  'home.status.startedPid': 'ShindoClient started (PID {pid}).',
  'home.status.stopped': 'Game closed.',
  'home.status.failed': 'Launch failed: {message}',
  'home.version.none': 'No version installed',
  'home.version.label': 'Version {version}',
  'home.changeVersion': 'Change version',

  // Build selector
  'builds.title': 'Select Build',
  'builds.stable': 'Stable',
  'builds.snapshot': 'Snapshot',
  'builds.dev': 'Dev',
  'builds.latest': 'Latest',
  'builds.select': 'Select',
  'builds.noneAvailable': 'No builds available',

  // Accounts
  'accounts.title': 'Accounts',
  'accounts.empty': 'No accounts added.',
  'accounts.add': 'Add Account',
  'accounts.limitReached': 'Account limit reached ({limit})',
  'accounts.microsoft': 'Sign in with Microsoft',
  'accounts.offline': 'Offline Account',
  'accounts.offlineName': 'Username',
  'accounts.offlineNamePlaceholder': 'Enter username',
  'accounts.offlineAdd': 'Add',
  'accounts.remove': 'Remove',
  'accounts.confirmRemove': 'Confirm remove?',
  'accounts.active': 'Active',
  'accounts.addingMicrosoft': 'Opening browser...',

  // Settings
  'settings.title': 'Settings',
  'settings.back': 'Back',
  'settings.save': 'Saved',
  'settings.section.java': 'Java',
  'settings.section.memory': 'Memory',
  'settings.section.advanced': 'Advanced',
  'settings.section.launcher': 'Launcher',
  'settings.ram.label': 'RAM Allocation',
  'settings.ram.description': 'Memory available to Minecraft.',
  'settings.ram.unit': 'GB',
  'settings.ram.system': 'System total: {total} GB',
  'settings.java.source': 'Java Source',
  'settings.java.auto': 'Automatic (Temurin)',
  'settings.java.custom': 'Custom path',
  'settings.java.path': 'Java Executable',
  'settings.java.browse': 'Browse',
  'settings.java.validate': 'Validate',
  'settings.java.valid': 'Valid Java {version}',
  'settings.java.invalid': 'Invalid: {error}',
  'settings.jvm.label': 'Extra JVM Arguments',
  'settings.jvm.placeholder': '-XX:+UseG1GC -Dfml.ignoreInvalidMinecraftCertificates=true',
  'settings.language.label': 'Language',
  'settings.showLogs.label': 'Show logs on launch',
  'settings.channel.label': 'Release Channel',
  'settings.channel.stable': 'Stable',
  'settings.channel.snapshot': 'Snapshot',
  'settings.channel.dev': 'Dev',

  // Update
  'update.title': 'Updating...',
  'update.phase': 'Phase {current} of {total}',
  'update.done': 'Ready.',
  'update.error': 'Update failed',
  'update.retry': 'Retry',
  'update.continue': 'Continue anyway',

  // Logs
  'logs.title': 'Launch Logs',
  'logs.clear': 'Clear',
  'logs.close': 'Close',
  'logs.empty': 'No logs yet.',

  // Generic
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
} as const;

export type TranslationKey = keyof typeof en;
