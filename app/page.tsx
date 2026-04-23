import { loadSlackChannelData } from "@/lib/slack/parser";
import Image from "next/image";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

type HomeProps = {
  searchParams?: Promise<{
    q?: string;
    channel?: string;
  }>;
};

function colorFromSeed(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 42%)`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(text: string, query: string): ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const matcher = new RegExp(`(${escapeRegex(normalizedQuery)})`, "gi");
  const parts = text.split(matcher);

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="filterHighlight">
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const data = await loadSlackChannelData({
    q: params.q,
    channel: params.channel,
  });

  return (
    <div className="appShell">
      <aside className="sidebar" aria-label="Navegacion del canal">
        <div className="brand">
          <Image src="/nubecenter-logo.svg" alt="Nubecenter" width={220} height={48} className="brandLogo" priority />
        </div>
        <div className="channelsBlock">
          <p className="channelsTitle">Channels</p>
          <nav className="channelsList" aria-label="Canales">
            {data.channels.map((channel) => (
              <a
                key={channel}
                href={`/?channel=${encodeURIComponent(channel)}`}
                className={channel === data.channelName ? "channelItem activeChannel" : "channelItem"}
              >
                <span aria-hidden="true">#</span>
                <span>{channel}</span>
              </a>
            ))}
          </nav>
        </div>
        <p className="sidebarMeta">{data.totalMessages} mensajes visibles</p>
        <p className="sidebarMeta">Sesión: {session.user.username}</p>
        <form className="filters" action="/" method="get">
          <input type="hidden" name="channel" value={data.channelName} />
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            name="q"
            placeholder="Texto, mención o palabra"
            defaultValue={params.q ?? ""}
          />
          <button type="submit">Aplicar filtros</button>
        </form>
        <form action="/api/auth/logout" method="post" className="logoutForm">
          <button type="submit" className="logoutButton">
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="chatPanel" aria-label={`Mensajes del canal ${data.channelName}`}>
        <header className="chatHeader">
          <h2># {data.channelName}</h2>
          {data.topic && <p className="subtle">Tema: {data.topic}</p>}
          {data.purpose && <p className="subtle">Proposito: {data.purpose}</p>}
        </header>

        <section className="messageList" aria-live="polite">
          {data.messages.length === 0 ? (
            <p className="emptyState">No hay mensajes para los filtros actuales.</p>
          ) : (
            data.messages.map((message) => (
              <article key={message.id} className={`messageCard ${message.isThreadReply ? "threadReply" : ""}`}>
                <div
                  className="avatar"
                  aria-hidden="true"
                  style={{ backgroundColor: colorFromSeed(message.userId ?? message.authorName) }}
                >
                  {message.authorName.slice(0, 1).toUpperCase()}
                </div>
                <div className="messageBody">
                  <div className="messageMeta">
                    <strong>{message.authorName}</strong>
                    <time dateTime={new Date(message.timestampMs).toISOString()}>
                      {message.dateKey} {message.timeLabel}
                    </time>
                  </div>
                  {message.replyCount > 0 && <p className="threadInfo">{message.replyCount} respuesta(s) en hilo</p>}
                  {message.isThreadReply && <p className="threadInfo">Respuesta dentro de hilo</p>}
                  <p className="messageText">{highlightMatches(message.text, params.q ?? "")}</p>
                  {message.reactions.length > 0 && (
                    <ul className="reactionList" aria-label="Reacciones">
                      {message.reactions.map((reaction) => (
                        <li key={`${message.id}-${reaction.name}`}>
                          {reaction.name} ({reaction.count})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
