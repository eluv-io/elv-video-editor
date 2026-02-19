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
import SVG from "react-inlinesvg";
import {Tooltip} from "@mantine/core";
import {Confirm, StyledButton} from "@/components/common/Common.jsx";

import SaveIcon from "@/assets/icons/Save.svg";
import DescriptionIcon from "@/assets/icons/v2/description.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const VideoSection = observer(({showOverlay, showSave}) => {
  useEffect(() => {
    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <div className={S("content-block", "video-section")}>
      <h1 className={S("video-section__title")}>
        <div className={S("ellipsis")}>
          {videoStore.name}
        </div>
        {
          !showSave ? null :
            <StyledButton
              small
              icon={SaveIcon}
              title="Save Changes"
              disabled={!editStore.HasUnsavedChanges("tags") && !editStore.HasUnsavedChanges("clips")}
              onClick={async () => {
                if(videoStore.thumbnailStore?.generating) {
                  let cancelled = false;
                  await Confirm({
                    title: "Publish Changes",
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
      </h1>
      <Video store={videoStore} showOverlay={showOverlay} showFrameDownload />
      <div className={S("toolbar")}>
        <Tooltip disabled={!videoStore.videoObject?.description} label={videoStore.videoObject?.description} w={500} multiline openDelay={1000}>
          <div className={S("toolbar__description")}>
            <SVG src={DescriptionIcon} className={S("icon", "toolbar__description-icon")} />
            <div className={S("toolbar__description-text")}>
              { videoStore.videoObject?.description }
            </div>
          </div>
        </Tooltip>
        <div className={S("toolbar__spacer")} />
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
          <TimecodeOffsetToggle store={videoStore} />
          <PlaybackRateControl store={videoStore} />
          <FrameRateControls store={videoStore} />
          <DropFrameControls store={videoStore} />
          <OfferingControls store={videoStore} />
          <QualityControls store={videoStore} />
          <SubtitleControls store={videoStore} />
          <AudioControls store={videoStore} />
        </div>
      </div>
    </div>
  );
});

export default VideoSection;
