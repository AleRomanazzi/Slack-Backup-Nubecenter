import { existsSync, promises as fs } from "fs";
import path from "path";
import type { SlackChannelView, SlackMessage, SlackUser } from "@/lib/slack/types";

const EXPORT_FOLDER_NAME = "Nubecenter Slack export Mar 17 2026 - Apr 16 2026";
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

function getExportRoot(): string {
  const inProject = path.join(process.cwd(), EXPORT_FOLDER_NAME);
  if (existsSync(inProject)) {
    return inProject;
  }

  const siblingOfProject = path.join(process.cwd(), "..", EXPORT_FOLDER_NAME);
  if (existsSync(siblingOfProject)) {
    return siblingOfProject;
  }

  return inProject;
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

async function readUsers(exportRoot: string): Promise<Map<string, SlackUser>> {
  const usersPath = path.join(exportRoot, "users.json");
  const users = await readJson<RawUser[]>(usersPath);

  const usersById = new Map<string, SlackUser>();

  for (const user of users) {
    if (!user.id) {
      continue;
    }

    const displayName = user.profile?.display_name?.trim() || "";
    const realName = user.profile?.real_name?.trim() || "";

    usersById.set(user.id, {
      id: user.id,
      displayName: displayName || realName || user.name || user.id,
      realName: realName || user.name || user.id,
      username: user.name || user.id,
      avatarUrl: user.profile?.image_72 ?? null,
      deleted: Boolean(user.deleted),
      isBot: Boolean(user.is_bot),
    });
  }

  return usersById;
}

async function readChannels(exportRoot: string): Promise<string[]> {
  const channelsPath = path.join(exportRoot, "channels.json");
  const channels = await readJson<RawChannel[]>(channelsPath);
  return channels
    .map((channel) => channel.name?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => !HIDDEN_CHANNELS.has(name))
    .sort((a, b) => a.localeCompare(b));
}

export async function loadSlackChannelData(params?: {
  q?: string;
  channel?: string;
}): Promise<SlackChannelView> {
  const exportRoot = getExportRoot();
  const channels = await readChannels(exportRoot);
  const selectedChannel = params?.channel && channels.includes(params.channel) ? params.channel : DEFAULT_CHANNEL;
  const channelFolder = path.join(exportRoot, selectedChannel);
  const usersById = await readUsers(exportRoot);
  const channelsPath = path.join(exportRoot, "channels.json");
  const channelMetas = await readJson<RawChannel[]>(channelsPath);
  const channelMeta = channelMetas.find((channel) => channel.name === selectedChannel) ?? null;

  const files = (await fs.readdir(channelFolder))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const messages: SlackMessage[] = [];

  for (const fileName of files) {
    const filePath = path.join(channelFolder, fileName);
    const rawMessages = await readJson<RawMessage[]>(filePath);

    for (const message of rawMessages) {
      if (!message.ts) {
        continue;
      }

      const tsNum = Number(message.ts);
      if (Number.isNaN(tsNum)) {
        continue;
      }

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
    const textMatches = query ? message.searchableText.includes(query) : true;
    return textMatches;
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
