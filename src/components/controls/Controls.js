import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, Range, Slider, ToolTip} from "elv-components-js";
import {FrameRates} from "../../utils/FrameAccurateVideo";
import Fraction from "fraction.js/fraction";

import PauseButton from "../../static/icons/Pause.svg";
import PlayButton from "../../static/icons/Play.svg";
import MaximizeIcon from "../../static/icons/Maximize.svg";
import VolumeOff from "../../static/icons/VolumeOff.svg";
import VolumeLow from "../../static/icons/VolumeLow.svg";
import VolumeHigh from "../../static/icons/VolumeHigh.svg";
import FrameForward from "../../static/icons/Forward.svg";
import SecondForward from "../../static/icons/DoubleForward.svg";
import FrameBackward from "../../static/icons/Backward.svg";
import SecondBackward from "../../static/icons/DoubleBackward.svg";

let PlaybackRate = (props) => {
  // TODO: Negative rates
  const rates = [
    0.1,
    0.25,
    0.5,
    0.75,
    1,
    2,
    4,
    8,
    16,
    32,
    64
  ];

  return (
    <ToolTip content={<span>Playback Rate</span>}>
      <select
        aria-label="Playback Rate"
        className="video-playback-rate"
        value={props.video.playbackRate}
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
  if(props.video.frameRateKey !== "NTSC" && props.video.frameRateKey !== "NTSCHD") {
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
    <ToolTip content={<span>{label}</span>}>
      <IconButton
        label={label}
        icon={props.video.playing ? PauseButton : PlayButton}
        onClick={props.video.PlayPause}
      />
    </ToolTip>
  );
};

let Maximize = (props) => {
  return (
    <ToolTip content={<span>Full Screen</span>}>
      <IconButton
        label="Full Screen"
        icon={MaximizeIcon}
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
      <ToolTip content={<span>Volume</span>}>
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

let FrameControl = ({video, forward=true, frame=true}) => {
  let icon, label;
  if(forward) {
    if(frame) {
      icon = FrameForward;
      label = "Forward 1 Frame";
    } else {
      icon = SecondForward;
      label = "Forward 1 Second";
    }
  } else {
    if(frame) {
      icon = FrameBackward;
      label = "Backward 1 Frame";
    } else {
      icon = SecondBackward;
      label = "Backward 1 Second";
    }
  }

  return (
    <ToolTip content={<span>{label}</span>}>
      <IconButton
        label={label}
        icon={icon}
        onClick={() => {
          let frames = 1;
          if(!frame) {
            frames = video.frameRate.ceil();
          }

          if(forward) {
            video.SeekForward(frames);
          } else {
            video.SeekBackward(frames);
          }
        }}
      />
    </ToolTip>
  );
};

let Seek = (props) => {
  return (
    <Slider
      key="video-progress"
      min={props.video.scaleMin}
      max={props.video.scaleMax}
      value={props.video.seek}
      showMarks={true}
      renderToolTip={value => <span>{props.video.ProgressToSMPTE(value)}</span>}
      onChange={(value) => props.video.Seek(Fraction(value).div(props.video.scale))}
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
Maximize = inject("video")(observer(Maximize));
PlaybackRate = inject("video")(observer(PlaybackRate));
PlayPause = inject("video")(observer(PlayPause));
Scale = inject("video")(observer(Scale));
Seek = inject("video")(observer(Seek));
Volume = inject("video")(observer(Volume));

export {
  DropFrame,
  FrameControl,
  FrameRate,
  Maximize,
  PlaybackRate,
  PlayPause,
  Scale,
  Seek,
  Volume
};