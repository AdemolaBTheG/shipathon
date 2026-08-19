import YoutubePlayer from "react-native-youtube-iframe";

import type { GameTrailerPlayerProps } from "./game-trailer-player.types";

export function GameTrailerPlayer({
  height,
  videoId,
  width,
  style,
}: GameTrailerPlayerProps) {
  return (
    <YoutubePlayer
      height={height}
      play={false}
      videoId={videoId}
      width={width}
      viewContainerStyle={style}
      webViewProps={{ allowsInlineMediaPlayback: true }}
    />
  );
}
