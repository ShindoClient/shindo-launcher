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
    description: 'Build oficial com recursos personalizados, bibliotecas atualizadas e otimizações.',
    visual: {
      image: logoBanner,
      gradient: 'linear-gradient(135deg, rgba(76, 29, 149, 0.65), rgba(15, 23, 42, 0.85))',
      accent: '#7c3aed',
    },
    overrides: {
      optionLabel: 'Shindo Client • Build {build}',
    },
  },
}

function resolveDescriptor(versionId?: string | null): VersionPresentationConfig {
  if (!versionId) {
    return FALLBACK_PRESENTATION
  }
  return VERSION_PRESENTATIONS[versionId] ?? FALLBACK_PRESENTATION
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
  const descriptor = resolveDescriptor(state?.versionId)
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
