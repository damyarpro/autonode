import {
  Activity, ArrowUpRight, BarChart3, BookOpen, Brain, Briefcase, Calendar, ChevronLeft,
  Circle, ClipboardList, Clock, Cloud, Code, Cpu, CreditCard, Database, DollarSign, Eye,
  ExternalLink, Factory, FileText, FolderOpen, GitBranch, Globe, Headphones, Home, Image,
  Layers, Lightbulb, Link as LinkIcon, LogOut, Mail, MessageCircle, MessageSquare, Network,
  Palette, PenTool, Pencil, Rocket, Search, Send, Server, Settings, Shield, ShieldCheck,
  ShoppingCart, Sparkles, Target, TrendingUp, Trophy, User, Users, Workflow, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Explicit registry rather than `import * as icons` — a namespace import defeats
 * tree-shaking and pulls the whole icon set into the bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  Activity, ArrowUpRight, BarChart3, BookOpen, Brain, Briefcase, Calendar, ChevronLeft,
  Circle, ClipboardList, Clock, Cloud, Code, Cpu, CreditCard, Database, DollarSign, Eye,
  ExternalLink, Factory, FileText, FolderOpen, GitBranch, Globe, Headphones, Home, Image,
  Layers, Lightbulb, Link: LinkIcon, LogOut, Mail, MessageCircle, MessageSquare, Network,
  Palette, PenTool, Pencil, Rocket, Search, Send, Server, Settings, Shield, ShieldCheck,
  ShoppingCart, Sparkles, Target, TrendingUp, Trophy, User, Users, Workflow, Wrench, Zap,
}

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Glyph = ICONS[name] ?? Circle
  return <Glyph size={size} strokeWidth={1.9} className={className} />
}

/** Icon on a filled, rounded tile — the shape used on every card. */
export function IconTile({
  name,
  color,
  size = 44,
  gradient,
}: {
  name: string
  color?: string
  size?: number
  gradient?: [string, string]
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[13px] text-white"
      style={{
        width: size,
        height: size,
        background: gradient ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` : color,
      }}
    >
      <Icon name={name} size={Math.round(size * 0.46)} />
    </span>
  )
}
