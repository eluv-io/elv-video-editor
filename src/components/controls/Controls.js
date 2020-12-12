// A collection of reusable control elements tied to state store

import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, Range, Slider, ToolTip} from "elv-components-js";
import {FrameRates} from "../../utils/FrameAccurateVideo";
import Fraction from "fraction.js/fraction";

import ClipStartIcon from "../../static/icons/chevron-left.svg";
import ClipEndIcon from "../../static/icons/chevron-right.svg";
import SaveImageIcon from "../../static/icons/Image.svg";
import PauseButton from "../../static/icons/Pause.svg";
import PlayButton from "../../static/icons/Play.svg";
import MaximizeIcon from "../../static/icons/Maximize.svg";
import MinimizeIcon from "../../static/icons/Minimize.svg";
import VolumeOff from "../../static/icons/VolumeOff.svg";
import VolumeLow from "../../static/icons/VolumeLow.svg";
import VolumeHigh from "../../static/icons/VolumeHigh.svg";

import {StopScroll} from "../../utils/Utils";

const Store = props => props.clip ? props.clipVideoStore : props.videoStore;

let SaveFrame = (props) => {
  const store = Store(props);

  return (
    <ToolTip content={<span>Save Current Frame</span>}>
      <IconButton
        aria-label="Save Current Frame"
        icon={SaveImageIcon}
        className={"video-control-save-frame"}
        onClick={store.SaveFrame}
      />
    </ToolTip>
  );
};

