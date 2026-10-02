import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, ReactNative } from "@vendetta/metro/common";
import { after, instead, before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

storage.nopk ??= false;
storage.logDeletes ??= true;
storage.logEdits ??= true;
storage.inlineEdits ??= true;
storage.ignoreBots ??= true;
storage.ignoreSelf ??= false;
storage.deleteStyle ??= "text";

const patches = [];
const Parser = findByProps("parse", "parseTopic");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const ChannelMessages = findByProps("_channelMessages");
const MessageRecordUtils = findByProps(
  "updateMessageRecord",
  "createMessageRecord",
);
const MessageRecord = findByName("MessageRecord", false);
const RowManager = findByName("RowManager");
const UserStore = findByStoreName("UserStore");

const EPHEMERAL = 64;

const edits = new Map<string, { timestamp: string; content: string }[]>();

function shouldIgnore(message: any, isEdit: boolean) {
  try {
    const myId = UserStore.getCurrentUser()?.id;
    return (
      (storage.ignoreBots && message.author?.bot) ||
      (storage.ignoreSelf && message.author?.id === myId) ||
      (isEdit ? !storage.logEdits : !storage.logDeletes)
    );
  } catch {
    return false;
  }
}

patches.push(
  before("dispatch", FluxDispatcher, ([event]) => {
    if (event.type === "MESSAGE_UPDATE") {
      const next = event.message;
      if (
        !next ||
        next.__vml_deleted ||
        typeof next.content !== "string" ||
        !next.edited_timestamp
      )
        return;

      const prev = ChannelMessages.get(next.channel_id)?.get(next.id);
      if (!prev || prev.content === next.content) return;
      if ((prev.flags & EPHEMERAL) === EPHEMERAL || shouldIgnore(prev, true))
        return;

      const history = edits.get(next.id) ?? [];
      history.push({ timestamp: next.edited_timestamp, content: prev.content });
      edits.set(next.id, history);
      return;
    }

    if (event.type === "MESSAGE_DELETE") {
      if (event.__vml_cleanup) return event;

      const channel = ChannelMessages.get(event.channelId);
      const message = channel?.get(event.id);
      if (!message) return event;

      if (message.author?.id == "1") return event;
      if (message.state == "SEND_FAILED") return event;
      if (
        (message.flags & EPHEMERAL) === EPHEMERAL ||
        shouldIgnore(message, false)
      )
        return event;

      storage.nopk &&
        fetch(
          `https://api.pluralkit.me/v2/messages/${encodeURIComponent(message.id)}`,
        )
          .then((res) => res.json())
          .then((data) => {
            if (message.id === data.original && !data.member?.keep_proxy) {
              FluxDispatcher.dispatch({
                type: "MESSAGE_DELETE",
                id: message.id,
                channelId: message.channel_id,
                __vml_cleanup: true,
              });
            }
          });

      return [
        {
          message: {
            ...message.toJS(),
            __vml_deleted: true,
          },
          type: "MESSAGE_UPDATE",
        },
      ];
    }
  }),
);

function renderEditHistory(message: any, row: any) {
  const history = storage.inlineEdits ? edits.get(message.id) : undefined;
  if (!history?.length || !Array.isArray(row.message.content)) return;

  const options = {
    channelId: message.channel_id,
    messageId: message.id,
    allowLinks: true,
    allowHeading: true,
    allowList: true,
    allowEmojiLinks: true,
    viewingChannelId: SelectedChannelStore.getChannelId(),
  };

  try {
    const previous = history.map((edit) => ({
      type: "subtext",
      content: [
        ...Parser.parseToAST(edit.content, true, options),
        { type: "text", content: " (edited)" },
      ],
    }));
    row.message.content = [...previous, ...row.message.content];
    row.message.edited = "";
  } catch (e) {
    console.error("[MessageLogger] Failed to render edit history", e);
  }
}

patches.push(
  after("generate", RowManager.prototype, ([data], row) => {
    if (data.rowType !== 1) return;
    renderEditHistory(data.message, row);

    if (data.message.__vml_deleted) {
      if (storage.deleteStyle === "overlay") {
        row.backgroundHighlight ??= {};
        row.backgroundHighlight.backgroundColor =
          ReactNative.processColor("#f0474726");
        row.backgroundHighlight.gutterColor =
          ReactNative.processColor("#f04747ff");
      } else {
        row.message.textColor = ReactNative.processColor("#f04747");
        row.message.editedColor = ReactNative.processColor("#f04747");
        row.message.linkColor = ReactNative.processColor("#be3535");
      }
    }
  }),
);

patches.push(
  instead(
    "updateMessageRecord",
    MessageRecordUtils,
    function ([oldRecord, newRecord], orig) {
      if (newRecord.__vml_deleted) {
        return MessageRecordUtils.createMessageRecord(
          newRecord,
          oldRecord.reactions,
        );
      }
      return orig.apply(this, [oldRecord, newRecord]);
    },
  ),
);

patches.push(
  after(
    "createMessageRecord",
    MessageRecordUtils,
    function ([message], record) {
      record.__vml_deleted = message.__vml_deleted;
    },
  ),
);

patches.push(
  after("default", MessageRecord, ([props], record) => {
    record.__vml_deleted = !!props.__vml_deleted;
  }),
);

export const onUnload = () => {
  patches.forEach((unpatch) => unpatch());
  edits.clear();

  for (const channelId in ChannelMessages._channelMessages) {
    for (const message of ChannelMessages._channelMessages[channelId]._array) {
      message.__vml_deleted &&
        FluxDispatcher.dispatch({
          type: "MESSAGE_DELETE",
          id: message.id,
          channelId: message.channel_id,
          __vml_cleanup: true,
        });
    }
  }
};

export { default as settings } from "./settings";
