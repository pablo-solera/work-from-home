"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBubbleIcon } from "@/components/icons/chat-bubble-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { SendIcon } from "@/components/icons/send-icon";

type ChatMessage = { content: string; role: "assistant" | "user" };

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!nearBottomRef.current) return;
    messagesRef.current?.scrollTo({ behavior: "smooth", top: messagesRef.current.scrollHeight });
  }, [messages]);

  function handleMessagesScroll() {
    const element = messagesRef.current;
    if (!element) return;
    nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
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
      const flush = () => {
        frameRef.current = null;
        setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: answer }]);
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        answer += decoder.decode(chunk.value, { stream: true });
        frameRef.current ??= requestAnimationFrame(flush);
      }
      answer += decoder.decode();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      flush();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessages((current) => {
        const last = current.at(-1);
        return last?.role === "assistant" && !last.content
          ? [...current.slice(0, -1), { role: "assistant", content: "No se pudo procesar la consulta." }]
          : [...current, { role: "assistant", content: "No se pudo procesar la consulta." }];
      });
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
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" onScroll={handleMessagesScroll} ref={messagesRef}>
            {messages.length === 0 ? <p className="text-sm text-zinc-500">Pregunta, por ejemplo: «¿Cuánta gente estará en la oficina el viernes?»</p> : null}
            {messages.map((message, index) => <p className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-800"}`} key={`${index}-${message.role}`}>{message.content || <TypingIndicator />}</p>)}
          </div>
          <form className="flex gap-2 border-t border-zinc-200 p-3" onSubmit={submit}>
            <input aria-label="Pregunta al asistente" autoComplete="off" name="question" className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 sm:text-sm" disabled={loading} onChange={(event) => setInput(event.target.value)} placeholder="Escribe una pregunta…" value={input} />
            <button aria-label="Enviar pregunta" className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-zinc-950 text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || !input.trim()} type="submit"><SendIcon className="size-4" /></button>
          </form>
        </section>
      ) : null}
      <button aria-label={open ? "Cerrar asistente" : "Abrir asistente"} aria-expanded={open} className="ml-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition-colors hover:bg-zinc-800" onClick={() => setOpen((current) => !current)} type="button">{open ? <CloseIcon className="size-5" /> : <ChatBubbleIcon className="size-6" />}</button>
    </div>
  );
}

function TypingIndicator() {
  return <span className="flex items-center gap-1 py-1" role="status"><span className="sr-only">El asistente está escribiendo</span><span aria-hidden="true" className="size-2 animate-bounce rounded-full bg-zinc-400 motion-reduce:animate-none" /><span aria-hidden="true" className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms] motion-reduce:animate-none" /><span aria-hidden="true" className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms] motion-reduce:animate-none" /></span>;
}
