import { ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { FormIcon, FormSwitchRow } = Forms;

const toggles: { key: string; label: string; subLabel: string; icon: string }[] = [
  { key: "logDeletes", label: "Log deletes", subLabel: "Whether to log deleted messages", icon: "ic_message_delete" },
  { key: "logEdits", label: "Log edits", subLabel: "Whether to log edited messages", icon: "ic_edit_24px" },
  { key: "inlineEdits", label: "Inline edits", subLabel: "Whether to display edit history as part of message content", icon: "ic_message_edit" },
  { key: "ignoreBots", label: "Ignore bots", subLabel: "Whether to ignore messages by bots", icon: "ic_robot_24px" },
  { key: "ignoreSelf", label: "Ignore self", subLabel: "Whether to ignore messages by yourself", icon: "ic_profile_24px" },
  { key: "nopk", label: "Ignore PluralKit", subLabel: "Don't keep messages PluralKit deletes when proxying", icon: "ic_block" },
];

export default () => {
  useProxy(storage);

  return (
    <ReactNative.ScrollView>
      {toggles.map(({ key, label, subLabel, icon }) => (
        <FormSwitchRow
          key={key}
          label={label}
          subLabel={subLabel}
          leading={<FormIcon source={getAssetIDByName(icon)} />}
          onValueChange={(v) => void (storage[key] = v)}
          value={storage[key]}
        />
      ))}
      <FormSwitchRow
        label="Red overlay"
        subLabel="Show deleted messages with a red overlay instead of red text"
        leading={<FormIcon source={getAssetIDByName("ic_message_delete")} />}
        onValueChange={(v) => void (storage.deleteStyle = v ? "overlay" : "text")}
        value={storage.deleteStyle === "overlay"}
      />
    </ReactNative.ScrollView>
  );
};
