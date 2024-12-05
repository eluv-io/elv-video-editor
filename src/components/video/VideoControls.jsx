import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React from "react";
import {observer} from "mobx-react";
import {videoStore} from "@/stores";
import {CreateModuleClassMatcher, StopScroll} from "@/utils/Utils.js";
import {IconButton, SelectInput} from "@/components/common/Common";
import Fraction from "fraction.js";
import SVG from "react-inlinesvg";

const S = CreateModuleClassMatcher(VideoStyles);

import VolumeOffIcon from "@/assets/icons/VolumeOff.svg";
import VolumeLowIcon from "@/assets/icons/VolumeLow.svg";
import VolumeHighIcon from "@/assets/icons/VolumeHigh.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import PauseIcon from "@/assets/icons/Pause.svg";
import FrameIcon from "@/assets/icons/picture.svg";
import FullscreenIcon from "@/assets/icons/Maximize.svg";
import MinimizeIcon from "@/assets/icons/Minimize.svg";
import {FrameRates} from "@/utils/FrameAccurateVideo";

export const QualityControls = observer(() => {
  const levels = Object.keys(videoStore.levels).map(levelIndex => {
    const level = videoStore.levels[levelIndex];

    return ({
      label: `${level.attrs.RESOLUTION} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
      value: levelIndex?.toString()
    });
  });

  return (
    <SelectInput
      label="Video Quality"
      value={videoStore.currentLevel?.toString()}
      options={levels}
      onChange={value => value && videoStore.SetPlaybackLevel(value)}
    />
  );
});

export const OfferingControls = observer(() => {
  let offerings = Object.keys(videoStore.availableOfferings)
    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}))
    .map(offeringKey => ({
      value: offeringKey,
      label: videoStore.availableOfferings[offeringKey].display_name || offeringKey,
      disabled: videoStore.availableOfferings[offeringKey].disabled || false
    }));


  return (
    <SelectInput
      label="Offering"
      value={videoStore.offeringKey}
      options={offerings}
      onChange={value => value && videoStore.SetOffering(value)}
    />
  );
});

export const DropFrameControls = observer(() => {
  return (
    <SelectInput
      label="Drop Frame Notation"
      value={videoStore.dropFrame ? "DF" : "NDF"}
      options={["NDF", "DF"]}
      onChange={value => videoStore.SetDropFrame(value === "DF")}
    />
  );
});

export const FrameRateControls = observer(() => {
  const RateToString = rate => rate.toString().replace("(", "").replace(")", "");

  return (
    <SelectInput
      label={`Frame Rate: ${videoStore.frameRateKey} (${RateToString(FrameRates[videoStore.frameRateKey])} FPS)`}
      disabled={videoStore.frameRateSpecified}
      value={videoStore.frameRateKey}
      options={Object.keys(FrameRates)}
      onChange={value => videoStore.SetFrameRate({rateKey: value})}
    />
  );
});

export const PlaybackRateControl = observer(() => {
  // 0.1 intervals from 0.1x to 4x
  const rates = [...Array(40)]
    .map((_, i) => Fraction(i + 1).div(10).toString())
    .map(rate => ({label: `${rate}x`, value: rate}));

  return (
    <SelectInput
      label="Playback Rate"
      value={Fraction(videoStore.playbackRate).toString()}
      options={rates}
      onChange={value => videoStore.SetPlaybackRate(value)}
    />
  );
});

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
          onChange={event => videoStore.SetVolume(event.target.value)}
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