let PlaybackLevel = (props) => {
  const store = Store(props);

  return (
    <ToolTip content={<span>Playback Level</span>}>
      <select
        aria-label="Playback Level"
        value={store.currentLevel}
        className={"video-playback-level"}
        onChange={event => store.SetPlaybackLevel(event.target.value)}
      >
        {Object.keys(store.levels).map(levelIndex => {
          const level = store.levels[levelIndex];

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
  const store = Store(props);

  // 0.1 intervals from 0.1x to 4x
  const rates = [...Array(40)].map((_, i) => Fraction(i + 1).div(10));

  return (
    <ToolTip content={<span>Playback Rate</span>}>
      <select
        aria-label="Playback Rate"
        className="video-playback-rate"
        value={Fraction(store.playbackRate)}
        onChange={event => store.SetPlaybackRate(event.target.value)}
      >
        {rates.map(rate =>
          <option key={`video-rate-${rate}`} value={rate}>{`${rate}x`}</option>
        )}
      </select>
    </ToolTip>
  );
};

let FrameRate = (props) => {
  const store = Store(props);

  return (
    <ToolTip content={<span>Frame Rate: {store.frameRateRat}</span>}>
      <select
        disabled={store.frameRateSpecified}
        aria-label="Frame Rate"
        value={store.frameRateKey}
        onChange={event => store.SetFrameRate({rateKey: event.target.value})}
      >
        {Object.keys(FrameRates).map(frameRateKey =>
          <option key={`frame-rate-${frameRateKey}`} value={frameRateKey}>{frameRateKey}</option>
        )}
      </select>
    </ToolTip>
  );
};

let DropFrame = (props) => {
  const store = Store(props);

  if(!["NTSC", "NTSCFilm", "NTSCHD"].includes(store.frameRateKey)) {
    return null;
  }

  return (
    <ToolTip content={<span>Drop Frame Notation</span>}>
      <select
        aria-label="Drop Frame Notation"
        value={store.dropFrame}
        onChange={event => store.SetDropFrame(event.target.value === "true")}
      >
        <option value={false}>NDF</option>
        <option value={true}>DF</option>
      </select>
    </ToolTip>
  );
};

let PlayPause = (props) => {
  const store = Store(props);

  const label = store.playing ? "Pause" : "Play";

  return (
    <ToolTip content={label}>
      <IconButton
        className="video-control-play-pause"
        label={label}
        icon={store.playing ? PauseButton : PlayButton}
        onClick={store.PlayPause}
      />
    </ToolTip>
  );
};

let FullscreenToggle = (props) => {
  const store = Store(props);

  const label = store.fullScreen ? "Exit Full Screen" : "Full Screen";

  return (
    <ToolTip content={<span>{label}</span>}>
      <IconButton
        label={label}
        icon={store.fullScreen ? MinimizeIcon : MaximizeIcon}
        onClick={store.ToggleFullscreen}
      />
    </ToolTip>
  );
};

let Volume = (props) => {
  const store = Store(props);

  const icon = (store.muted || store.volume === 0) ? VolumeOff :
    store.volume < (100 / 2) ? VolumeLow : VolumeHigh;

  return (
    <div
      ref={StopScroll()}
      onWheel={({deltaY}) => store.ScrollVolume(deltaY)}
      className="video-volume-controls"
    >
      <ToolTip content={<span>{store.muted ? "Unmute" : "Mute"}</span>}>
        <IconButton
          icon={icon}
          onClick={() => store.SetMuted(!store.muted)}
          className="video-volume-icon"
        />
      </ToolTip>
      <Slider
        min={0}
        max={100}
        value={store.muted ? 0 : store.volume}
        renderToolTip={value => `${Math.floor((value / 100) * 100)}%`}
        className="video-volume-slider"
        onChange={volume => store.SetVolume(volume)}
      />
    </div>
  );
};

let FrameControl = (props) => {
  const store = Store(props);

  return (
    <ToolTip content={props.label}>
      <IconButton
        label={props.label}
        icon={props.icon}
        onClick={() => {
          store.SeekFrames({frames: props.frames, seconds: props.seconds});
        }}
      />
    </ToolTip>
  );
};

let Seek = (props) => {
  const store = Store(props);

  return (
    <Slider
      key="video-progress"
      min={store.scaleMin}
      max={store.scaleMax}
      value={store.seek}
      handleClassName="video-seek-handle"
      renderToolTip={value => <span>{store.ProgressToSMPTE(value)}</span>}
      onChange={(value) => store.SeekPercentage(Fraction(value).div(100))}
      className="video-seek"
    />
  );
};

let Scale = (props) => {
  const store = Store(props);

  return (
    <Range
      key="video-scale"
      min={0}
      max={100}
      handleControlOnly
      marks={props.sliderMarks || store.sliderMarks}
      markTextEvery={store.majorMarksEvery}
      showMarks
      handles={[
        {
          position: store.scaleMin,
          style: "circle"
        },
        {
          position: store.seek,
          disabled: true,
          className: "video-seek-handle",
          style: "line"
        },
        {
          position: store.scaleMax,
          style: "circle"
        }
      ]}
      renderToolTip={value => <span>{store.ProgressToSMPTE(value)}</span>}
      onChange={([scaleMin, seek, scaleMax]) => store.SetScale(scaleMin, seek, scaleMax)}
      className="video-scale"
    />
  );
};

let Clip = (props) => {
  const store = Store(props);

  let handles = [];
  if(typeof store.clipInFrame !== "undefined" || store.clipOutFrame) {
    handles = [
      {
        position: store.FrameToProgress(store.clipInFrame || 0),
        className: "clip-in-handle",
        toolTip: `Mark In - ${store.FrameToSMPTE(store.clipInFrame)}`,
        handleControlOnly: true
      },
      {
        position: store.seek,
        toolTip: `Seek - ${store.FrameToSMPTE(store.frame)}`,
        className: "seek-handle",
      },
      {
        position: store.FrameToProgress(store.clipOutFrame),
        className: "clip-out-handle",
        toolTip: `Mark Out - ${store.FrameToSMPTE(store.clipOutFrame)}`,
        handleControlOnly: true
      }
    ];
  }

  return (
    <Range
      key={`video-clip-range-${store.scaleMin}-${store.scaleMax}`}
      min={store.scaleMin}
      max={store.scaleMax}
      showMarks
      topMarks
      marks={props.sliderMarks || store.sliderMarks}
      markTextEvery={store.majorMarksEvery}
      handles={handles}
      renderToolTip={value => <span>{ store.ProgressToSMPTE(value) }</span>}
      onChange={([clipIn, seek, clipOut]) => {
        store.SetClipMark({inProgress: clipIn, outProgress: clipOut});
        store.SeekPercentage(Fraction(seek).div(100));
      }}
      className="video-clip-range"
    />
  );
};

let ClipIn = (props) => {
  const store = Store(props);

  return (
    <ToolTip content="Mark In">
      <IconButton
        className="video-control-clip"
        icon={ClipStartIcon}
        onClick={() => store.SetClipMark({inFrame: store.frame})}
      />
    </ToolTip>
  );
};

let ClipOut = (props) => {
  const store = Store(props);

  return (
    <ToolTip content="Mark Out">
      <IconButton
        className="video-control-clip"
        icon={ClipEndIcon}
        onClick={() => store.SetClipMark({outFrame: store.frame})}
      />
    </ToolTip>
  );
};

Clip = inject("videoStore")(inject("clipVideoStore")(observer(Clip)));
ClipIn = inject("videoStore")(inject("clipVideoStore")(observer(ClipIn)));
ClipOut = inject("videoStore")(inject("clipVideoStore")(observer(ClipOut)));
DropFrame = inject("videoStore")(inject("clipVideoStore")(observer(DropFrame)));
FrameControl = inject("videoStore")(inject("clipVideoStore")(observer(FrameControl)));
FrameRate = inject("videoStore")(inject("clipVideoStore")(observer(FrameRate)));
FullscreenToggle = inject("videoStore")(inject("clipVideoStore")(observer(FullscreenToggle)));
PlaybackLevel = inject("videoStore")(inject("clipVideoStore")(observer(PlaybackLevel)));
PlaybackRate = inject("videoStore")(inject("clipVideoStore")(observer(PlaybackRate)));
PlayPause = inject("videoStore")(inject("clipVideoStore")(observer(PlayPause)));
SaveFrame = inject("videoStore")(inject("clipVideoStore")(observer(SaveFrame)));
Scale = inject("videoStore")(inject("clipVideoStore")(observer(Scale)));
Seek = inject("videoStore")(inject("clipVideoStore")(observer(Seek)));
Volume = inject("videoStore")(inject("clipVideoStore")(observer(Volume)));

export {
  Clip,
  ClipIn,
  ClipOut,
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackLevel,
  PlaybackRate,
  PlayPause,
  SaveFrame,
  Scale,
  Seek,
  Volume
};
