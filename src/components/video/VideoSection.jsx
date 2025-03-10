import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react-lite";
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


const VideoSection = observer(({store, showOverlay}) => {
  store = store || videoStore;

  useEffect(() => {
    keyboardControlsStore.ToggleKeyboardControls(true);

    return () => keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <div className={S("content-block", "video-section")}>
      <h1 className={S("video-section__title")}>
        {store.name}
      </h1>
      <Video store={store} showOverlay={showOverlay} />
      <div className={S("toolbar")}>
        <Tooltip label={store.videoObject.description} w={500} multiline openDelay={1000}>
          <div className={S("toolbar__description")}>
            <SVG src={DescriptionIcon} className={S("icon", "toolbar__description-icon")} />
            <div className={S("toolbar__description-text")}>
              { store.videoObject.description }
            </div>
          </div>
        </Tooltip>
        <div className={S("toolbar__spacer")} />
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
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
