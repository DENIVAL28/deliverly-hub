import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISPENSADO_KEY = "pwa_install_dispensado";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export function InstalarPWA() {
  const [prompt, setPrompt] = useState<any>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const dispensado = Number(localStorage.getItem(DISPENSADO_KEY) ?? 0);
    if (Date.now() - dispensado < SETE_DIAS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setVisivel(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visivel || !prompt) return null;

  async function instalar() {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setVisivel(false);
    if (outcome === "dismissed") {
      localStorage.setItem(DISPENSADO_KEY, String(Date.now()));
    }
  }

  function dispensar() {
    setVisivel(false);
    localStorage.setItem(DISPENSADO_KEY, String(Date.now()));
  }

  return (
    <div className="fixed bottom-4 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-100 p-4 flex items-center gap-3">
        <img
          src="/icon-192.png"
          alt="App"
          className="w-12 h-12 rounded-xl flex-shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-900 leading-tight">
            Instale o app de delivery
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Acesse mais rápido, funciona sem internet
          </p>
        </div>
        <button
          onClick={instalar}
          className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex-shrink-0 transition-colors"
        >
          Instalar
        </button>
        <button
          onClick={dispensar}
          className="text-zinc-400 hover:text-zinc-600 p-1 flex-shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
