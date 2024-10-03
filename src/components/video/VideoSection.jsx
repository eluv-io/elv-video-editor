import VideoStyles from "Assets/stylesheets/modules/video.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {videoStore} from "Stores";
import {CreateModuleClassMatcher} from "Utils/Utils";
import {
  DropFrameControls, FrameRateControls, OfferingControls,
  PlaybackRateControl, QualityControls,
} from "Components/video/VideoControls";
import Video from "Components/video/Video";
import SVG from "react-inlinesvg";
import {Tooltip} from "@mantine/core";

import DescriptionIcon from "Assets/icons/v2/description";

const S = CreateModuleClassMatcher(VideoStyles);


const VideoSection = observer(() => {
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
        <div className={S("toolbar__controls-group")}>
          <PlaybackRateControl />
          <FrameRateControls />
          <DropFrameControls />
          <OfferingControls />
          <QualityControls />
        </div>
      </div>
    </div>
  );
});

export default VideoSection;
