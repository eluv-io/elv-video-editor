import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useState, useEffect} from "react";
import {observer} from "mobx-react-lite";
import {rootStore, trackStore, tagStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {Loader} from "@/components/common/Common";
import HLSPlayer from "hls.js";
import {
  DownloadFrameButton,
  FrameBack10Button,
  FrameBack1Button,
  FrameDisplay,
  FrameForward10Button,
  FrameForward1Button,
  FullscreenButton,
  PlayPauseButton,
  SearchFrameButton,
  SearchFrameMenu, ShowVerticalButton,
  VideoTime,
  VolumeControls
} from "@/components/video/VideoControls";
import Overlay from "@/components/video/Overlay.jsx";
import MarkedSlider from "@/components/common/MarkedSlider.jsx";

const S = CreateModuleClassMatcher(VideoStyles);


const Video = observer(({
  store,
  vertical,
  showOverlay,
  showFrameDownload,
  showFrameSearch,
  showVertical,
  showProgress,
  fullscreenContainer,
  playoutUrl,
  blank,
  loading,
  muted=true,
  autoplay=false,
  contentId,
  volume=1,
  Callback,
  className=""
}) => {
  const [ready, setReady] = useState(false);
  const [hlsPlayer, setHLSPlayer] = useState(undefined);
  const [video, setVideo] = useState(undefined);
  const [videoId] = useState(rootStore.NextId());
  const [reloadIndex, setReloadIndex] = useState(0);
  const [resumeTime, setResumeTime] = useState(undefined);

  playoutUrl = playoutUrl || store.playoutUrl;

  useEffect(() => {
    if(!video || video.paused) { return; }

    // Pause video when content changes (e.g. different clip selected)
    store.PlayPause(true);
  }, [video, contentId]);

  useEffect(() => {
    if(!video || !playoutUrl || blank) {
      return;
    }

    playoutUrl = new URL(playoutUrl);
    const authorizationToken = playoutUrl.searchParams.get("authorization");
    playoutUrl.searchParams.delete("authorization");

    if(vertical) {
      playoutUrl.searchParams.set("v", "1");
    }

    playoutUrl = playoutUrl.toString();

    if(hlsPlayer) {
      hlsPlayer.destroy();
    }

    video.__containerElement = fullscreenContainer || document.querySelector(`#video-container-${videoId}`);

    setReady(false);

    video.addEventListener("canplay", () => setReady(true));

    video.volume = volume;

    // Add scroll handler for volume to video element
    StopScroll({element: video});

    let config;
    if(window.location.hostname === "localhost") {
      // Reduce quality for development
      config = {
        nudgeOffset: 0.2,
        nudgeMaxRetry: 30,
        autoLevelEnabled: false,
        maxBufferLength: 2,
        maxBufferSize: 1 * 1024 * 1024,
        maxMaxBufferLength: 2,
        capLevelToPlayerSize: true
      };
    } else {
      config = {
        maxBufferHole: store?.compositionObject ? 4.2 : 2.2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 12,
        highBufferWatchdogPeriod: 1,
        autoLevelEnabled: false
      };
    }

    config.xhrSetup = xhr => {
      xhr.setRequestHeader("Authorization", `Bearer ${authorizationToken}`);
      return xhr;
    };

    const player = new HLSPlayer(config);

    player.on(HLSPlayer.Events.MANIFEST_PARSED, function(_, info) {
      // stop video preloading when the manifest has been parsed
      player.stopLoad();

      // TODO: Remove - Set vertical video to 1080 automatically
      if(vertical) {
        const levelIndex = info?.levels?.findIndex(level => level.bitrate > 4510000);
        if(levelIndex >= 0) {
          player.currentLevel = levelIndex;
        }
      }
    });

    // Reload on fatal error
    player.on(HLSPlayer.Events.ERROR, function (event, data) {
      if(data.fatal) {
        console.error("Fatal HLS Error:");
        console.error(data);

        switch(data.type) {
          case HLSPlayer.ErrorTypes.MEDIA_ERROR:
            setTimeout(() => player.recoverMediaError(), 1000);
            break;
          default:
            setTimeout(() => {
              setResumeTime(video.currentTime);
              setReloadIndex(reloadIndex + 1);
            }, 3000);
        }
      }
    });

    setHLSPlayer(player);

    player.loadSource(playoutUrl);
    player.attachMedia(video);
    store.Initialize(video, player);

    // Ensure loading doesn't hang if the video doesn't want to preload
    setTimeout(() => {
      if(resumeTime) {
        video.currentTime = resumeTime;
        setResumeTime(undefined);
      }

      setReady(true);
    }, 2000);

    window.player = hlsPlayer;

    Callback?.(video);
  }, [video, playoutUrl, reloadIndex]);

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
    <div
      id={`video-container-${videoId}`}
      className={JoinClassNames(
        S(
          "video-container",
          store.fullScreen ? "video-container--fullscreen" : ""
        ),
        className
      )}
    >
      <div className={S("video-wrapper")}>
        {
           !video ? null :
             <Overlay
               key={`overlay-${tagStore.editPosition}`}
               element={video}
               editOnly={!showOverlay || !trackStore.showOverlay}
             />
        }
        <video
          key={`video-${playoutUrl}`}
          ref={setVideo}
          crossOrigin="anonymous"
          muted={muted}
          autoPlay={autoplay}
          controls={false}
          preload="auto"
          onWheel={({deltaY}) => store.ScrollVolume(deltaY)}
          className={S("video")}
        />
        {
          !ready || !store.showVideoControls ? null :
            <>
              <div className={S("video-bottom-controls")}>
                <div className={S("video-controls")}>
                  <div className={S("video-controls__left")}>
                    <PlayPauseButton store={store}/>
                    <VolumeControls store={store}/>
                    <VideoTime store={store}/>
                  </div>
                  <div className={S("video-controls__spacer")}/>
                  {
                    !store.fullScreen ? null :
                      <div className={S("video-controls__center")}>
                        <FrameBack10Button store={store} />
                        <FrameBack1Button store={store} />
                        <FrameDisplay store={store} />
                        <FrameForward1Button store={store} />
                        <FrameForward10Button store={store} />
                        <div className={S("video-controls__spacer")}/>
                      </div>
                  }
                  <div className={S("video-controls__right")}>
                    {
                      !showVertical ? null :
                        <ShowVerticalButton store={store} />
                    }
                    {
                      !showFrameSearch ? null :
                        <SearchFrameButton store={store} />
                    }
                    {
                      !showFrameDownload ? null :
                        <DownloadFrameButton store={store}/>
                    }
                    <FullscreenButton store={store} />
                  </div>
                </div>
                {
                  !showProgress && !store.fullScreen ? null :
                    <MarkedSlider
                      min={0}
                      max={100}
                      handles={[{ position: store.seek, style: "arrow" }]}
                      showMarks
                      topMarks
                      nMarks={50}
                      majorMarksEvery={10}
                      RenderText={progress => store.ProgressToSMPTE(progress, true)}
                      onChange={progress => store.Seek(store.ProgressToFrame(progress), false)}
                      className={S("video-controls__seek")}
                    />
                }
              </div>
            </>
        }
        {
          !tagStore.editedSearchFrame ? null :
            <SearchFrameMenu store={store} element={video} />
        }
      </div>
      {
        !loading && (ready || rootStore.errorMessage || blank) ? null :
          <Loader className={S("loader")}/>
      }
    </div>
  );
});

export default Video;
