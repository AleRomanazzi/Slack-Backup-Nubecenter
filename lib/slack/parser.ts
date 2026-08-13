import { existsSync, promises as fs, statSync } from "fs";
import path from "path";
import type { SlackChannelView, SlackMessage, SlackUser } from "@/lib/slack/types";

const EXPORT_FOLDER_PREFIX = "Nubecenter Slack export";
const DEFAULT_CHANNEL = "despliegue-openstack";
const HIDDEN_CHANNELS = new Set(["social", "all-nubecenter"]);

type RawUser = {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    real_name?: string;
    display_name?: string;
    image_72?: string;
  };
};

type RawChannel = {
  name?: string;
  topic?: { value?: string };
  purpose?: { value?: string };
};

type RawMessage = {
  ts?: string;
  user?: string;
  thread_ts?: string;
  reply_count?: number;
  text?: string;
  blocks?: unknown[];
  reactions?: Array<{ name?: string; users?: string[]; count?: number }>;
};

function isDataJsonFile(fileName: string): boolean {
  return fileName.endsWith(".json") && !fileName.startsWith("._");
}

async function listExportRoots(): Promise<string[]> {
  const searchBases = [process.cwd(), path.join(process.cwd(), "..")];
  const found = new Map<string, number>();

  for (const base of searchBases) {
    if (!existsSync(base)) {
      continue;
    }

    const entries = await fs.readdir(base, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(EXPORT_FOLDER_PREFIX)) {
        continue;
      }

      const exportRoot = path.resolve(base, entry.name);
      const usersPath = path.join(exportRoot, "users.json");
      if (!existsSync(usersPath)) {
        continue;
      }

      const mtime = statSync(usersPath).mtimeMs;
      found.set(exportRoot, mtime);
    }
  }

  return Array.from(found.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([exportRoot]) => exportRoot);
}

function formatDateKey(tsSeconds: number): string {
  return new Date(tsSeconds * 1000).toISOString().slice(0, 10);
}

function formatTime(tsSeconds: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(tsSeconds * 1000));
}

function parseMentions(text: string, usersById: Map<string, SlackUser>): string {
  return text.replace(/<@([A-Z0-9]+)>/g, (_, userId: string) => {
    const user = usersById.get(userId);
    return `@${user?.displayName ?? user?.username ?? userId}`;
  });
}

function collectBlockText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => collectBlockText(item)).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.type === "user" && typeof record.user_id === "string") {
      return `<@${record.user_id}>`;
    }

    return Object.values(record)
      .map((entry) => collectBlockText(entry))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

async function readJson<T>(absolutePath: string): Promise<T> {
  const content = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(content) as T;
}

function toSlackUser(user: RawUser): SlackUser | null {
  if (!user.id) {
    return null;
  }

  const displayName = user.profile?.display_name?.trim() || "";
  const realName = user.profile?.real_name?.trim() || "";

  return {
    id: user.id,
    displayName: displayName || realName || user.name || user.id,
    realName: realName || user.name || user.id,
    username: user.name || user.id,
    avatarUrl: user.profile?.image_72 ?? null,
    deleted: Boolean(user.deleted),
    isBot: Boolean(user.is_bot),
  };
}

async function readMergedUsers(exportRoots: string[]): Promise<Map<string, SlackUser>> {
  const usersById = new Map<string, SlackUser>();

  for (const exportRoot of exportRoots) {
    const usersPath = path.join(exportRoot, "users.json");
    if (!existsSync(usersPath)) {
      continue;
    }

    const users = await readJson<RawUser[]>(usersPath);
    for (const user of users) {
      const mapped = toSlackUser(user);
      if (mapped) {
        usersById.set(mapped.id, mapped);
      }
    }
  }

  return usersById;
}

