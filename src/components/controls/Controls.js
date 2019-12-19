// A collection of reusable control elements tied to state store

import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, Range, Slider, ToolTip} from "elv-components-js";
import {FrameRates} from "../../utils/FrameAccurateVideo";
import Fraction from "fraction.js/fraction";

import PauseButton from "../../static/icons/Pause.svg";
import PlayButton from "../../static/icons/Play.svg";
import MaximizeIcon from "../../static/icons/Maximize.svg";
import MinimizeIcon from "../../static/icons/Minimize.svg";
import VolumeOff from "../../static/icons/VolumeOff.svg";
import VolumeLow from "../../static/icons/VolumeLow.svg";
import VolumeHigh from "../../static/icons/VolumeHigh.svg";

let PlaybackLevel = (props) => {
  return (
    <ToolTip content={<span>Playback Level</span>}>
      <select
        aria-label="Playback Level"
        value={props.video.currentLevel}
        className={"video-playback-level"}
        onChange={event => props.video.SetPlaybackLevel(event.target.value)}
      >
        {Object.keys(props.video.levels).map(levelIndex => {
          const level = props.video.levels[levelIndex];

          return (
            <option key={`playback-level-${levelIndex}`} value={levelIndex}>
              {`${level.attrs.RESOLUTION} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`}
            </option>
          );
        })}
      </select>
    </ToolTip>
  );
};

let PlaybackRate = (props) => {
  // TODO: Negative rates

  // 0.1 intervals from 0.1x to 4x
  const rates = [...Array(40)].map((_, i) => Fraction(i + 1).div(10));

  return (
    <ToolTip content={<span>Playback Rate</span>}>
      <select
        aria-label="Playback Rate"
        className="video-playback-rate"
        value={Fraction(props.video.playbackRate)}
        onChange={event => props.video.SetPlaybackRate(event.target.value)}
      >
        {rates.map(rate =>
          <option key={`video-rate-${rate}`} value={rate}>{`${rate}x`}</option>
        )}
      </select>
    </ToolTip>
  );
};

let FrameRate = (props) => {
  return (
    <ToolTip content={<span>Frame Rate</span>}>
      <select
        aria-label="Frame Rate"
        value={props.video.frameRateKey}
        onChange={event => props.video.SetFrameRate(event.target.value)}
      >
        {Object.keys(FrameRates).map(frameRateKey =>
          <option key={`frame-rate-${frameRateKey}`} value={frameRateKey}>{frameRateKey}</option>
        )}
      </select>
    </ToolTip>
  );
};

let DropFrame = (props) => {
  if(!["NTSC", "NTSCFilm", "NTSCHD"].includes(props.video.frameRateKey)) {
    return null;
  }

  return (
    <ToolTip content={<span>Drop Frame Notation</span>}>
      <select
        aria-label="Drop Frame Notation"
        value={props.video.dropFrame}
        onChange={event => props.video.SetDropFrame(event.target.value === "true")}
      >
        <option value={false}>NDF</option>
        <option value={true}>DF</option>
      </select>
    </ToolTip>
  );
};

let PlayPause = (props) => {
  const label = props.video.playing ? "Pause" : "Play";

  return (
    <IconButton
      className="video-control-play-pause"
      label={label}
      icon={props.video.playing ? PauseButton : PlayButton}
      onClick={props.video.PlayPause}
    />
  );
};

let FullscreenToggle = (props) => {
  const label = props.video.fullScreen ? "Exit Full Screen" : "Full Screen";

  return (
    <ToolTip content={<span>{label}</span>}>
      <IconButton
        label={label}
        icon={props.video.fullScreen ? MinimizeIcon : MaximizeIcon}
        onClick={props.video.ToggleFullscreen}
      />
    </ToolTip>
  );
};

let Volume = (props) => {
  const icon = (props.video.muted || props.video.volume === 0) ? VolumeOff :
    props.video.volume < (props.video.scale / 2) ? VolumeLow : VolumeHigh;

  return (
    <div
      onWheel={({deltaY}) => props.video.ScrollVolume(deltaY)}
      className="video-volume-controls"
    >
      <ToolTip content={<span>{props.video.muted ? "Unmute" : "Mute"}</span>}>
        <IconButton
          icon={icon}
          onClick={() => props.video.SetMuted(!props.video.muted)}
          className="video-volume-icon"
        />
      </ToolTip>
      <Slider
        min={0}
        max={props.video.scale}
        value={props.video.muted ? 0 : props.video.volume}
        renderToolTip={value => `${Math.floor((value / props.video.scale) * 100)}%`}
        className="video-volume-slider"
        onChange={volume => props.video.SetVolume(volume)}
      />
    </div>
  );
};

let FrameControl = ({video, frames=0, seconds=0, label, icon}) => {
  return (
    <IconButton
      label={label}
      icon={icon}
      onClick={() => {
        video.SeekFrames({frames, seconds});
      }}
    />
  );
};

let Seek = (props) => {
  return (
    <Slider
      key="video-progress"
      min={props.video.scaleMin}
      max={props.video.scaleMax}
      value={props.video.seek}
      handleClassName="video-seek-handle"
      showMarks={true}
      renderToolTip={value => <span>{props.video.ProgressToSMPTE(value)}</span>}
      onChange={(value) => props.video.SeekPercentage(Fraction(value).div(props.video.scale))}
      className="video-seek"
    />
  );
};

let Scale = (props) => {
  return (
    <Range
      key="video-scale"
      min={0}
      max={props.video.scale}
      handles={[
        {
          position: props.video.scaleMin,
        },
        {
          position: props.video.seek,
          disabled: true,
          className: "video-seek-handle"
        },
        {
          position: props.video.scaleMax
        }
      ]}
      showMarks={true}
      renderToolTip={value => <span>{props.video.ProgressToSMPTE(value)}</span>}
      onChange={([scaleMin, seek, scaleMax]) => props.video.SetScale(scaleMin, seek, scaleMax)}
      className="video-scale"
    />
  );
};

DropFrame = inject("video")(observer(DropFrame));
FrameControl = inject("video")(observer(FrameControl));
FrameRate = inject("video")(observer(FrameRate));
FullscreenToggle = inject("video")(observer(FullscreenToggle));
PlaybackLevel = inject("video")(observer(PlaybackLevel));
PlaybackRate = inject("video")(observer(PlaybackRate));
PlayPause = inject("video")(observer(PlayPause));
Scale = inject("video")(observer(Scale));
Seek = inject("video")(observer(Seek));
Volume = inject("video")(observer(Volume));

export {
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackLevel,
  PlaybackRate,
  PlayPause,
  Scale,
  Seek,
  Volume
};
