import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react";
import {keyboardControlsStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AudioControls,
  DropFrameControls,
  FrameRateControls,
  OfferingControls,
  PlaybackRateControl,
  QualityControls,
  SubtitleControls,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import SVG from "react-inlinesvg";
import {Tooltip} from "@mantine/core";

import DescriptionIcon from "@/assets/icons/v2/description.svg";

const S = CreateModuleClassMatcher(VideoStyles);


const VideoSection = observer(() => {
  useEffect(() => {
    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <div className={S("content-block", "video-section")}>
      <h1 className={S("video-section__title")}>
        {videoStore.name}
      </h1>
      <Video/>
      <div className={S("toolbar")}>
        <Tooltip label={videoStore.videoObject.description} w={500} multiline openDelay={1000}>
          <div className={S("toolbar__description")}>
            <SVG src={DescriptionIcon} className={S("icon", "toolbar__description-icon")} />
            <div className={S("toolbar__description-text")}>
              { videoStore.videoObject.description }
            </div>
          </div>
        </Tooltip>
        <div className={S("toolbar__spacer")} />
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
          <PlaybackRateControl />
          <FrameRateControls />
          <DropFrameControls />
          <OfferingControls />
          <QualityControls />
          <SubtitleControls />
          <AudioControls />
        </div>
      </div>
    </div>
  );
});

export default VideoSection;
