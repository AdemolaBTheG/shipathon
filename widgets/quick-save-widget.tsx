import {
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
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type QuickSaveWidgetProps = {
  copy?: {
    foundNextGame: string;
    pasteGameLink: string;
    pasteLink: string;
    quickSave: string;
    quickSaveAccessibility: string;
    quickSaveGame: string;
    saveBeforeGone: string;
    sourceInstructions: string;
  };
  ready: boolean;
};

const defaultCopy: NonNullable<QuickSaveWidgetProps["copy"]> = {
  foundNextGame: "Found your next game?",
  pasteGameLink: "Paste a game link",
  pasteLink: "Paste the link",
  quickSave: "Quick Save",
  quickSaveAccessibility: "Quick Save a game link",
  quickSaveGame: "Quick Save a game",
  saveBeforeGone: "Save it before it disappears.",
  sourceInstructions:
    "Copy a TikTok, YouTube, store, or web link, then tap here.",
};

function QuickSaveWidgetView(
  props: QuickSaveWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const copy = props.copy ?? defaultCopy;
  const destination = "joylogue://add?paste=1&resolve=1&source=widget";

  if (environment.widgetFamily === "accessoryInline") {
    return (
      <Text
        modifiers={[
          font({ textStyle: "caption", weight: "semibold" }),
          widgetURL(destination),
          accessibilityLabel(copy.quickSaveAccessibility),
        ]}
      >
        {copy.quickSaveGame}
      </Text>
    );
  }

  if (environment.widgetFamily === "accessoryCircular") {
    return (
      <ZStack
        modifiers={[
          frame({ maxHeight: 80, maxWidth: 80 }),
          widgetURL(destination),
          accessibilityLabel(copy.quickSaveAccessibility),
        ]}
      >
        <Image systemName="plus" modifiers={[font({ size: 23, weight: "bold" })]} />
      </ZStack>
    );
  }

  if (environment.widgetFamily === "accessoryRectangular") {
    return (
      <HStack
        spacing={7}
        modifiers={[
          frame({ maxHeight: 80, maxWidth: 180, alignment: "leading" }),
          widgetURL(destination),
          accessibilityLabel(copy.quickSaveAccessibility),
        ]}
      >
        <Image systemName="link.badge.plus" modifiers={[font({ size: 22, weight: "semibold" })]} />
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ textStyle: "headline", weight: "bold" })]}>
            {copy.quickSave}
          </Text>
          <Text modifiers={[font({ textStyle: "caption" }), lineLimit(1)]}>
            {copy.pasteGameLink}
          </Text>
        </VStack>
      </HStack>
    );
  }

  const isMedium = environment.widgetFamily === "systemMedium";

  return (
    <ZStack
      modifiers={[
        containerBackground("#121212", "widget"),
        frame({ maxHeight: 400, maxWidth: 700 }),
        clipShape("containerRelativeShape"),
        widgetURL(destination),
        accessibilityLabel(copy.quickSaveAccessibility),
      ]}
    >
      <Rectangle
        modifiers={[
          frame({ maxHeight: 400, maxWidth: 700 }),
          foregroundStyle({
            type: "linearGradient",
            colors: ["#12332D", "#17211F", "#121212"],
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 1, y: 1 },
          }),
          opacity(0.92),
        ]}
      />

      {isMedium ? (
        <HStack
          spacing={16}
          modifiers={[
            frame({ maxHeight: 400, maxWidth: 700, alignment: "leading" }),
            padding({ horizontal: 20, vertical: 18 }),
          ]}
        >
          <ZStack
            modifiers={[
              frame({ height: 62, width: 62 }),
              clipShape("roundedRectangle", 18),
              foregroundStyle("#FFFFFF"),
            ]}
          >
            <RoundedRectangle
              cornerRadius={18}
              modifiers={[
                frame({ height: 62, width: 62 }),
                foregroundStyle("#FFFFFF"),
              ]}
            />
            <Image
              systemName="link.badge.plus"
              modifiers={[font({ size: 26, weight: "bold" }), foregroundStyle("#121212")]}
            />
          </ZStack>
          <VStack alignment="leading" spacing={4}>
            <Text
              modifiers={[
                font({ size: 21, weight: "bold", design: "rounded" }),
                foregroundStyle("#F5F5F5"),
                lineLimit(1),
              ]}
            >
              {copy.saveBeforeGone}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "medium" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(2),
              ]}
            >
              {copy.sourceInstructions}
            </Text>
          </VStack>
          <Spacer />
          <Image
            systemName="chevron.right"
            modifiers={[
              font({ size: 17, weight: "bold" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          />
        </HStack>
      ) : (
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            frame({ maxHeight: 400, maxWidth: 400, alignment: "leading" }),
            padding({ all: 18 }),
          ]}
        >
          <HStack>
            <ZStack
              modifiers={[
                frame({ height: 42, width: 42 }),
                clipShape("roundedRectangle", 13),
                foregroundStyle("#FFFFFF"),
              ]}
            >
              <RoundedRectangle
                cornerRadius={13}
                modifiers={[
                  frame({ height: 42, width: 42 }),
                  foregroundStyle("#FFFFFF"),
                ]}
              />
              <Image
                systemName="plus"
                modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle("#121212")]}
              />
            </ZStack>
            <Spacer />
            <Text
              modifiers={[
                font({ textStyle: "caption2", weight: "bold" }),
                foregroundStyle("#64FFDA"),
              ]}
            >
              {copy.quickSave.toUpperCase()}
            </Text>
          </HStack>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 22, weight: "bold", design: "rounded" }),
              foregroundStyle("#F5F5F5"),
              lineLimit(2),
              minimumScaleFactor(0.78),
            ]}
          >
            {copy.foundNextGame}
          </Text>
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(1),
            ]}
          >
            {copy.pasteLink}
          </Text>
        </VStack>
      )}
    </ZStack>
  );
}

export const QuickSaveWidget = createWidget<QuickSaveWidgetProps>(
  "QuickSaveWidget",
  QuickSaveWidgetView,
);

export default QuickSaveWidget;
