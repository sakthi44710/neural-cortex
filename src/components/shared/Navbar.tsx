'use client';

import { Bell, Search, Command } from 'lucide-react';
import Image from 'next/image';

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Navbar({ user }: NavbarProps) {
  const triggerCommandPalette = () => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  };

  return (
    <header className="h-14 border-b border-border-custom bg-surface/80 backdrop-blur-md flex items-center justify-between px-5 shrink-0 z-30 select-none">
      {/* Global Search Button / Command Palette Trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={triggerCommandPalette}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-muted hover:text-text-primary hover:border-accent/40 transition-all text-xs group"
          aria-label="Search knowledge base"
        >
          <Search className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
          <span className="hidden sm:inline">Search knowledge...</span>
          <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-[10px] font-mono text-text-muted">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right side telemetry & User profile */}
      <div className="flex items-center gap-3">
        {/* Subtle notifications trigger */}
        <button
          onClick={triggerCommandPalette}
          className="relative p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-border-subtle">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || 'User'}
              width={28}
              height={28}
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center text-xs font-semibold shadow-sm">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-text-primary leading-tight">{user.name || 'User'}</p>
            <p className="text-[10px] text-text-muted leading-tight">{user.email || 'Knowledge Operator'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
