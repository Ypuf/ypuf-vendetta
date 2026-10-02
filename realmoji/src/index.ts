import { findByName, findByStoreName } from "@vendetta/metro";
import { after, before } from "@vendetta/patcher";
import { Embed, Message } from "vendetta-extras";

const patches = [];
const { getCustomEmojiById } = findByStoreName("EmojiStore");
const RowManager = findByName("RowManager");
const emojiRegex = /https:\/\/cdn.discordapp.com\/emojis\/(\d+)\.(\w+)/;
const emojiToken =
  /\[[^\]\n]*\]\(https:\/\/cdn\.discordapp\.com\/emojis\/\d+\.\w+[^)\s]*\)|https:\/\/cdn\.discordapp\.com\/emojis\/\d+\.\w+\S*/;
const emojiLine = new RegExp(
  `^(?:${emojiToken.source})(?:[ \\t]+(?:${emojiToken.source}))*$`,
);

patches.push(
  before("generate", RowManager.prototype, ([data]) => {
    if (data.rowType !== 1) return;

    let content = data.message.content as string;
    if (!content?.length) return;
    const matchIndex = content.match(emojiToken)?.index;
    if (matchIndex === undefined) return;
    const lines = content
      .slice(matchIndex)
      .trim()
      .split("\n")
      .map((l) => l.trim());
    if (!lines.every((l) => emojiLine.test(l))) return;
    content = content.slice(0, matchIndex);

    if (lines.some((l) => /\s/.test(l))) {
      content = (content + lines.join("\n")).trim();
    } else {
      const emojis = lines;
      while (content.indexOf("  ") !== -1)
        content = content.replace("  ", ` ${emojis.shift()} `);

      content = content.trim();
      if (emojis.length) content += ` ${emojis.join(" ")}`;
    }

    const embeds = data.message.embeds as Embed[];
    for (let i = 0; i < embeds.length; i++) {
      const embed = embeds[i];
      if (embed.type === "image" && embed.url.match(emojiRegex))
        embeds.splice(i--, 1);
    }

    data.message.content = content;
    data.__realmoji = true;
  }),
);

patches.push(
  after("generate", RowManager.prototype, ([data], row) => {
    if (data.rowType !== 1 || data.__realmoji !== true) return;
    const { content } = row.message as Message;
    if (!Array.isArray(content)) return;

    const jumbo = content.every(
      (c) =>
        (c.type === "link" && c.target.match(emojiRegex)) ||
        (c.type === "text" && /^\s+$/.test(c.content)),
    );

    for (let i = 0; i < content.length; i++) {
      const el = content[i];
      if (el.type !== "link") continue;

      const match = el.target.match(emojiRegex);
      if (!match) continue;
      const id = match[1];

      let params: URLSearchParams | undefined;
      try {
        params = new URL(el.target).searchParams;
      } catch {}

      const animated = match[2] === "gif" || params?.get("animated") === "true";
      const name =
        getCustomEmojiById(id)?.name ?? params?.get("name") ?? ":realmoji:";
      const base = `https://cdn.discordapp.com/emojis/${id}`;

      content[i] = {
        type: "customEmoji",
        id,
        alt: `${name}`,
        src: `${base}.${animated ? "gif" : "webp"}?size=128`,
        frozenSrc: `${base}.webp?size=128`,
        jumboable: jumbo ? true : undefined,
      };
    }
  }),
);

export const onUnload = () => patches.forEach((unpatch) => unpatch());
