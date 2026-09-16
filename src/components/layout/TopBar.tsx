import React from "react";
import { Leaf } from "lucide-react";
import { Logo } from "./Logo";
import { WheatFieldBackdrop } from "./WheatFieldBackdrop";
import { DateTimePill } from "./DateTimePill";
import { NotificationBell } from "./NotificationBell";
import { ProfilePill } from "./ProfilePill";
import { LanguageToggle } from "./LanguageToggle";
import type { AuthUser, Settings } from "../../types";

export function TopBar({ user, settings, onLogout }: {
  user: AuthUser; settings: Settings; onLogout: () => void;
}) {
  return (
    <header className="flex items-stretch overflow-hidden border-b border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-6 py-3">
        <Logo size={56} />
        <div>
          <h1 className="font-display text-xl font-bold leading-tight text-brand-green-800 sm:text-2xl">
            {settings.business_name || "Haji Abdul Manan & Abdul Hanan"}
          </h1>
          <p className="font-display text-sm font-semibold text-brand-green-600 sm:text-base">Atta Dealer Pishin</p>
          <p className="mt-0.5 hidden items-center gap-1 text-xs text-stone-500 md:flex">
            <Leaf size={12} className="text-brand-green-500" /> Quality Products&nbsp;|&nbsp;Trusted Service&nbsp;|&nbsp;A Prosperous Tomorrow
          </p>
        </div>
      </div>

      <div className="relative ml-auto hidden min-w-[340px] flex-1 items-center gap-4 px-6 py-3 lg:flex">
        <WheatFieldBackdrop />
        <span className="relative z-10 hidden font-script text-xl text-brand-navy-900/90 xl:block" style={{ textShadow: "0 1px 2px rgba(255,255,255,0.6)" }}>
          From Our Fields to a Better Future
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-6 py-3">
        <LanguageToggle />
        <DateTimePill />
        <NotificationBell />
        <ProfilePill user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
