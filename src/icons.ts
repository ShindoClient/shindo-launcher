import { App } from "vue";
import { Play, Settings, Download, RefreshCw, GitBranch, Terminal, HardDrive, ChevronRight } from "lucide-vue-next";

export function registerIcons(app: App) {
  app.component("IconPlay", Play);
  app.component("IconSettings", Settings);
  app.component("IconDownload", Download);
  app.component("IconRefreshCw", RefreshCw);
  app.component("IconGitBranch", GitBranch);
  app.component("IconTerminal", Terminal);
  app.component("IconHardDrive", HardDrive);
  app.component("IconChevronRight", ChevronRight);
}
