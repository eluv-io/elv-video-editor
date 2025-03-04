import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {videoStore} from "@/stores";
import {CreateModuleClassMatcher, StopScroll} from "@/utils/Utils.js";
import {IconButton, Input, SelectInput} from "@/components/common/Common";
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
import FrameBack10 from "@/assets/icons/v2/frame-back-10.svg";
import FrameBack1 from "@/assets/icons/v2/frame-back-1.svg";
import FrameForward1 from "@/assets/icons/v2/frame-forward-1.svg";
import FrameForward10 from "@/assets/icons/v2/frame-forward-10.svg";
import PlayClipIcon from "@/assets/icons/v2/play-clip.svg";

export const SubtitleControls = observer(() => {
  const tracks = videoStore.subtitleTracks.map(track => ({
    label: track.name || track.lang,
    value: track.id.toString()
  }));

  return (
    <SelectInput
      label="Subtitles"
      key={`subtitles-${videoStore.currentSubtitleTrack}`}
      value={videoStore.currentSubtitleTrack?.toString() || "-1"}
      options={[
        { label: "Subtitles Off", value: "-1"},
        ...tracks
      ]}
      onChange={value => value && videoStore.SetSubtitleTrack(value)}
    />
  );
});

export const AudioControls = observer(() => {
  const tracks = videoStore.audioTracks.map(track => ({
    label: track.name || track.lang,
    value: track.id.toString()
  }));

  return (
    <SelectInput
      label="Audio"
      key={`audio-${videoStore.currentAudioTrack}`}
      value={videoStore.currentAudioTrack?.toString() || "-1"}
      options={tracks}
      onChange={value => value && videoStore.SetAudioTrack(value)}
    />
  );
});

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

export const FrameBack10Button = observer(() => {
  return (
    <IconButton
      label="Back 10 Frames"
      onClick={() => videoStore.SeekFrames({frames: -10})}
      icon={FrameBack10}
      className={S("video-controls__button")}
    />
  );
});

export const FrameBack1Button = observer(() => {
  return (
    <IconButton
      label="Back 1 Frame"
      onClick={() => videoStore.SeekFrames({frames: -1})}
      icon={FrameBack1}
      className={S("video-controls__button")}
    />
  );
});

export const FrameForward1Button = observer(() => {
  return (
    <IconButton
      label="Forward 1 Frame"
      onClick={() => videoStore.SeekFrames({frames: 1})}
      icon={FrameForward1}
      className={S("video-controls__button")}
    />
  );
});

export const FrameForward10Button = observer(() => {
  return (
    <IconButton
      label="Forward 10 Frames"
      onClick={() => videoStore.SeekFrames({frames: 10})}
      icon={FrameForward10}
      className={S("video-controls__button")}
    />
  );
});

export const FrameDisplay = observer(() => {
  const [frameInput, setFrameInput] = useState(videoStore.frame);

  useEffect(() => {
    setFrameInput(videoStore.frame);
  }, [videoStore.frame]);

  return (
    <div className={S("frame-display")}>
      <Input
        label="Current Frame"
        monospace
        disabled={videoStore.playing}
        type="number"
        min={0}
        max={videoStore.totalFrames}
        step={1}
        w={100}
        value={frameInput}
        onKeyDown={event => {
          if(event.key !== "Enter") { return; }

          videoStore.Seek(frameInput);
        }}
        onChange={event => setFrameInput(parseInt(event.target.value) || 0)}
        onBlur={() => frameInput !== videoStore.frame && videoStore.Seek(frameInput)}
      />
    </div>
  );
});

export const PlayCurrentClipButton = observer(() => {
  return (
    <IconButton
      icon={PlayClipIcon}
      label="Play Current Selection"
      onClick={() => videoStore.PlaySegment(videoStore.clipInFrame, videoStore.clipOutFrame)}
    />
  );
});
