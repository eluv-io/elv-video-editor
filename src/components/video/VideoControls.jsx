import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher, StopScroll} from "@/utils/Utils.js";
import {IconButton, Input, SelectInput} from "@/components/common/Common";
import Fraction from "fraction.js";
import SVG from "react-inlinesvg";
import {FrameRates} from "@/utils/FrameAccurateVideo";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(VideoStyles);

import VolumeOffIcon from "@/assets/icons/VolumeOff.svg";
import VolumeLowIcon from "@/assets/icons/VolumeLow.svg";
import VolumeHighIcon from "@/assets/icons/VolumeHigh.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import PauseIcon from "@/assets/icons/Pause.svg";
import FrameIcon from "@/assets/icons/picture.svg";
import FullscreenIcon from "@/assets/icons/Maximize.svg";
import MinimizeIcon from "@/assets/icons/Minimize.svg";
import FrameBack10 from "@/assets/icons/v2/frame-back-10.svg";
import FrameBack1 from "@/assets/icons/v2/frame-back-1.svg";
import FrameForward1 from "@/assets/icons/v2/frame-forward-1.svg";
import FrameForward10 from "@/assets/icons/v2/frame-forward-10.svg";
import PlayClipIcon from "@/assets/icons/v2/play-clip.svg";

export const SubtitleControls = observer(({store}) => {
  const tracks = store.subtitleTracks.map(track => ({
    label: track.name || track.lang,
    value: track.id.toString()
  }));

  if(tracks.length === 0) {
    return null;
  }

  return (
    <SelectInput
      label="Subtitles"
      key={`subtitles-${store.currentSubtitleTrack}`}
      value={store.currentSubtitleTrack?.toString() || "-1"}
      options={[
        { label: "Subtitles Off", value: "-1"},
        ...tracks
      ]}
      onChange={value => value && store.SetSubtitleTrack(value)}
    />
  );
});

export const AudioControls = observer(({store}) => {
  const tracks = store.audioTracks.map(track => ({
    label: track.name || track.lang,
    value: track.id.toString()
  }));

  if(tracks.length === 1) {
    return null;
  }

  return (
    <SelectInput
      label="Audio"
      key={`audio-${store.currentAudioTrack}`}
      value={store.currentAudioTrack?.toString() || "-1"}
      options={tracks}
      onChange={value => value && store.SetAudioTrack(value)}
    />
  );
});

