'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain,
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  Network,
  BarChart3,
  Compass,
  Layers,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
  Zap,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

interface SubMenuItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  shortcut: string;
  badge?: string;
  description: string;
  subItems: SubMenuItem[];
}

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    href: '/dashboard',
    shortcut: '⌘1',
    description: 'Cortex Command Center & real-time knowledge pulse',
    subItems: [
      { label: 'Command Center', href: '/dashboard', description: 'Brain activity & status' },
      { label: 'Knowledge Pulse', href: '/dashboard#knowledge-pulse', description: 'Entities, growth & telemetry' },
      { label: 'Recent Activity', href: '/dashboard#recent-activity', description: 'Latest files, chats & artifacts' },
      { label: 'Cognitive Brief', href: '/dashboard#cognitive-brief', description: 'Instant AI overview' },
    ],
  },
  {
    icon: FolderOpen,
    label: 'Vault',
    href: '/vault',
    shortcut: '⌘2',
    description: 'Knowledge Ingestion Center & Document Workspace',
    subItems: [
      { label: 'All Documents', href: '/vault', description: 'PDFs, DOCX, notes & media' },
      { label: 'Ingestion Center', href: '/vault?action=upload', description: 'Upload, OCR & chunking' },
      { label: 'Diagrams & Schemas', href: '/vault?type=diagram', description: 'Visual architectural links' },
      { label: 'Study Workspaces', href: '/vault?filter=study', description: 'Generated guides & quizzes' },
    ],
  },
  {
    icon: MessageSquare,
    label: 'Converse',
    href: '/converse',
    shortcut: '⌘3',
    description: 'Advanced AI dialogue with context control & diagrams',
    subItems: [
      { label: 'Active Dialogue', href: '/converse', description: 'Chat with your knowledge base' },
      { label: 'New Conversation', href: '/converse?new=true', description: 'Start fresh neural session' },
      { label: 'Diagram Synthesizer', href: '/converse?intent=diagram', description: 'Interactive Mermaid rendering' },
      { label: 'RAG Cross-Analysis', href: '/converse?intent=rag', description: 'Multi-document synthesis' },
    ],
  },
  {
    icon: Network,
    label: 'Studio',
    href: '/studio',
    shortcut: '⌘4',
    description: 'Knowledge Graph universe & semantic concept explorer',
    subItems: [
      { label: 'Knowledge Graph', href: '/studio', description: 'Force-directed neural network' },
      { label: 'Entity Clusters', href: '/studio?view=clusters', description: 'Semantic topic groupings' },
      { label: 'Concept Paths', href: '/studio?view=paths', description: 'Discover relationship traces' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Insights',
    href: '/insights',
    shortcut: '⌘5',
    description: 'Knowledge analytics, growth trends & topic gap analysis',
    subItems: [
      { label: 'Knowledge Growth', href: '/insights', description: 'Growth curves & ingestion rate' },
      { label: 'Domain Taxonomy', href: '/insights#domains', description: 'Discovered knowledge domains' },
      { label: 'Knowledge Gaps', href: '/insights#gaps', description: 'Actionable missing topics' },
      { label: 'Top Entities', href: '/insights#entities', description: 'Highest-degree concepts' },
    ],
  },
  {
    icon: Compass,
    label: 'Research',
    href: '/research',
    shortcut: '⌘6',
    description: 'Autonomous multi-stage AI research laboratory',
    subItems: [
      { label: 'New Research', href: '/research', description: 'Plan, search & synthesize report' },
      { label: 'Saved Reports', href: '/research#saved', description: 'Executive summaries & findings' },
      { label: 'Research Artifacts', href: '/research#artifacts', description: 'Exported research documents' },
    ],
  },
  {
    icon: Layers,
    label: 'Projects',
    href: '/projects',
    shortcut: '⌘7',
    description: 'Dedicated workspaces with custom AI system instructions',
    subItems: [
      { label: 'Active Projects', href: '/projects', description: 'Goal-oriented knowledge hubs' },
      { label: 'Create Project', href: '/projects?action=new', description: 'New context container' },
      { label: 'Project Artifacts', href: '/projects#artifacts', description: 'Associated chats & documents' },
    ],
  },
  {
    icon: Settings,
    label: 'Settings',
    href: '/settings',
    shortcut: '⌘8',
    description: 'Theme customization, AI models, memory & privacy',
    subItems: [
      { label: 'Appearance & Themes', href: '/settings#appearance', description: '5 visual modes & typography' },
      { label: 'AI & Inference', href: '/settings#ai', description: 'Provider, routing & temperature' },
      { label: 'Knowledge & Ingestion', href: '/settings#knowledge', description: 'Chunking & embedding setup' },
      { label: 'Account & Security', href: '/settings#account', description: 'Credentials & active sessions' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[72px] h-screen bg-surface border-r border-border-custom flex flex-col items-center py-3.5 shrink-0 relative z-40 select-none">
      {/* Brand Icon Rail Header */}
      <div className="relative group mb-5">
        <Link
          href="/dashboard"
          className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shadow-md shadow-accent/15 hover:opacity-90 active:scale-95 transition-all duration-150 border border-white/10"
        >
          <Brain className="w-5 h-5 text-white" />
        </Link>

        {/* Brand Flyout Card */}
        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 invisible opacity-0 translate-x-1 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out z-50 pointer-events-none group-hover:pointer-events-auto">
          <div className="absolute -left-3 top-0 w-4 h-full" />
          <div className="w-64 p-3.5 rounded-xl bg-surface-elevated border border-border-custom shadow-xl relative">
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-elevated border-l border-b border-border-custom rotate-45" />

            <div className="flex items-center gap-2.5 mb-2 relative z-10">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-text-primary tracking-tight">Neural Cortex 2.0</h3>
                <p className="text-[10px] text-text-muted">Personal AI Knowledge OS</p>
              </div>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed mb-2.5 relative z-10">
              Autonomous cognitive twin with multi-document intelligence, semantic graphs &amp; multimodal reasoning.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[10px] relative z-10">
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Cortex Online
              </span>
              <span className="text-text-muted font-mono">v2.0 Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Rail */}
      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-2 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <div key={item.href} className="relative group w-full flex justify-center">
              <Link
                href={item.href}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center relative transition-all duration-150',
                  isActive
                    ? 'bg-accent-subtle text-accent border border-accent/30 font-medium'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated border border-transparent'
                )}
                aria-label={item.label}
              >
                <Icon className={cn('w-4 h-4 transition-transform duration-150 group-hover:scale-105', isActive ? 'text-accent' : 'text-text-secondary')} />

                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />
                )}
              </Link>

              {/* Hover Flyout Submenu */}
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 invisible opacity-0 translate-x-1 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out z-50 pointer-events-none group-hover:pointer-events-auto">
                <div className="absolute -left-3 top-0 w-4 h-full" />

                <div className="w-72 p-3 rounded-xl bg-surface-elevated border border-border-custom shadow-xl relative">
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-elevated border-l border-b border-border-custom rotate-45" />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-1.5 pb-2 border-b border-border-subtle relative z-10">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-accent" />
                      <span className="font-semibold text-xs text-text-primary">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-muted">
                      {item.shortcut}
                    </span>
                  </div>

                  <p className="text-[11px] text-text-muted mb-2 px-0.5 leading-snug relative z-10">
                    {item.description}
                  </p>

                  {/* Submenu Links */}
                  <div className="space-y-0.5 relative z-10">
                    {item.subItems.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-surface group/sub transition-all duration-150"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-text-primary group-hover/sub:text-accent transition-colors flex items-center gap-1.5 text-xs">
                            <span className="w-1 h-1 rounded-full bg-accent/50 group-hover/sub:bg-accent" />
                            {sub.label}
                          </span>
                          {sub.description && (
                            <span className="text-[10px] text-text-muted pl-2.5">
                              {sub.description}
                            </span>
                          )}
                        </div>
                        {sub.badge ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/20 font-medium">
                            {sub.badge}
                          </span>
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-muted group-hover/sub:text-accent group-hover/sub:translate-x-0.5 transition-all" />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rail Footer & Sign Out */}
      <div className="flex flex-col items-center gap-2.5 w-full px-2 pt-3 border-t border-border-subtle">
        {/* Quick System Telemetry Tooltip */}
        <div className="relative group w-full flex justify-center">
          <div className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-elevated flex items-center justify-center text-text-muted hover:text-emerald-500 border border-border-subtle transition-all cursor-pointer">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 invisible opacity-0 translate-x-1 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out z-50 pointer-events-none group-hover:pointer-events-auto">
            <div className="absolute -left-3 top-0 w-4 h-full" />
            <div className="w-56 p-3 rounded-xl bg-surface-elevated border border-border-custom shadow-xl relative text-xs">
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-elevated border-l border-b border-border-custom rotate-45" />
              <div className="font-semibold text-text-primary mb-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-accent" />
                Cortex Engine
              </div>
              <p className="text-[11px] text-text-muted mb-2">Deterministic cognitive RAG active with low latency cache.</p>
              <div className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                ● Ready for queries
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out Button with Tooltip */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 invisible opacity-0 translate-x-1 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out z-50 pointer-events-none">
            <div className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-custom shadow-lg text-[11px] text-red-400 font-medium whitespace-nowrap relative">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-surface-elevated border-l border-b border-border-custom rotate-45" />
              Sign Out
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
