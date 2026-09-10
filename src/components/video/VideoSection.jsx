import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {keyboardControlsStore, videoStore, editStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AudioControls,
  DropFrameControls,
  FrameRateControls,
  OfferingControls,
  PlaybackRateControl,
  QualityControls,
  SubtitleControls, SynopsisButton, TimecodeOffsetToggle,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import {Confirm, StyledButton} from "@/components/common/Common.jsx";

import SaveIcon from "@/assets/icons/Save.svg";
import SyncIcon from "@/assets/icons/sibling-arrow.svg";

const S = CreateModuleClassMatcher(VideoStyles);

// Sync current time / play/pause state between the two active videos
const StartSync = () => {
  const mainVideo = videoStore.video;
  const subVideo = videoStore.verticalVideoStore.video;

  if(!mainVideo || !subVideo) {
    return;
  }

  const Sync = (primary, secondary) => () => {
    const paused = primary.paused;

    if(Math.abs(primary.currentTime - secondary.currentTime) > 0.5) {
      secondary.currentTime = primary.currentTime;
    }

    if(paused) {
      primary.pause();
      secondary.pause();
    } else {
      primary.play();
      secondary.play();
    }
  };

  const MainSync = Sync(mainVideo, subVideo);
  const SubSync = Sync(subVideo, mainVideo);

  MainSync();

  mainVideo.addEventListener("seeked", MainSync);
  mainVideo.addEventListener("play", MainSync);
  mainVideo.addEventListener("pause", MainSync);

  subVideo.addEventListener("seeked", SubSync);
  subVideo.addEventListener("play", SubSync);
  subVideo.addEventListener("pause", SubSync);

  return {
    Stop: () => {
      mainVideo.removeEventListener("seeked", MainSync);
      mainVideo.removeEventListener("play", MainSync);
      mainVideo.removeEventListener("pause", MainSync);

      subVideo.removeEventListener("seeked", SubSync);
      subVideo.removeEventListener("play", SubSync);
      subVideo.removeEventListener("pause", SubSync);
    }
  };
};

const VideoSection = observer(({
  store,
  name,
  simple=false,
  vertical=false,
  showOverlay,
  showFrameSearch,
  showSave,
  showSynopsis,
  showVertical,
  setShowVertical,
  Close
}) => {
  const [stopSync, setStopSync] = useState(undefined);
  const objectId = videoStore.videoObject?.objectId;

  useEffect(() => {
    if(store) { return; }

    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  useEffect(() => stopSync?.Stop?.(), [stopSync]);

  store = store || videoStore;

  const isVerticalShowing = videoStore.showVertical && !!videoStore.verticalVideoStore;

  return (
    <div className={S("content-block", "video-section", vertical ? "video-section--vertical" : "")}>
      <h1 className={S("video-section__title")}>
        <div className={S("ellipsis")}>
          {name || store.name}
        </div>
        <div className={S("video-section__buttons")}>
          {
            !showSave ? null :
              <StyledButton
                size="sm"
                icon={SaveIcon}
                title="Save Changes"
                disabled={!editStore.HasUnsavedChanges("tags") && !editStore.HasUnsavedChanges("clips")}
                onClick={async () => {
                  if(videoStore.thumbnailStore?.generating) {
                    let cancelled = false;
                    await Confirm({
                      title: "Save Changes",
                      text: "Warning: Thumbnails are currently generating for this content. If you don't finalize the thumbnails before saving your changes, the thumbnails will be lost and thumbnail generation will have to be restarted. Do you want to proceed?",
                      onConfirm: async () => await videoStore.thumbnailStore?.RemoveThumbnailJob({objectId}),
                      onCancel: () => cancelled = true
                    });

                    if(cancelled) {
                      return;
                    }
                  }

                  await Confirm({
                    title: "Save Changes",
                    text: "Are you sure you want to save your changes?",
                    onConfirm: async () => await editStore.Save()
                  });
                }}
              >
                Publish
              </StyledButton>
          }
          {
            !vertical ? null :
              <StyledButton
                size="sm"
                title={stopSync ? "Stop Sync" : "Sync"}
                onClick={() => {
                  if(stopSync) {
                    stopSync?.Stop?.();
                    setStopSync(undefined);
                  } else {
                    setStopSync(StartSync);
                  }
                }}
                color={
                  stopSync ?
                    "--background-switch-active" :
                    "transparent"
                }
                icon={SyncIcon}
              >
                { stopSync ? "Stop Sync" : "Sync" }
              </StyledButton>
          }
          {
            !Close ? null :
              <StyledButton
                size="sm"
                title="Close"
                color="--color-highlight--dark"
                onClick={Close}
              >
                Close
              </StyledButton>
          }
        </div>
      </h1>
      <Video
        store={store}
        compact={!simple && isVerticalShowing}
        vertical={vertical}
        showEmbedUrl={vertical}
        showOverlay={showOverlay}
        showFrameSearch={showFrameSearch}
        showFrameDownload
        setShowvertical={setShowVertical}
        showVertical={showVertical}
        showProgress={vertical}
        Callback={
          !vertical ? null :
            () => setStopSync(StartSync)
        }
      />
      <div className={S("toolbar")}>
        {
          !showSynopsis || (!simple && isVerticalShowing) ? null :
            <SynopsisButton showPreview store={videoStore} objectId={objectId} />
        }
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
          <div className={S("toolbar__spacer")} />
          {
            !showSynopsis || simple || !isVerticalShowing ? null :
              <SynopsisButton store={videoStore} objectId={objectId} />
          }
          <TimecodeOffsetToggle store={store} />
          <PlaybackRateControl store={store} />
          <FrameRateControls store={store} />
          <DropFrameControls store={store} />
          <OfferingControls store={store} />
          <QualityControls store={store} />
          <SubtitleControls store={store} />
          <AudioControls store={store} />
        </div>
      </div>
    </div>
  );
});

export default VideoSection;
