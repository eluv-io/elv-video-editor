import VideoStyles from "Assets/stylesheets/modules/video.module.scss";

import React, {useState, useEffect} from "react";
import {observer} from "mobx-react";
import {videoStore} from "Stores";
import {CreateModuleClassMatcher, StopScroll} from "Utils/Utils";
import {Loader} from "Components/common/Common";
import HLSPlayer from "hls.js";
import {
  DownloadFrameButton,
  FullscreenButton,
  PlayPauseButton,
  VideoTime,
  VolumeControls
} from "Components/video/VideoControls";

const S = CreateModuleClassMatcher(VideoStyles);


const Video = observer(() => {
  const [ready, setReady] = useState(false);
  const [hlsPlayer, setHLSPlayer] = useState(undefined);
  const [video, setVideo] = useState(undefined);

  useEffect(() => {
    if(!video || !videoStore.source || !videoStore.isVideo) {
      return;
    }

    setReady(false);

    video.addEventListener("canplay", () => setReady(true));

    // Add scroll handler for volume to video element
    StopScroll()(video);

    const config = {
      nudgeOffset: 0.2,
      nudgeMaxRetry: 30,
      autoLevelEnabled: false
    };

    const player = new HLSPlayer(config);

    setHLSPlayer(player);

    player.loadSource(videoStore.source);
    player.attachMedia(video);

    videoStore.Initialize(video, player);

    window.player = hlsPlayer;
  }, [video]);

  useEffect(() => {
    return () => {
      if(!hlsPlayer) { return; }

      try {
        hlsPlayer.destroy();
        window.player = undefined;
      } catch(error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    };
  }, [hlsPlayer]);

  return (
    <div className={S("video-container")}>
      <div className={S("video-wrapper")}>
        <video
          key={`video-${videoStore.source}`}
          ref={setVideo}
          crossOrigin="anonymous"
          muted={true}
          autoPlay={false}
          controls={false}
          preload="auto"
          onWheel={({deltaY}) => videoStore.ScrollVolume(deltaY)}
          className={S("video")}
        />
        {
          !ready ? null :
            <div className={S("video-controls")}>
              <PlayPauseButton />
              <VolumeControls />
              <VideoTime />
              <div className={S("video-controls__spacer")} />
              <DownloadFrameButton />
              <FullscreenButton />
            </div>
        }
      </div>
      {
        ready ? null :
          <Loader className={S("loader")} />
      }
    </div>
  );
});

export default Video;