async function readMergedChannels(exportRoots: string[]): Promise<{
  names: string[];
  metas: RawChannel[];
}> {
  const byName = new Map<string, RawChannel>();

  for (const exportRoot of exportRoots) {
    const channelsPath = path.join(exportRoot, "channels.json");
    if (!existsSync(channelsPath)) {
      continue;
    }

    const channels = await readJson<RawChannel[]>(channelsPath);
    for (const channel of channels) {
      const name = channel.name?.trim();
      if (!name || HIDDEN_CHANNELS.has(name)) {
        continue;
      }
      byName.set(name, channel);
    }
  }

  const names = Array.from(byName.keys()).sort((a, b) => a.localeCompare(b));
  return { names, metas: Array.from(byName.values()) };
}

async function collectChannelDayFiles(exportRoots: string[], channelName: string): Promise<string[]> {
  const filesByDay = new Map<string, string>();

  for (const exportRoot of exportRoots) {
    const channelFolder = path.join(exportRoot, channelName);
    if (!existsSync(channelFolder)) {
      continue;
    }

    const files = (await fs.readdir(channelFolder)).filter(isDataJsonFile);
    for (const fileName of files) {
      filesByDay.set(fileName, path.join(channelFolder, fileName));
    }
  }

  return Array.from(filesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, filePath]) => filePath);
}

export async function loadSlackChannelData(params?: {
  q?: string;
  channel?: string;
}): Promise<SlackChannelView> {
  const exportRoots = await listExportRoots();
  if (exportRoots.length === 0) {
    throw new Error("No se encontró ninguna carpeta de export de Slack.");
  }

  const { names: channels, metas: channelMetas } = await readMergedChannels(exportRoots);
  const selectedChannel = params?.channel && channels.includes(params.channel) ? params.channel : DEFAULT_CHANNEL;
  const usersById = await readMergedUsers(exportRoots);
  const channelMeta = channelMetas.find((channel) => channel.name === selectedChannel) ?? null;
  const dayFiles = await collectChannelDayFiles(exportRoots, selectedChannel);

  const messages: SlackMessage[] = [];
  const seenIds = new Set<string>();

  for (const filePath of dayFiles) {
    const rawMessages = await readJson<RawMessage[]>(filePath);

    for (const message of rawMessages) {
      if (!message.ts || seenIds.has(message.ts)) {
        continue;
      }

      const tsNum = Number(message.ts);
      if (Number.isNaN(tsNum)) {
        continue;
      }

      seenIds.add(message.ts);
      const user = message.user ? usersById.get(message.user) : undefined;
      const blockText = collectBlockText(message.blocks);
      const baseText = parseMentions(message.text ?? "", usersById);
      const normalizedBlockText = parseMentions(blockText, usersById);
      const mergedText = baseText || normalizedBlockText;

      messages.push({
        id: message.ts,
        ts: message.ts,
        timestampMs: Math.round(tsNum * 1000),
        dateKey: formatDateKey(tsNum),
        timeLabel: formatTime(tsNum),
        threadTs: message.thread_ts ?? null,
        isThreadReply: Boolean(message.thread_ts && message.thread_ts !== message.ts),
        replyCount: message.reply_count ?? 0,
        userId: message.user ?? null,
        authorName: user?.displayName ?? "Usuario desconocido",
        authorAvatarUrl: user?.avatarUrl ?? null,
        text: mergedText || "(mensaje sin texto)",
        searchableText: `${mergedText} ${normalizedBlockText}`.toLowerCase(),
        reactions: (message.reactions ?? []).map((reaction) => ({
          name: reaction.name ?? "reaction",
          users: reaction.users ?? [],
          count: reaction.count ?? 0,
        })),
      });
    }
  }

  messages.sort((a, b) => a.timestampMs - b.timestampMs);

  const query = params?.q?.trim().toLowerCase() ?? "";
  const filteredMessages = messages.filter((message) => {
    return query ? message.searchableText.includes(query) : true;
  });

  return {
    channels,
    channelName: selectedChannel,
    topic: channelMeta?.topic?.value ?? "",
    purpose: channelMeta?.purpose?.value ?? "",
    messages: filteredMessages,
    totalMessages: filteredMessages.length,
  };
}
