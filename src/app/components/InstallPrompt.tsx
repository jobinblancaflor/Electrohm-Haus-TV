import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Offers "Install app" when the browser says the PWA is installable. */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 animate-fade-up md:inset-x-auto md:right-6 md:bottom-6 md:w-96">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-4 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Electrohm Haus TV</p>
          <p className="mt-0.5 text-xs text-dim">Open it from your home screen, full screen, like any other app.</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber px-4 text-sm font-semibold text-ink hover:bg-[#ffc56e]"
        >
          <Download className="size-4" />
          Install
        </button>
        <button
          type="button"
          onClick={() => setPromptEvent(null)}
          className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-dim hover:bg-panel hover:text-paper"
          aria-label="Not now"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
