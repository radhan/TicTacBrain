import {
  Apple,
  Binary,
  Bitcoin,
  Blocks,
  Braces,
  Bug,
  ChartCandlestick,
  ChartLine,
  Cloud,
  CodeXml,
  Coffee,
  Cpu,
  Database,
  Dumbbell,
  FileCode,
  Fingerprint,
  Footprints,
  GitBranch,
  Globe,
  Goal,
  KeyRound,
  Landmark,
  Lock,
  Megaphone,
  Microscope,
  Network,
  Rocket,
  Scale,
  ScanEye,
  Search,
  ShieldHalf,
  Shuffle,
  Terminal,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from 'lucide-preact'

/**
 * Icônes vectorielles des thèmes et sous-thèmes connus (cohérentes, monochromes).
 * Un sous-thème ajouté sans entrée ici garde l'emoji de son fichier JSON.
 */
const ICONS: Record<string, LucideIcon> = {
  all: Shuffle,
  developpement: CodeXml,
  'developpement/cloud': Cloud,
  'developpement/devops': Workflow,
  'developpement/java': Coffee,
  'developpement/javascript': Braces,
  'developpement/git': GitBranch,
  'developpement/sql': Database,
  'developpement/python': FileCode,
  'developpement/linux': Terminal,
  'developpement/algo': Binary,
  hacking: ShieldHalf,
  'hacking/web': Globe,
  'hacking/reseau': Network,
  'hacking/malwares': Bug,
  'hacking/stegano': ScanEye,
  'hacking/reverse': Cpu,
  'hacking/forensics': Fingerprint,
  'hacking/crackage': KeyRound,
  'hacking/malware-techniques': Microscope,
  crypto: Bitcoin,
  'crypto/bitcoin': Bitcoin,
  'crypto/blockchain': Blocks,
  'crypto/cryptographie': Lock,
  'crypto/trading': ChartCandlestick,
  'crypto/defi': Landmark,
  sport: Dumbbell,
  'sport/fitness': Dumbbell,
  'sport/nutrition': Apple,
  'sport/running': Footprints,
  'sport/football': Goal,
  finance: TrendingUp,
  'finance/economie': Scale,
  'finance/bourse': ChartLine,
  'finance/analyse-technique': ChartCandlestick,
  marketing: Megaphone,
  'marketing/seo': Search,
  'marketing/growth': Rocket,
}

/** Icône d'un mode (`all`, `<theme>` ou `<theme>/<sous-theme>`), avec repli sur l'emoji. */
export function TopicIcon({ id, emoji, size = 22 }: { id: string; emoji: string; size?: number }) {
  const Icon = ICONS[id]
  if (Icon) return <Icon size={size} strokeWidth={2} aria-hidden="true" />
  return (
    <span class="topic-emoji" style={{ fontSize: `${Math.round(size * 0.95)}px` }} aria-hidden="true">
      {emoji}
    </span>
  )
}
