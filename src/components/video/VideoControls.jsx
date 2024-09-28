import VideoStyles from "Assets/stylesheets/modules/video.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {videoStore} from "Stores";
import {CreateModuleClassMatcher, StopScroll} from "Utils/Utils";
import {IconButton} from "Components/common/Common";
import SVG from "react-inlinesvg";

const S = CreateModuleClassMatcher(VideoStyles);

import VolumeOffIcon from "Assets/icons/VolumeOff";
import VolumeLowIcon from "Assets/icons/VolumeLow";
import VolumeHighIcon from "Assets/icons/VolumeHigh";
import PlayIcon from "Assets/icons/Play";
import PauseIcon from "Assets/icons/Pause";
import FrameIcon from "Assets/icons/picture";
import FullscreenIcon from "Assets/icons/Maximize";
import MinimizeIcon from "Assets/icons/Minimize";

export const FullscreenButton = observer(() => {
  return (
    <IconButton
      label={videoStore.fullscreen ? "Exit Full Screen" : "Full Screen"}
      onClick={() => videoStore.ToggleFullscreen()}
      unstyled
      icon={videoStore.fullscreen ? MinimizeIcon : FullscreenIcon}
      className={S("video-controls__button")}
    />
  );
});

export const DownloadFrameButton = observer(() => {
  return (
    <IconButton
      label="Download Current Frame"
      icon={FrameIcon}
      unstyled
      onClick={() => videoStore.SaveFrame()}
      className={S("video-controls__button")}
    />
  );
});

export const VideoTime = observer(() => {
  return (
    <div className={S("video-time")}>
      <span className={S("video-time__time", "video-time__time--current")}>
        {videoStore.smpte}
      </span>
      <span className={S("video-time__separator")}>
        /
      </span>
      <span className={S("video-time__time", "video-time__time--total")}>
        {videoStore.durationSMPTE}
      </span>
    </div>
  );
});

export const VolumeSliderKeydown = () =>
  event => {
    switch(event.key) {
      case "ArrowLeft":
        event.preventDefault();
        videoStore.SetVolume(videoStore.volume - 0.05);
        break;
      case "ArrowRight":
        event.preventDefault();
        if(videoStore.muted) {
          videoStore.SetVolume(0.05);
        } else {
          videoStore.SetVolume(videoStore.volume + 0.05);
        }
        break;
    }
  };


export const VolumeControls = observer(() => {
  const icon = (videoStore.muted || videoStore.volume === 0) ? VolumeOffIcon :
    videoStore.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div
      ref={StopScroll()}
      onWheel={({deltaY}) => store.ScrollVolume(deltaY)}
      className={S("volume-controls")}
    >
      <IconButton
        label={videoStore.muted ? "Unmute" : "Mute"}
        icon={icon}
        unstyled
        onClick={() => videoStore.SetMuted(!videoStore.muted)}
        className={S("video-controls__button", "volume-controls__toggle")}
      />
      <div className={S("volume-controls__slider")}>
        <input
          aria-label="Volume slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={videoStore.muted ? 0 : videoStore.volume}
          onInput={event => videoStore.SetVolume(event.target.value)}
          onKeyDown={VolumeSliderKeydown()}
          className={S("volume-controls__slider-input")}
        />
        <progress
          max={1}
          value={videoStore.muted ? 0 : videoStore.volume}
          className={S("volume-controls__slider-progress")}
        />
      </div>
    </div>
  );
});

export const PlayPauseButton = observer(() => {
  return (
    <IconButton
      label={videoStore.paused ? "Play" : "Pause"}
      onClick={() => videoStore.PlayPause()}
      unstyled
      className={S("video-controls__button", "play-pause", videoStore.playing ? "play-pause--playing" : "play-pause--paused")}
    >
      <SVG src={PlayIcon} className={S("play-pause__icon", "play-pause__play")} />
      <SVG src={PauseIcon} className={S("play-pause__icon", "play-pause__pause")} />
    </IconButton>
  );
});
