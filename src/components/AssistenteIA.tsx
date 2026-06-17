import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Bot, ChevronDown, Sparkles } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

const SUGESTOES = [
  "Como cadastro um produto?",
  "Como configuro meu PIX?",
  "Como funciona o fluxo manual?",
  "Meu QR PIX está inválido",
  "Como ativo notificações?",
];

function MarkdownSimples({ text }: { text: string }) {
  const linhas = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {linhas.map((linha, i) => {
        if (!linha.trim()) return <div key={i} className="h-1" />;
        // negrito **texto**
        const comNegrito = linha.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        // item de lista
        if (/^[-•]\s/.test(linha)) {
          return <div key={i} className="flex gap-2"><span className="text-brand mt-0.5 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: comNegrito.replace(/^[-•]\s/, "") }} /></div>;
        }
        if (/^\d+\.\s/.test(linha)) {
          const num = linha.match(/^(\d+)\./)?.[1];
          return <div key={i} className="flex gap-2"><span className="text-brand font-bold shrink-0">{num}.</span><span dangerouslySetInnerHTML={{ __html: comNegrito.replace(/^\d+\.\s/, "") }} /></div>;
        }
        if (linha.startsWith("## ")) {
          return <div key={i} className="font-semibold text-zinc-900 mt-2">{linha.replace("## ", "")}</div>;
        }
        return <div key={i} dangerouslySetInnerHTML={{ __html: comNegrito }} />;
      })}
    </div>
  );
}

export function AssistenteIA() {
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs]     = useState<Msg[]>([]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto && !minimizado) {
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [msgs, aberto, minimizado]);

  useEffect(() => {
    if (aberto && !minimizado) inputRef.current?.focus();
  }, [aberto, minimizado]);

  async function enviar(texto?: string) {
    const pergunta = (texto ?? input).trim();
    if (!pergunta || loading) return;
    setInput("");

    const novasMsgs: Msg[] = [...msgs, { role: "user", content: pergunta }];
    setMsgs(novasMsgs);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ messages: novasMsgs }),
        }
      );
      const json = await res.json();
      setMsgs([...novasMsgs, { role: "assistant", content: json.reply ?? "Erro ao obter resposta." }]);
    } catch {
      setMsgs([...novasMsgs, { role: "assistant", content: "Erro de conexão. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full b-btn text-white shadow-2xl hover:scale-105 transition-transform ring-2 ring-white"
        title="Assistente Deliverly Hub"
      >
        <Sparkles className="size-5" />
        <span className="text-sm font-semibold">Ajuda</span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-[360px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 flex flex-col transition-all ${minimizado ? "h-14" : "h-[520px]"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand rounded-t-2xl shrink-0">
        <div className="size-8 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="size-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm leading-tight">Assistente Deliverly Hub</div>
          <div className="text-white/70 text-[10px]">Dúvidas sobre o sistema</div>
        </div>
        <button onClick={() => setMinimizado(!minimizado)} className="text-white/70 hover:text-white transition-colors">
          <ChevronDown className={`size-4 transition-transform ${minimizado ? "rotate-180" : ""}`} />
        </button>
        <button onClick={() => { setAberto(false); setMinimizado(false); }} className="text-white/70 hover:text-white transition-colors">
          <X className="size-4" />
        </button>
      </div>

      {!minimizado && (
        <>
          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {msgs.length === 0 ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="size-3.5 text-brand" />
                  </div>
                  <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-zinc-700 max-w-[85%]">
                    Olá! 👋 Sou o assistente do Deliverly Hub. Posso te ajudar com dúvidas sobre o sistema — produtos, pedidos, configurações e muito mais!
                  </div>
                </div>
                <div className="space-y-1.5 pl-9">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => enviar(s)}
                      className="block w-full text-left text-xs px-3 py-1.5 rounded-xl border border-brand/20 text-brand hover:bg-brand/5 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="size-3.5 text-brand" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.role === "user"
                      ? "bg-brand text-white rounded-tr-sm text-sm"
                      : "bg-zinc-100 text-zinc-800 rounded-tl-sm"
                  }`}>
                    {m.role === "assistant" ? <MarkdownSimples text={m.content} /> : m.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-2">
                <div className="size-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <Bot className="size-3.5 text-brand" />
                </div>
                <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                  <span className="size-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-100 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre o sistema…"
                className="flex-1 h-9 rounded-xl border border-zinc-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-zinc-400"
                disabled={loading}
              />
              <button type="submit" disabled={!input.trim() || loading}
                className="size-9 rounded-xl bg-brand text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
                <Send className="size-4" />
              </button>
            </form>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5">Apenas dúvidas sobre o Deliverly Hub</p>
          </div>
        </>
      )}
    </div>
  );
}
