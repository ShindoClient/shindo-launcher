// Regular enum (not const enum) — values are real JS objects, safe across CommonJS packages
export enum IpcChannel {
  Ping = 'shindo:ping',

  // Accounts
  AccountsList         = 'shindo:accounts.list',
  AccountsAddOffline   = 'shindo:accounts.add-offline',
  AccountsAddMicrosoft = 'shindo:accounts.add-microsoft',
  AccountsRemove       = 'shindo:accounts.remove',
  AccountsSelect       = 'shindo:accounts.select',

  // Client
  ClientState    = 'shindo:client.state',
  EnsureClient   = 'shindo:client.ensure',
  VersionCatalog = 'shindo:catalog.versions',

  // Config
  ConfigGet = 'shindo:config.get',
  ConfigSet = 'shindo:config.set',

  // Java
  JavaChoosePath   = 'shindo:java.choose-path',
  JavaValidatePath = 'shindo:java.validate-path',

  // Launch
  LaunchStart      = 'shindo:launch.start',
  LaunchStop       = 'shindo:launch.stop',
  LaunchLogHistory = 'shindo:launch.log-history',
  LaunchLogClear   = 'shindo:launch.log-clear',

  // Launcher update
  LauncherCheckUpdate    = 'shindo:launcher.check-update',
  LauncherDownloadUpdate = 'shindo:launcher.download-update',
  RunStartupUpdate       = 'shindo:update.run',

  // System
  SystemMemory = 'shindo:system.memory',
  AppVersion   = 'shindo:app.version',

  // Window
  WindowMinimize = 'shindo:window.minimize',
  WindowClose    = 'shindo:window.close',
  LogWindowOpen  = 'shindo:logs.open',
  LogWindowClose = 'shindo:logs.close',
}

export enum IpcEvent {
  UpdateProgress  = 'shindo:update.progress',
  UpdateCompleted = 'shindo:update.completed',
  UpdateError     = 'shindo:update.error',
  LaunchLog       = 'shindo:launch.log',
  LaunchExit      = 'shindo:launch.exit',
  JreStatus       = 'shindo:jre.status',
}
