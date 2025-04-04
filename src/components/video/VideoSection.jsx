import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react-lite";
import {rootStore, keyboardControlsStore, videoStore, editStore} from "@/stores";
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
import {AsyncButton, Confirm, Icon} from "@/components/common/Common.jsx";

import SaveIcon from "@/assets/icons/Save.svg";
import DescriptionIcon from "@/assets/icons/v2/description.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const VideoSection = observer(({showOverlay}) => {
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
          rootStore.page !== "clips" ? null :
           <AsyncButton
            color="gray.5"
            variant="outline"
            autoContrast
            h={30}
            px="xs"
            disabled={!editStore.hasUnsavedChanges}
            onClick={async () => await Confirm({
              title: "Save Changes",
              text: "Are you sure you want to save your changes?",
              onConfirm: async () => await editStore.SaveClips()
            })}
          >
            <Icon style={{height: 18}} icon={SaveIcon}/>
            <span style={{marginLeft: 5}}>
              Save
            </span>
          </AsyncButton>
        }
      </h1>
      <Video store={videoStore} showOverlay={showOverlay} showFrameDownload />
      <div className={S("toolbar")}>
        <Tooltip label={videoStore.videoObject?.description} w={500} multiline openDelay={1000}>
          <div className={S("toolbar__description")}>
            <SVG src={DescriptionIcon} className={S("icon", "toolbar__description-icon")} />
            <div className={S("toolbar__description-text")}>
              { videoStore.videoObject?.description }
            </div>
          </div>
        </Tooltip>
        <div className={S("toolbar__spacer")} />
        <div className={S("toolbar__controls-group", "toolbar__controls-group--tight")}>
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
