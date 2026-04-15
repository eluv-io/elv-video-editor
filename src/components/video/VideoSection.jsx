import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect} from "react";
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
  SubtitleControls, TimecodeOffsetToggle,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import {Confirm, StyledButton} from "@/components/common/Common.jsx";

import SaveIcon from "@/assets/icons/Save.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const VideoSection = observer(({
  store,
  title,
  vertical=false,
  showOverlay,
  showFrameSearch,
  showSave,
  showVertical,
  setShowVertical,
  Close
}) => {
  useEffect(() => {
    if(store) { return; }

    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  store = store || videoStore;

  return (
    <div className={S("content-block", "video-section")}>
      <h1 className={S("video-section__title")}>
        <div className={S("ellipsis")}>
          {title || store.name}
        </div>
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
                    onConfirm: async () => await videoStore.thumbnailStore?.RemoveThumbnailJob({
                      objectId: videoStore.videoObject?.objectId
                    }),
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
          !Close ? null :
            <StyledButton
              size="sm"
              title="Close"
              color="--background-modal"
              onClick={Close}
            >
              Close
            </StyledButton>
        }
      </h1>
      <Video
        store={store}
        vertical={vertical}
        showOverlay={showOverlay}
        showFrameSearch={showFrameSearch}
        showFrameDownload
        setShowvertical={setShowVertical}
        showVertical={showVertical}
      />
      <div className={S("toolbar")}>
        <div className={S("toolbar__spacer")} />
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
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
