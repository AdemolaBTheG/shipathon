import {
  Button,
  HStack,
  Image,
  Rectangle,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  aspectRatio,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  resizable,
  tint,
  widgetAccentedRenderingMode,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type TonightWidgetGame = {
  coverUri: string | null;
  gameId: number;
  platform: string | null;
  title: string;
};

export type TonightsPickWidgetProps = {
  activeIndex: number;
  copy?: {
    addToWantToPlay: string;
    emptyAccessibility: string;
    fromBacklog: string;
    lockedAccessibilitySuffix: string;
    openGame: string;
    proAccessibilitySuffix: string;
    shuffle: string;
    tonightPick: string;
    unlockShuffle: string;
  };
  games: TonightWidgetGame[];
  isPro: boolean;
};

const defaultCopy: NonNullable<TonightsPickWidgetProps["copy"]> = {
  addToWantToPlay: "Add something to Want to Play.",
  emptyAccessibility: "Tonight's Pick is empty. Add a game to your backlog.",
  fromBacklog: "From your backlog",
  lockedAccessibilitySuffix: "Joylogue Pro is required to shuffle.",
  openGame: "Open game",
  proAccessibilitySuffix: "Open details or shuffle.",
  shuffle: "Shuffle",
  tonightPick: "Tonight's Pick",
  unlockShuffle: "Unlock shuffle with Pro",
};

function TonightsPickWidgetView(
  props: TonightsPickWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const games = props.games ?? [];
  const copy = props.copy ?? defaultCopy;
  const safeIndex = games.length > 0
    ? ((props.activeIndex || 0) % games.length + games.length) % games.length
    : 0;
  const game = games[safeIndex];
  const hasGame = Boolean(game);
  const detailsDestination = hasGame
    ? `joylogue://game/${game.gameId}?source=widget-tonights-pick`
    : "joylogue://add?source=tonights-pick-widget";
  const destination = detailsDestination;
  const isMedium = environment.widgetFamily === "systemMedium";
  const usesArtwork = environment.widgetRenderingMode === "fullColor" && Boolean(game?.coverUri);

  if (!hasGame) {
    return (
      <ZStack
        modifiers={[
          containerBackground("#121212", "widget"),
          frame({ maxHeight: 400, maxWidth: 700 }),
          clipShape("containerRelativeShape"),
          widgetURL(destination),
          accessibilityLabel(copy.emptyAccessibility),
        ]}
      >
        <VStack spacing={8} modifiers={[padding({ all: 18 })]}>
          <Image
            systemName="sparkles"
            modifiers={[font({ size: 36, weight: "semibold" }), foregroundStyle("#FFFFFF")]}
          />
          <Text
            modifiers={[
              font({ size: 19, weight: "bold", design: "rounded" }),
              foregroundStyle("#F5F5F5"),
            ]}
          >
            {copy.tonightPick}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "caption" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(2),
            ]}
          >
            {copy.addToWantToPlay}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  return (
    <ZStack
      modifiers={[
        containerBackground("#121212", "widget"),
        frame({ maxHeight: 400, maxWidth: 700 }),
        clipShape("containerRelativeShape"),
        widgetURL(destination),
        accessibilityLabel(
          props.isPro
            ? `${copy.tonightPick}: ${game.title}. ${copy.proAccessibilitySuffix}`
            : `${copy.tonightPick}: ${game.title}. ${copy.lockedAccessibilitySuffix}`,
        ),
      ]}
    >
      {!isMedium && usesArtwork ? (
        <Image
          uiImage={game.coverUri ?? undefined}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: "fill" }),
            frame({ maxHeight: 400, maxWidth: 400 }),
            clipShape("containerRelativeShape"),
            widgetAccentedRenderingMode("desaturated"),
          ]}
        />
      ) : null}

      {!isMedium && usesArtwork ? (
        <Rectangle
          modifiers={[
            frame({ maxHeight: 400, maxWidth: 400 }),
            foregroundStyle({
              type: "linearGradient",
              colors: ["#00121212", "#9C121212", "#F5121212"],
              startPoint: { x: 0.5, y: 0.05 },
              endPoint: { x: 0.5, y: 1 },
            }),
          ]}
        />
      ) : null}

      {isMedium ? (
        <HStack
          spacing={16}
          modifiers={[
            frame({ maxHeight: 400, maxWidth: 700, alignment: "leading" }),
            padding({ all: 16 }),
          ]}
        >
          {usesArtwork ? (
            <Image
              uiImage={game.coverUri ?? undefined}
              modifiers={[
                resizable(),
                aspectRatio({ contentMode: "fill" }),
                frame({ height: 122, width: 82 }),
                clipShape("roundedRectangle", 16),
                widgetAccentedRenderingMode("desaturated"),
              ]}
            />
          ) : (
            <ZStack
              modifiers={[
                frame({ height: 122, width: 82 }),
                clipShape("roundedRectangle", 16),
                foregroundStyle("#252525"),
              ]}
            >
              <RoundedRectangle
                cornerRadius={16}
                modifiers={[
                  frame({ height: 122, width: 82 }),
                  foregroundStyle("#252525"),
                ]}
              />
              <Image
                systemName="sparkles"
                modifiers={[font({ size: 28, weight: "bold" }), foregroundStyle("#FFFFFF")]}
              />
            </ZStack>
          )}
          <VStack alignment="leading" spacing={5}>
            <HStack>
              <Text
                modifiers={[
                  font({ textStyle: "caption2", weight: "bold" }),
                  foregroundStyle("#64FFDA"),
                ]}
              >
                {copy.tonightPick.toUpperCase()}
              </Text>
              <Spacer />
              {!props.isPro ? (
                <Image
                  systemName="lock.fill"
                  modifiers={[
                    font({ size: 12, weight: "semibold" }),
                    foregroundStyle({ type: "hierarchical", style: "secondary" }),
                  ]}
                />
              ) : null}
            </HStack>
            <Text
              modifiers={[
                font({ size: 21, weight: "bold", design: "rounded" }),
                foregroundStyle("#F5F5F5"),
                lineLimit(2),
                minimumScaleFactor(0.76),
              ]}
            >
              {game.title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "caption", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(1),
              ]}
            >
              {game.platform || copy.fromBacklog}
            </Text>
            <Spacer />
            {props.isPro && games.length > 1 ? (
              <Button
                label={copy.shuffle}
                systemImage="shuffle"
                target="shuffle"
                onPress={() => ({ activeIndex: (safeIndex + 1) % games.length })}
                modifiers={[
                  buttonStyle("borderedProminent"),
                  buttonBorderShape("capsule"),
                  tint("#FFFFFF"),
                ]}
              />
            ) : (
              <Text
                modifiers={[
                  font({ textStyle: "caption", weight: "semibold" }),
                  foregroundStyle("#F5F5F5"),
                ]}
              >
                {props.isPro ? copy.openGame : copy.unlockShuffle}
              </Text>
            )}
          </VStack>
        </HStack>
      ) : (
        <VStack
          alignment="leading"
          spacing={5}
          modifiers={[
            frame({ maxHeight: 400, maxWidth: 400, alignment: "bottomLeading" }),
            padding({ all: 16 }),
          ]}
        >
          <HStack>
            <Text
              modifiers={[
                font({ textStyle: "caption2", weight: "bold" }),
                foregroundStyle(usesArtwork ? "#64FFDA" : "#F5F5F5"),
              ]}
            >
              {copy.tonightPick.toUpperCase()}
            </Text>
            <Spacer />
            {!props.isPro ? (
              <Image
                systemName="lock.fill"
                modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle("#F5F5F5")]}
              />
            ) : null}
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 20, weight: "bold", design: "rounded" }),
              foregroundStyle("#F5F5F5"),
              lineLimit(2),
              minimumScaleFactor(0.72),
            ]}
          >
            {game.title}
          </Text>
          <HStack>
            <Text
              modifiers={[
                font({ textStyle: "caption2", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(1),
              ]}
            >
              {game.platform || copy.fromBacklog}
            </Text>
            <Spacer />
            {props.isPro && games.length > 1 ? (
              <Button
                systemImage="shuffle"
                target="shuffle"
                onPress={() => ({ activeIndex: (safeIndex + 1) % games.length })}
                modifiers={[
                  buttonStyle("borderedProminent"),
                  buttonBorderShape("circle"),
                  tint("#FFFFFF"),
                ]}
              />
            ) : null}
          </HStack>
        </VStack>
      )}
    </ZStack>
  );
}

export const TonightsPickWidget = createWidget<TonightsPickWidgetProps>(
  "TonightsPickWidget",
  TonightsPickWidgetView,
);

export default TonightsPickWidget;
