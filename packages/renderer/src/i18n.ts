import { derived, get, writable } from 'svelte/store';

export type Language = 'en' | 'pt';

const translations: Record<Language, Record<string, any>> = {
  en: {
    nav: {
      home: 'Home',
      accounts: 'Accounts',
    },
    account: {
      microsoft: 'Microsoft Account',
      offline: 'Offline Account',
      noneSelected: 'No account selected',
      none: 'No account',
      add: 'Add',
    },
    titleBar: {
      controls: 'Window controls',
      settingsOpen: 'Settings',
      settingsBack: 'Back',
      minimize: 'Minimize',
      close: 'Close',
      settingsAria: 'Open settings',
    },
    home: {
      updateTitle: 'Update',
      phases: 'Phases',
      play: 'Play',
      launching: 'Launching...',
      selectVersion: 'Select a version',
      active: 'Active',
      status: {
        preparing: 'Preparing...',
        checking: 'Starting checks...',
        launching: 'Launching ShindoClient...',
        startedPid: 'ShindoClient started (pid {pid}).',
        started: 'ShindoClient started.',
        accountRequired: 'Select an account to play.',
        failed: 'Failed to start client: {message}',
        exit: 'Process finished with code {code}',
        exitUnknown: 'Process finished with unknown code',
        updateComplete: 'Update finished. Ready to play.',
        updateError: 'Error during update: {message}',
      },
      progress: {
        launcher: 'Checking launcher updates...',
        launcherDownloading: 'Downloading launcher update...',
        launcherApplying: 'Applying launcher update...',
        launcherReady: 'Launcher update ready.',
        launcherUpToDate: 'Launcher is up to date.',
        jreChecking: 'Checking Java runtime...',
        jreReady: 'Runtime ready.',
        clientSync: 'Syncing Shindo client...',
        clientReady: 'Client ready.',
      },
    },
    versionBanner: {
      featured: 'Featured',
      build: 'Build',
    },
    settings: {
      loading: 'Loading settings...',
      back: 'Back',
      title: 'Settings',
      totalMemory: 'Total memory',
      ramTitle: 'RAM allocation',
      ramDescription: 'Set how much RAM Minecraft can use.',
      runtimeTitle: 'Java Runtime',
      runtimeDescription: 'Choose which JRE to use when launching the game.',
      runtimeSystem: 'System JRE',
      runtimeZulu: 'Azul Zulu',
      runtimeTemurin: 'Eclipse Temurin',
      runtimeCurrent: 'Current runtime',
      jvmArgsTitle: 'JVM Arguments',
      jvmArgsDescription: 'Additional arguments applied when starting Java.',
      jvmSaving: 'Saving...',
      interfaceTitle: 'Launcher Interface',
      interfaceDescription: 'Adjust how the launcher companion windows behave.',
      logsLabel: 'Show logs automatically',
      logsDescription: 'Open the client log window as soon as the game starts.',
      languageLabel: 'Language',
      languageDescription: 'Switch the launcher interface language.',
    },
    accounts: {
      addOfflineTitle: 'Add offline account',
      addOfflineDescription: 'Ideal for playing without official authentication.',
      playerName: 'Player name',
      offlinePlaceholder: 'Ex: ShindoPlayer',
      saveOffline: 'Save offline account',
      offlineInfo: 'Each offline account gets a unique UUID and can be selected for launch.',
      microsoftTitle: 'Sign in with Microsoft',
      microsoftDescription:
        'Official authentication with WebView and full premium multiplayer support.',
      loginButton: 'Sign in with Microsoft',
      loginAuthenticating: 'Authenticating...',
      loginNotice:
        'Login opens a secure Microsoft window. Your credentials are never stored by the launcher.',
      totalAccounts: 'Total accounts',
      limitReached: 'Maximum of {limit} accounts reached. Remove one to add more.',
      error: 'An error occurred',
      yourAccounts: 'Your accounts',
      chooseProfile: 'Choose which profile you want to use when launching.',
      sync: 'Sync',
      empty: 'No accounts added yet. Add one above to get started.',
      setActive: 'Set as active',
      active: 'Active account',
      remove: 'Remove',
      confirmRemove: 'Confirm?',
      lastUse: 'Last used',
      neverUsed: 'Never used',
    },
    logWindow: {
      title: 'Client Logs',
      subtitle: 'Search and filter everything in real time',
      helper: 'Filter by level or search any text to quickly find what you need.',
      close: 'Close',
      clear: 'Clear',
      searchPlaceholder: 'Search log messages...',
      entries: 'entries',
      filtersHint: 'Toggle multiple levels to mix info, warnings, errors or debug traces.',
      empty: 'Client logs will appear here as soon as they arrive.',
    },
  },
  pt: {
    nav: {
      home: 'Principal',
      accounts: 'Contas',
    },
    account: {
      microsoft: 'Conta Microsoft',
      offline: 'Conta Offline',
      noneSelected: 'Nenhuma conta selecionada',
      none: 'Sem conta',
      add: 'Adicionar',
    },
    titleBar: {
      controls: 'Controles da janela',
      settingsOpen: 'Configurações',
      settingsBack: 'Voltar',
      minimize: 'Minimizar',
      close: 'Fechar',
      settingsAria: 'Abrir configurações',
    },
    home: {
      updateTitle: 'Atualização',
      phases: 'Fases',
      play: 'Jogar',
      launching: 'Iniciando...',
      selectVersion: 'Selecione uma versão',
      active: 'Ativo',
      status: {
        preparing: 'Preparando...',
        checking: 'Iniciando verificações...',
        launching: 'Iniciando ShindoClient...',
        startedPid: 'ShindoClient iniciado (pid {pid}).',
        started: 'ShindoClient iniciado.',
        accountRequired: 'Selecione uma conta para jogar.',
        failed: 'Falha ao iniciar cliente: {message}',
        exit: 'Processo finalizado com código {code}',
        exitUnknown: 'Processo finalizado com código desconhecido',
        updateComplete: 'Atualização concluída. Pronto para jogar.',
        updateError: 'Erro durante a atualização: {message}',
      },
      progress: {
        launcher: 'Verificando atualizações do launcher...',
        launcherDownloading: 'Baixando atualização do launcher...',
        launcherApplying: 'Aplicando atualização do launcher...',
        launcherReady: 'Atualização do launcher preparada.',
        launcherUpToDate: 'Launcher já está atualizado.',
        jreChecking: 'Verificando runtime Java...',
        jreReady: 'Runtime verificado.',
        clientSync: 'Sincronizando cliente Shindo...',
        clientReady: 'Cliente pronto.',
      },
    },
    versionBanner: {
      featured: 'Destacado',
      build: 'Build',
    },
    settings: {
      loading: 'Carregando configurações...',
      back: 'Voltar',
      title: 'Configurações',
      totalMemory: 'Memória total',
      ramTitle: 'Alocação de RAM',
      ramDescription: 'Defina quanta RAM o Minecraft poderá utilizar.',
      runtimeTitle: 'Runtime Java',
      runtimeDescription: 'Escolha qual distribuição de JRE utilizar ao iniciar o jogo.',
      runtimeSystem: 'JRE do Sistema',
      runtimeZulu: 'Azul Zulu',
      runtimeTemurin: 'Eclipse Temurin',
      runtimeCurrent: 'Runtime atual',
      jvmArgsTitle: 'Argumentos JVM',
      jvmArgsDescription: 'Argumentos adicionais aplicados ao iniciar o Java.',
      jvmSaving: 'Salvando...',
      interfaceTitle: 'Interface do Launcher',
      interfaceDescription: 'Ajuste como as janelas complementares do launcher se comportam.',
      logsLabel: 'Mostrar janela de logs automaticamente',
      logsDescription: 'Exibe a janela de logs do cliente assim que o jogo for iniciado.',
      languageLabel: 'Idioma',
      languageDescription: 'Altere o idioma da interface do launcher.',
    },
    accounts: {
      addOfflineTitle: 'Adicionar conta offline',
      addOfflineDescription: 'Ideal para jogar sem autenticação oficial.',
      playerName: 'Nome do jogador',
      offlinePlaceholder: 'Ex: ShindoPlayer',
      saveOffline: 'Salvar conta offline',
      offlineInfo:
        'Cada conta offline ganha um UUID exclusivo e pode ser selecionada para lançamento.',
      microsoftTitle: 'Entrar com Microsoft',
      microsoftDescription:
        'Autenticação oficial com WebView e suporte total ao multiplayer premium.',
      loginButton: 'Entrar com Microsoft',
      loginAuthenticating: 'Autenticando...',
      loginNotice:
        'O login abre uma janela segura da Microsoft. Suas credenciais nunca são armazenadas pelo launcher.',
      totalAccounts: 'Total de contas',
      limitReached:
        'Limite máximo de {limit} contas atingido. Remova alguma conta para adicionar novas.',
      error: 'Ocorreu um erro',
      yourAccounts: 'Suas contas',
      chooseProfile: 'Escolha qual perfil quer usar durante o lançamento.',
      sync: 'Sincronizar',
      empty: 'Nenhuma conta cadastrada ainda. Adicione uma acima para começar.',
      setActive: 'Definir como atual',
      active: 'Conta ativa',
      remove: 'Remover',
      confirmRemove: 'Confirmar?',
      lastUse: 'Último uso',
      neverUsed: 'Nunca usada',
    },
    logWindow: {
      title: 'Logs do Cliente',
      subtitle: 'Pesquise e filtre tudo em tempo real',
      helper: 'Filtre por n?vel ou pesquise qualquer texto para encontrar r?pido o que precisa.',
      close: 'Fechar',
      clear: 'Limpar',
      searchPlaceholder: 'Pesquisar mensagens de log...',
      entries: 'registros',
      filtersHint: 'Ative v?rias op??es para combinar info, avisos, erros ou depura??o.',
      empty: 'Os registros do cliente aparecer?o aqui assim que chegarem.',
    },
  },
};

function resolveKey(lang: Language, key: string): string | undefined {
  return key.split('.').reduce<any>((acc, part) => acc?.[part], translations[lang]);
}

function formatValue(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

const language = writable<Language>('en');

export const t = derived(language, ($language) => {
  return (key: string, params?: Record<string, string | number>) => {
    const message = resolveKey($language, key) ?? resolveKey('en', key) ?? key;
    return formatValue(String(message), params);
  };
});

export function setLanguage(next: Language): void {
  language.set(next);
}

export function getLanguage(): Language {
  return get(language);
}

export const availableLanguages: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];
