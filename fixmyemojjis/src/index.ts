import { logger } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

const patches = [];
const RowManager = findByName("RowManager");

const isEmoji = (node: any) =>
  node?.type === "emoji" || node?.type === "customEmoji";

patches.push(
  after("generate", RowManager.prototype, ([data], row) => {
    if (data.rowType !== 1) return;
    const content = row?.message?.content;
    if (!Array.isArray(content)) return;

    const multilineEmojis =
      content.some(isEmoji) &&
      content.some((n) => n?.type === "text" && n.content.includes("\n"));
    if (!multilineEmojis) return;

    const { content: _, ...message } = row.message;
    logger.log("[FUCK] row keys:", Object.keys(row));
    logger.log("[FUCK] message:", JSON.stringify(message));
    logger.log("[FUCK] content:", JSON.stringify(content));
  }),
);

export const onUnload = () => patches.forEach((unpatch) => unpatch());
