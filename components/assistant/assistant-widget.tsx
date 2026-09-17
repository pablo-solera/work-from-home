"use client";

import { useRef, useState } from "react";

type ChatMessage = { content: string; role: "assistant" | "user" };

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: abortRef.current.signal,
      });
      if (!response.ok || !response.body) throw new Error("No se pudo obtener una respuesta.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        answer += decoder.decode(chunk.value, { stream: true });
        setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: answer }]);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessages((current) => [...current, { role: "assistant", content: "No se pudo procesar la consulta." }]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <section aria-label="Asistente de empleados" className="mb-3 flex h-[min(32rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-950 px-4 py-3 text-white">
            <div><p className="text-sm font-semibold">Asistente WFH</p><p className="text-xs text-zinc-300">Consulta tu equipo</p></div>
            <button aria-label="Cerrar asistente" className="cursor-pointer text-xl text-zinc-300 hover:text-white" onClick={() => setOpen(false)} type="button">×</button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? <p className="text-sm text-zinc-500">Pregunta, por ejemplo: «¿Cuánta gente estará en la oficina el viernes?»</p> : null}
            {messages.map((message, index) => <p className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-800"}`} key={`${index}-${message.role}`}>{message.content || "…"}</p>)}
          </div>
          <form className="flex gap-2 border-t border-zinc-200 p-3" onSubmit={submit}>
            <input aria-label="Pregunta al asistente" className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950" disabled={loading} onChange={(event) => setInput(event.target.value)} placeholder="Escribe una pregunta..." value={input} />
            <button aria-label="Enviar pregunta" className="cursor-pointer rounded-lg bg-zinc-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || !input.trim()} type="submit">Enviar</button>
          </form>
        </section>
      ) : null}
      <button aria-label={open ? "Cerrar asistente" : "Abrir asistente"} className="ml-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800" onClick={() => setOpen((current) => !current)} type="button">AI</button>
    </div>
  );
}