export const QualityControls = observer(({store}) => {
  const levels = Object.keys(store.levels).map(levelIndex => {
    const level = store.levels[levelIndex];

    return ({
      label: `${level.attrs.RESOLUTION} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
      value: levelIndex?.toString()
    });
  });

  return (
    <SelectInput
      label="Video Quality"
      value={store.currentLevel?.toString()}
      options={levels}
      onChange={value => value && store.SetPlaybackLevel(value)}
    />
  );
});

export const OfferingControls = observer(({store}) => {
  let offerings = Object.keys(store.availableOfferings || {})
    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}))
    .map(offeringKey => ({
      value: offeringKey,
      label: store.availableOfferings[offeringKey].display_name || offeringKey,
      disabled: store.availableOfferings[offeringKey].disabled || false
    }));


  return (
    <SelectInput
      label="Offering"
      value={store.offeringKey}
      options={offerings}
      onChange={value => value && store.SetOffering(value)}
    />
  );
});

export const DropFrameControls = observer(({store}) => {
  return (
    <SelectInput
      label="Drop Frame Notation"
      value={store.dropFrame ? "DF" : "NDF"}
      options={["NDF", "DF"]}
      onChange={value => store.SetDropFrame(value === "DF")}
    />
  );
});

export const FrameRateControls = observer(({store}) => {
  const RateToString = rate => rate.toString().replace("(", "").replace(")", "");

  return (
    <SelectInput
      label={`Frame Rate: ${store.frameRateKey} (${RateToString(FrameRates[store.frameRateKey])} FPS)`}
      disabled={store.frameRateSpecified}
      value={store.frameRateKey}
      options={Object.keys(FrameRates)}
      onChange={value => store.SetFrameRate({rateKey: value})}
    />
  );
});

export const PlaybackRateControl = observer(({store}) => {
  // 0.1 intervals from 0.1x to 4x
  const rates = [...Array(40)]
    .map((_, i) => Fraction(i + 1).div(10).toString())
    .map(rate => ({label: `${rate}x`, value: rate}));

  return (
    <SelectInput
      label="Playback Rate"
      value={Fraction(store.playbackRate).toString()}
      options={rates}
      onChange={value => store.SetPlaybackRate(value)}
    />
  );
});

export const TimecodeOffsetToggle = observer(({store}) => {
  if(!store.timecodeOffset) { return null; }

  return (
    <Tooltip
      label={store.showTimecodeOffset ? `Hide Timecode Offset (${store.timecodeOffset})` : `Show Timecode Offset (${store.timecodeOffset})`}
    >
      <button
        key={`fullscreen-button-${store.fullScreen}`}
        onClick={() => store.ToggleTimecodeOffset(!store.showTimecodeOffset)}
        className={S("video-controls__timecode-offset", store.showTimecodeOffset ? "video-controls__timecode-offset--active" : "")}
      >
        { store.showTimecodeOffset ? store.timecodeOffset : store.FrameToSMPTE(0) }
      </button>
    </Tooltip>
  );
});

export const FullscreenButton = observer(({store}) => {
  return (
    <IconButton
      key={`fullscreen-button-${store.fullScreen}`}
      label={store.fullScreen ? "Exit Full Screen" : "Full Screen"}
      onClick={() => store.ToggleFullscreen()}
      unstyled
      icon={store.fullScreen ? MinimizeIcon : FullscreenIcon}
      className={S("video-controls__button")}
    />
  );
});

export const DownloadFrameButton = observer(({store}) => {
  return (
    <IconButton
      label="Download Current Frame"
      icon={FrameIcon}
      unstyled
      onClick={() => store.SaveFrame()}
      className={S("video-controls__button")}
    />
  );
});

export const VideoTime = observer(({store}) => {
  return (
    <div className={S("video-time")}>
      <span className={S("video-time__time", "video-time__time--current")}>
        {
          store.showTimecodeOffset ?
            store.offsetSMPTE :
            store.smpte
        }
      </span>
      <span className={S("video-time__separator")}>
        /
      </span>
      <span className={S("video-time__time", "video-time__time--total")}>
        {
          store.showTimecodeOffset ?
            store.offsetDurationSMPTE :
            store.durationSMPTE
        }
      </span>
    </div>
  );
});

export const VolumeSliderKeydown = () =>
  event => {
    switch(event.key) {
      case "ArrowLeft":
        event.preventDefault();
        store.SetVolume(store.volume - 0.05);
        break;
      case "ArrowRight":
        event.preventDefault();
        if(store.muted) {
          store.SetVolume(0.05);
        } else {
          store.SetVolume(store.volume + 0.05);
        }
        break;
    }
  };


export const VolumeControls = observer(({store}) => {
  const icon = (store.muted || store.volume === 0) ? VolumeOffIcon :
    store.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div
      ref={StopScroll()}
      onWheel={({deltaY}) => store.ScrollVolume(deltaY)}
      className={S("volume-controls")}
    >
      <IconButton
        label={store.muted ? "Unmute" : "Mute"}
        icon={icon}
        unstyled
        onClick={() => store.SetMuted(!store.muted)}
        className={S("video-controls__button", "volume-controls__toggle")}
      />
      <div className={S("volume-controls__slider")}>
        <input
          aria-label="Volume slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={store.muted ? 0 : store.volume}
          onInput={event => store.SetVolume(event.target.value)}
          onChange={event => store.SetVolume(event.target.value)}
          onKeyDown={VolumeSliderKeydown()}
          className={S("volume-controls__slider-input")}
        />
        <progress
          max={1}
          value={store.muted ? 0 : store.volume}
          className={S("volume-controls__slider-progress")}
        />
      </div>
    </div>
  );
});

export const PlayPauseButton = observer(({store}) => {
  return (
    <IconButton
      label={store.paused ? "Play" : "Pause"}
      onClick={() => store.PlayPause()}
      unstyled
      className={S("video-controls__button", "play-pause", store.playing ? "play-pause--playing" : "play-pause--paused")}
    >
      <SVG src={PlayIcon} className={S("play-pause__icon", "play-pause__play")} />
      <SVG src={PauseIcon} className={S("play-pause__icon", "play-pause__pause")} />
    </IconButton>
  );
});

export const FrameBack10Button = observer(({store}) => {
  return (
    <IconButton
      label="Back 10 Frames"
      onClick={() => store.SeekFrames({frames: -10})}
      icon={FrameBack10}
      className={S("video-controls__button")}
    />
  );
});

export const FrameBack1Button = observer(({store}) => {
  return (
    <IconButton
      label="Back 1 Frame"
      onClick={() => store.SeekFrames({frames: -1})}
      icon={FrameBack1}
      className={S("video-controls__button")}
    />
  );
});

export const FrameForward1Button = observer(({store}) => {
  return (
    <IconButton
      label="Forward 1 Frame"
      onClick={() => store.SeekFrames({frames: 1})}
      icon={FrameForward1}
      className={S("video-controls__button")}
    />
  );
});

export const FrameForward10Button = observer(({store}) => {
  return (
    <IconButton
      label="Forward 10 Frames"
      onClick={() => store.SeekFrames({frames: 10})}
      icon={FrameForward10}
      className={S("video-controls__button")}
    />
  );
});

export const FrameDisplay = observer(({store}) => {
  const offset = !store.showTimecodeOffset ? 0 : store.timecodeOffsetFrames;
  const [frameInput, setFrameInput] = useState(store.frame + offset);

  useEffect(() => {
    setFrameInput(store.frame);
  }, [store.frame, store.showTimecodeOffset]);

  const Update = () => {
    const frame = Math.max(0, Math.min(store.totalFrames, parseInt(frameInput)));

    setFrameInput(frame);

    if(store.frame !== frame) {
      store.Seek(frame);
    }
  };

  return (
    <div className={S("frame-display")}>
      <Input
        label="Current Frame"
        monospace
        disabled={store.playing}
        type="number"
        min={0 + offset}
        max={store.totalFrames + offset}
        step={1}
        w={100}
        value={frameInput + offset}
        onKeyDown={event => {
          if(event.key !== "Enter") { return; }

          Update();
        }}
        onChange={event => setFrameInput((parseInt(event.target.value) || 0) - offset)}
        onBlur={() => Update()}
      />
    </div>
  );
});

export const PlayCurrentClipButton = observer(({store, clipInFrame, clipOutFrame}) => {
  return (
    <IconButton
      highlight
      icon={PlayClipIcon}
      label="Play Current Selection"
      onClick={() => store.PlaySegment(
        typeof clipInFrame !== "undefined" ? clipInFrame : store.clipInFrame,
        typeof clipOutFrame !== "undefined" ? clipOutFrame : store.clipOutFrame
      )}
    />
  );
});
