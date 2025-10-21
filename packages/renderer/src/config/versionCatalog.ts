import type { ClientStatePayload } from '@shindo/shared'
import logoBanner from '../assets/logo.png'

export interface VersionVisualConfig {
  image?: string
  gradient?: string
  accent?: string
}

export interface VersionPresentationConfig {
  id: string
  name: string
  headline: string
  description?: string
  visual: VersionVisualConfig
  overrides?: {
    baseVersion?: string
    build?: string
    optionLabel?: string
  }
}

export interface ResolvedVersionPresentation {
  id: string
  name: string
  headline: string
  description?: string
  baseVersion: string
  buildLabel: string
  accent: string
  backgroundImage: string
  optionLabel: string
}

const FALLBACK_PRESENTATION: VersionPresentationConfig = {
  id: 'default',
  name: 'Minecraft',
  headline: 'Experiencia padrao pronta para jogar',
  description: 'Inicie o jogo com as configuracoes otimizadas do launcher.',
  visual: {
    gradient: 'linear-gradient(135deg, rgba(129, 140, 248, 0.35), rgba(30, 41, 59, 0.85))',
    accent: '#6366f1',
  },
}

export const VERSION_PRESENTATIONS: Record<string, VersionPresentationConfig> = {
  ShindoClient: {
    id: 'ShindoClient',
    name: 'Shindo Client',
    headline: 'Compatibilidade maxima com os servidores competitivos.',
    description: 'Build oficial com recursos personalizados, bibliotecas atualizadas e otimizacoes.',
    visual: {
      image: logoBanner,
      gradient: 'linear-gradient(135deg, rgba(76, 29, 149, 0.65), rgba(15, 23, 42, 0.85))',
      accent: '#7c3aed',
    },
    overrides: {
      optionLabel: 'Shindo Client - Build {build}',
    },
  },
  'ShindoClient-1.7.10': {
    id: 'ShindoClient-1.7.10',
    name: 'Shindo Client',
    headline: 'Compatibilidade legado com performance otimizata.',
    description: 'Build ajustada para servidores baseados na 1.7.10, mantendo os recursos classicos.',
    visual: {
      gradient: 'linear-gradient(135deg, rgba(250, 204, 21, 0.55), rgba(202, 138, 4, 0.85))',
      accent: '#facc15',
    },
    overrides: {
      baseVersion: '1.7.10',
      optionLabel: 'Shindo Client 1.7.10',
    },
  },
  'ShindoClient-1.8.9': {
    id: 'ShindoClient-1.8.9',
    name: 'Shindo Client',
    headline: 'Classico competitivo com otimizacoes modernas.',
    description: 'Versao preferida para PVP com as melhorias exclusivas do launcher.',
    visual: {
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.55), rgba(30, 64, 175, 0.85))',
      accent: '#3b82f6',
    },
    overrides: {
      baseVersion: '1.8.9',
      optionLabel: 'Shindo Client 1.8.9',
    },
  },
  'ShindoClient-1.12.2': {
    id: 'ShindoClient-1.12.2',
    name: 'Shindo Client',
    headline: 'Base solida para packs de mods competitivos.',
    description: 'Compatibilidade ampla com mods populares e ajustes para servidores modernos.',
    visual: {
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.55), rgba(4, 120, 87, 0.85))',
      accent: '#10b981',
    },
    overrides: {
      baseVersion: '1.12.2',
      optionLabel: 'Shindo Client 1.12.2',
    },
  },
  'ShindoClient-1.16.5': {
    id: 'ShindoClient-1.16.5',
    name: 'Shindo Client',
    headline: 'Pronto para servidores com Nether Update.',
    description: 'Aproveite as melhorias do launcher em redes meta modernas.',
    visual: {
      gradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.55), rgba(194, 65, 12, 0.85))',
      accent: '#f97316',
    },
    overrides: {
      baseVersion: '1.16.5',
      optionLabel: 'Shindo Client 1.16.5',
    },
  },
}

function resolveDescriptor(state: ClientStatePayload | null): VersionPresentationConfig {
  if (!state) {
    return FALLBACK_PRESENTATION
  }

  const versionId = state.versionId

  if (versionId === 'ShindoClient') {
    const baseKey = state.baseVersion ? `ShindoClient-${state.baseVersion}` : null
    if (baseKey && VERSION_PRESENTATIONS[baseKey]) {
      return VERSION_PRESENTATIONS[baseKey]
    }
  }

  if (versionId && VERSION_PRESENTATIONS[versionId]) {
    return VERSION_PRESENTATIONS[versionId]
  }

  return FALLBACK_PRESENTATION
}

interface PresentationContext {
  baseVersion: string
  build: string
}

function createContext(state: ClientStatePayload | null, overrides?: VersionPresentationConfig['overrides']): PresentationContext {
  const baseVersion = overrides?.baseVersion ?? state?.baseVersion ?? '1.8.9'
  const build = overrides?.build ?? state?.version ?? '5109'
  return { baseVersion, build }
}

function resolveBackground(visual: VersionVisualConfig): string {
  if (visual.image) {
    return `linear-gradient(180deg, rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.85)), url(${visual.image})`
  }
  if (visual.gradient) {
    return visual.gradient
  }
  return 'linear-gradient(135deg, rgba(129, 140, 248, 0.35), rgba(30, 41, 59, 0.85))'
}

export function resolveVersionPresentation(state: ClientStatePayload | null): ResolvedVersionPresentation {
  const descriptor = resolveDescriptor(state)
  const context = createContext(state, descriptor.overrides)
  const optionTemplate = descriptor.overrides?.optionLabel

  const optionLabel = optionTemplate
    ? optionTemplate.replace('{build}', context.build).replace('{baseVersion}', context.baseVersion)
    : `${descriptor.name} (${context.baseVersion})`

  return {
    id: descriptor.id,
    name: descriptor.name,
    headline: descriptor.headline,
    description: descriptor.description,
    baseVersion: context.baseVersion,
    buildLabel: context.build,
    accent: descriptor.visual.accent ?? '#6366f1',
    backgroundImage: resolveBackground(descriptor.visual),
    optionLabel,
  }
}
