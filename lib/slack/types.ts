export type SlackUser = {
  id: string;
  displayName: string;
  realName: string;
  username: string;
  avatarUrl: string | null;
  deleted: boolean;
  isBot: boolean;
};

export type SlackReaction = {
  name: string;
  users: string[];
  count: number;
};

export type SlackMessage = {
  id: string;
  ts: string;
  timestampMs: number;
  dateKey: string;
  timeLabel: string;
  threadTs: string | null;
  isThreadReply: boolean;
  replyCount: number;
  userId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  searchableText: string;
  reactions: SlackReaction[];
};

export type SlackChannelView = {
  channels: string[];
  channelName: string;
  topic: string;
  purpose: string;
  messages: SlackMessage[];
  totalMessages: number;
};
