import { VideoView, useVideoPlayer } from "expo-video";

type Props = {
  uri: string;
  style?: any;
};

export default function VideoPlayer({ uri, style }: Props) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={style}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
}