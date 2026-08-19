import {
  HStack,
  Image,
  ProgressView,
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
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  progressViewStyle,
  resizable,
  tint,
  widgetAccentedRenderingMode,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type PlayingNowWidgetProps = {
  copy?: {
    chooseNext: string;
    emptyAccessibility: string;
    emptyBody: string;
    emptyTitle: string;
    noGame: string;
    playingNow: string;
    progressAccessibilitySuffix: string;
    startGame: string;
    updateProgress: string;
  };
  coverUri: string | null;
  gameId: number | null;
  progressCurrent: number;
  progressTotal: number;
  title: string | null;
};

const defaultCopy: NonNullable<PlayingNowWidgetProps["copy"]> = {
  chooseNext: "Choose what to play next",
  emptyAccessibility: "No game currently playing. Open Joylogue to choose one.",
  emptyBody: "Pick a game and start playing.",
  emptyTitle: "Nothing in progress",
  noGame: "No game currently playing",
  playingNow: "Playing Now",
  progressAccessibilitySuffix: "percent complete. Update progress.",
  startGame: "Start a game in Joylogue",
  updateProgress: "Tap to update progress",
};

function PlayingNowWidgetView(
  props: PlayingNowWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const total = Math.max(1, props.progressTotal || 100);
  const current = Math.min(total, Math.max(0, props.progressCurrent || 0));
  const progress = current / total;
  const percentage = Math.round(progress * 100);
  const copy = props.copy ?? defaultCopy;
  const hasGame = Boolean(props.gameId && props.title);
  const destination = hasGame
    ? `joylogue://progress?id=${props.gameId}&source=widget`
    : "joylogue://add?source=playing-widget";

  if (environment.widgetFamily === "accessoryInline") {
    return (
      <Text modifiers={[widgetURL(destination), lineLimit(1)]}>
        {hasGame ? `${props.title} · ${percentage}%` : copy.chooseNext}
      </Text>
    );
  }

  if (environment.widgetFamily === "accessoryCircular") {
    return (
      <ZStack
        modifiers={[
          frame({ height: 62, width: 62 }),
          widgetURL(destination),
          accessibilityLabel(
            hasGame
              ? `${props.title}, ${percentage} ${copy.progressAccessibilitySuffix}`
              : copy.noGame,
          ),
        ]}
      >
        {hasGame ? (
          <ProgressView
            value={progress}
            modifiers={[progressViewStyle("circular"), tint("#FFFFFF")]}
          />
        ) : (
          <Image systemName="play.fill" modifiers={[font({ size: 21, weight: "bold" })]} />
        )}
        {hasGame ? (
          <Text modifiers={[font({ size: 10, weight: "bold" })]}>{percentage}</Text>
        ) : null}
      </ZStack>
    );
  }

  if (environment.widgetFamily === "accessoryRectangular") {
    return (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[
          frame({ maxHeight: 80, maxWidth: 180, alignment: "leading" }),
          widgetURL(destination),
        ]}
      >
        <Text modifiers={[font({ textStyle: "headline", weight: "bold" }), lineLimit(1)]}>
          {hasGame ? props.title : copy.playingNow}
        </Text>
        {hasGame ? (
          <HStack spacing={6}>
            <ProgressView value={progress} modifiers={[progressViewStyle("linear")]} />
            <Text modifiers={[font({ textStyle: "caption", weight: "semibold" })]}>
              {percentage}%
            </Text>
          </HStack>
        ) : (
          <Text modifiers={[font({ textStyle: "caption" })]}>{copy.startGame}</Text>
        )}
      </VStack>
    );
  }

  const isMedium = environment.widgetFamily === "systemMedium";
  const usesArtwork = environment.widgetRenderingMode === "fullColor" && Boolean(props.coverUri);

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
            systemName="play.circle.fill"
            modifiers={[font({ size: 38, weight: "semibold" }), foregroundStyle("#FFFFFF")]}
          />
          <Text
            modifiers={[
              font({ size: 18, weight: "bold", design: "rounded" }),
              foregroundStyle("#F5F5F5"),
            ]}
          >
            {copy.emptyTitle}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "caption" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(2),
            ]}
          >
            {copy.emptyBody}
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
          `${props.title}, ${percentage} ${copy.progressAccessibilitySuffix}`,
        ),
      ]}
    >
      {!isMedium && usesArtwork ? (
        <Image
          uiImage={props.coverUri ?? undefined}
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
              colors: ["#00121212", "#B3121212", "#F2121212"],
              startPoint: { x: 0.5, y: 0 },
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
              uiImage={props.coverUri ?? undefined}
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
                systemName="gamecontroller.fill"
                modifiers={[font({ size: 29, weight: "semibold" }), foregroundStyle("#FFFFFF")]}
              />
            </ZStack>
          )}
          <VStack alignment="leading" spacing={6}>
            <Text
              modifiers={[
                font({ textStyle: "caption2", weight: "bold" }),
                foregroundStyle("#64FFDA"),
              ]}
            >
              {copy.playingNow.toUpperCase()}
            </Text>
            <Text
              modifiers={[
                font({ size: 21, weight: "bold", design: "rounded" }),
                foregroundStyle("#F5F5F5"),
                lineLimit(2),
                minimumScaleFactor(0.78),
              ]}
            >
              {props.title}
            </Text>
            <Spacer />
            <HStack spacing={10}>
              <ProgressView
                value={progress}
                modifiers={[progressViewStyle("linear"), tint("#FFFFFF")]}
              />
              <Text
                modifiers={[
                  font({ textStyle: "caption", weight: "bold" }),
                  foregroundStyle("#F5F5F5"),
                ]}
              >
                {percentage}%
              </Text>
            </HStack>
            <Text
              modifiers={[
                font({ textStyle: "caption2", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
              ]}
            >
              {copy.updateProgress}
            </Text>
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
          <Spacer />
          <Text
            modifiers={[
              font({ textStyle: "caption2", weight: "bold" }),
              foregroundStyle(usesArtwork ? "#64FFDA" : "#F5F5F5"),
            ]}
          >
            {copy.playingNow.toUpperCase()}
          </Text>
          <Text
            modifiers={[
              font({ size: 19, weight: "bold", design: "rounded" }),
              foregroundStyle("#F5F5F5"),
              lineLimit(2),
              minimumScaleFactor(0.72),
            ]}
          >
            {props.title}
          </Text>
          <HStack spacing={8}>
            <ProgressView
              value={progress}
              modifiers={[progressViewStyle("linear"), tint("#FFFFFF")]}
            />
            <Text
              modifiers={[
                font({ textStyle: "caption", weight: "bold" }),
                foregroundStyle("#F5F5F5"),
              ]}
            >
              {percentage}%
            </Text>
          </HStack>
        </VStack>
      )}
    </ZStack>
  );
}

export const PlayingNowWidget = createWidget<PlayingNowWidgetProps>(
  "PlayingNowWidget",
  PlayingNowWidgetView,
);

export default PlayingNowWidget;
