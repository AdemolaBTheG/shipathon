import { useQuery } from "@tanstack/react-query";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";
import {
  getIncomingFriendRequests,
  incomingFriendRequestsQueryKey,
} from "@/services/sharing";

export default function TabLayout() {
  const { t } = useTranslation();
  const requestsQuery = useQuery({
    queryFn: getIncomingFriendRequests,
    queryKey: incomingFriendRequestsQueryKey,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const requestCount = requestsQuery.data?.length ?? 0;
  const requestBadge = requestCount > 99 ? "99+" : String(requestCount);

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>{t("Home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(backlog)">
        <NativeTabs.Trigger.Icon
          sf="rectangle.stack.fill"
          md="collections_bookmark"
        />
        <NativeTabs.Trigger.Label>{t("Backlog")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(shared)">
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="people" />
        <NativeTabs.Trigger.Label>{t("Shared")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={requestCount === 0}>
          {requestBadge}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>{t("Search")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
