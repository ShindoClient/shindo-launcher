"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcEvent = exports.IpcChannel = void 0;
// Regular enum (not const enum) — values are real JS objects, safe across CommonJS packages
var IpcChannel;
(function (IpcChannel) {
    IpcChannel["Ping"] = "shindo:ping";
    // Accounts
    IpcChannel["AccountsList"] = "shindo:accounts.list";
    IpcChannel["AccountsAddOffline"] = "shindo:accounts.add-offline";
    IpcChannel["AccountsAddMicrosoft"] = "shindo:accounts.add-microsoft";
    IpcChannel["AccountsRemove"] = "shindo:accounts.remove";
    IpcChannel["AccountsSelect"] = "shindo:accounts.select";
    // Client
    IpcChannel["ClientState"] = "shindo:client.state";
    IpcChannel["EnsureClient"] = "shindo:client.ensure";
    IpcChannel["VersionCatalog"] = "shindo:catalog.versions";
    // Config
    IpcChannel["ConfigGet"] = "shindo:config.get";
    IpcChannel["ConfigSet"] = "shindo:config.set";
    // Java
    IpcChannel["JavaChoosePath"] = "shindo:java.choose-path";
    IpcChannel["JavaValidatePath"] = "shindo:java.validate-path";
    // Launch
    IpcChannel["LaunchStart"] = "shindo:launch.start";
    IpcChannel["LaunchStop"] = "shindo:launch.stop";
    IpcChannel["LaunchLogHistory"] = "shindo:launch.log-history";
    IpcChannel["LaunchLogClear"] = "shindo:launch.log-clear";
    // Launcher update
    IpcChannel["LauncherCheckUpdate"] = "shindo:launcher.check-update";
    IpcChannel["LauncherDownloadUpdate"] = "shindo:launcher.download-update";
    IpcChannel["RunStartupUpdate"] = "shindo:update.run";
    // System
    IpcChannel["SystemMemory"] = "shindo:system.memory";
    IpcChannel["AppVersion"] = "shindo:app.version";
    // Window
    IpcChannel["WindowMinimize"] = "shindo:window.minimize";
    IpcChannel["WindowClose"] = "shindo:window.close";
    IpcChannel["LogWindowOpen"] = "shindo:logs.open";
    IpcChannel["LogWindowClose"] = "shindo:logs.close";
})(IpcChannel || (exports.IpcChannel = IpcChannel = {}));
var IpcEvent;
(function (IpcEvent) {
    IpcEvent["UpdateProgress"] = "shindo:update.progress";
    IpcEvent["UpdateCompleted"] = "shindo:update.completed";
    IpcEvent["UpdateError"] = "shindo:update.error";
    IpcEvent["LaunchLog"] = "shindo:launch.log";
    IpcEvent["LaunchExit"] = "shindo:launch.exit";
    IpcEvent["JreStatus"] = "shindo:jre.status";
})(IpcEvent || (exports.IpcEvent = IpcEvent = {}));
