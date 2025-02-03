import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useState, useEffect} from "react";
import {observer} from "mobx-react";
import {rootStore, trackStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher, StopScroll} from "@/utils/Utils.js";
import {Loader} from "@/components/common/Common";
import HLSPlayer from "hls.js";
import {
  DownloadFrameButton, FrameBack10Button, FrameBack1Button, FrameDisplay, FrameForward10Button, FrameForward1Button,
  FullscreenButton,
  PlayPauseButton,
  VideoTime,
  VolumeControls
} from "@/components/video/VideoControls";
import Overlay from "@/components/video/Overlay.jsx";

const S = CreateModuleClassMatcher(VideoStyles);


const Video = observer(() => {
  const [ready, setReady] = useState(false);
  const [hlsPlayer, setHLSPlayer] = useState(undefined);
  const [video, setVideo] = useState(undefined);

  useEffect(() => {
    if(!video || !videoStore.source || !videoStore.isVideo) {
      return;
    }

    video.__containerElement = document.querySelector("#video-container");

    setReady(false);

    video.addEventListener("canplay", () => setReady(true));

    // Add scroll handler for volume to video element
    StopScroll({element: video});

    const config = {
      nudgeOffset: 0.2,
      nudgeMaxRetry: 30,
      autoLevelEnabled: false,
      // TODO: Remove
      maxBufferLength: 2,
      maxBufferSize: 1 * 1024 * 1024,
      maxMaxBufferLength: 2,
      capLevelToPlayerSize: true
    };

    const player = new HLSPlayer(config);

    player.on(HLSPlayer.Events.MANIFEST_PARSED, function() {
      // stop video preloading when the manifest has been parsed
      player.stopLoad();
    });

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
    <div id="video-container" className={S("video-container", videoStore.fullScreen ? "video-container--fullscreen" : "")}>
      <div className={S("video-wrapper")}>
        {
          !video || !trackStore.showOverlay ? null :
            <Overlay element={video} />
        }
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
              <div className={S("video-controls__left")}>
                <PlayPauseButton/>
                <VolumeControls/>
                <VideoTime/>
              </div>
              <div className={S("video-controls__spacer")}/>
              {
                !videoStore.fullScreen ? null :
                  <div className={S("video-controls__center")}>
                    <FrameBack10Button />
                    <FrameBack1Button />
                    <FrameDisplay />
                    <FrameForward1Button />
                    <FrameForward10Button />
                    <div className={S("video-controls__spacer")}/>
                  </div>
              }
              <div className={S("video-controls__right")}>
                <DownloadFrameButton/>
                <FullscreenButton/>
              </div>
            </div>
        }
      </div>
      {
        ready || rootStore.errorMessage ? null :
          <Loader className={S("loader")}/>
      }
    </div>
  );
});

export default Video;
