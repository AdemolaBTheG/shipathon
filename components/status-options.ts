import type { SymbolViewProps } from "expo-symbols";

import type { BacklogStatus } from "@/db/schema";
import type { TranslationKey } from "@/localization/resources";

export const statusOptions = [
  {
    icon: { android: "bookmark", ios: "bookmark.fill" },
    label: "Want to play",
    value: "want-to-play",
  },
  {
    icon: { android: "play_arrow", ios: "play.fill" },
    label: "Playing",
    value: "playing",
  },
  {
    icon: { android: "check_circle", ios: "checkmark.circle.fill" },
    label: "Completed",
    value: "completed",
  },
  {
    icon: { android: "archive", ios: "archivebox.fill" },
    label: "Shelved",
    value: "shelved",
  },
  {
    icon: { android: "cancel", ios: "xmark.circle.fill" },
    label: "Abandoned",
    value: "abandoned",
  },
] as const satisfies readonly {
  icon: NonNullable<SymbolViewProps["name"]>;
  label: TranslationKey;
  value: BacklogStatus;
}[];
