// A collection of reusable control elements tied to state store

import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, Range, Slider, ToolTip} from "elv-components-js";
import {FrameRates} from "../../utils/FrameAccurateVideo";
import Fraction from "fraction.js/fraction";

import ClipStartIcon from "../../static/icons/marker-in.svg";
import ClipEndIcon from "../../static/icons/marker-out.svg";
import ClipIcon from "../../static/icons/scissors.svg";
import SaveImageIcon from "../../static/icons/picture.svg";
import PauseButton from "../../static/icons/Pause.svg";
import PlayButton from "../../static/icons/Play.svg";
import MaximizeIcon from "../../static/icons/Maximize.svg";
import MinimizeIcon from "../../static/icons/Minimize.svg";
import VolumeOff from "../../static/icons/VolumeOff.svg";
import VolumeLow from "../../static/icons/VolumeLow.svg";
import VolumeHigh from "../../static/icons/VolumeHigh.svg";
import DownloadIcon from "../../static/icons/download.svg";

import {StopScroll} from "../../utils/Utils";
import {videoStore} from "../../stores";

const Store = props => props.clip ? props.clipVideoStore : props.videoStore;

let SaveFrame = (props) => {
  const store = Store(props);

  return (
    <ToolTip content={<span>Save Current Frame</span>}>
      <IconButton
        aria-label="Save Current Frame"
        icon={SaveImageIcon}
        className={"video-control-button video-control-save-frame"}
        onClick={store.SaveFrame}
      />
    </ToolTip>
  );
};

let SaveVideo = observer(() => {
  return (
    <ToolTip content={<span>Download Current Clip</span>}>
      <IconButton
        aria-label="Save Video Clip"
        icon={DownloadIcon}
        className={"video-control-button video-control-save-frame"}
        onClick={() => videoStore.ToggleDownloadModal(true)}
      />
    </ToolTip>
  );
});

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

let AudioTrackSelect = (props) => {
  const store = Store(props);

  if((store.audioTracks || []).length < 2) {
    return null;
  }

  return (
    <ToolTip content={<span>Audio Track</span>}>
      <select
        aria-label="Audio Track"
        value={store.audioTrack}
        className={"video-playback-level"}
        onChange={event => store.SetAudioTrack(event.target.value)}
      >
        {Object.keys(store.audioTracks).map(trackIndex => {
          const track = store.audioTracks[trackIndex];

          return (
            <option key={`playback-level-${trackIndex}`} value={trackIndex}>
              { track.name || track.lang  }
            </option>
          );
        })}
      </select>
    </ToolTip>
  );
};

let Offering = (props) => {
  const store = props.videoStore;
  let offerings = Object.keys(store.availableOfferings)
    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}))
    .map(offeringKey =>
      [offeringKey, store.availableOfferings[offeringKey].display_name || offeringKey, store.availableOfferings[offeringKey].disabled || false]
    );

  return (
    <ToolTip content={<span>Offering</span>}>
      <select
        aria-label="Offering"
        value={store.offeringKey}
        className={"offering-selection"}
        onChange={event => store.SetOffering(event.target.value)}
      >
        {offerings.map(([offeringKey, label, disabled]) =>
          <option key={`offering-${offeringKey}`} value={offeringKey} disabled={disabled}>
            { label === "default" ? "Default Offering" : label }
          </option>
        )}
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
        className="video-control-button video-control-play-pause"
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
        className="video-control-button"
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
          className="video-control-button video-volume-icon"
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
        className="video-control-button"
        label={props.label}
        icon={props.icon}
        onClick={() => {
          store.SeekFrames({frames: props.frames, seconds: props.seconds});
        }}
      />
    </ToolTip>
  );
};

// Make this a class so we can keep local state to debounce update
// mobx 5 doesn't support functional components + hooks
@inject("videoStore")
@inject("clipVideoStore")
@observer
class Scale extends React.Component {
  render() {
    const store = Store(this.props);

    return (
      <Range
        key="video-scale"
        min={0}
        max={100}
        marks={this.props.sliderMarks || store.sliderMarks}
        markTextEvery={store.majorMarksEvery}
        showMarks
        handles={[
          {
            position: store.scaleMin,
            style: "circle",
            toolTip: "Scale Minimum"
          },
          {
            position: store.seek,
            disabled: true,
            className: "video-seek-handle",
            style: "line"
          },
          {
            position: store.scaleMax,
            style: "circle",
            toolTip: "Scale Maximum"
          }
        ]}
        renderToolTip={value => <span>{store.ProgressToSMPTE(value)}</span>}
        onChange={([scaleMin, seek, scaleMax]) => {
          if(scaleMax - scaleMin < 1) {
            if(scaleMin !== store.scaleMin) {
              // Min changed
              scaleMin = Math.max(0, scaleMax - 1);
              scaleMax = Math.min(100, scaleMin + 1);
            } else {
              // Max changed
              scaleMax = Math.min(100, scaleMin + 1);
              scaleMin = Math.max(0, scaleMin);
            }
          }

          store.DebounceControl({
            name: "scale",
            delay: 25,
            Action: () => {
              store.SetScale(scaleMin, seek, scaleMax);
            }
          });
        }}
        className="video-scale"
      />
    );
  }
}

let ClipSeek = (props) => {
  const store = Store(props);

  let handles = [{
    position: store.seek,
    toolTip: `Playhead - ${store.FrameToSMPTE(store.frame)}`,
    className: "seek-handle",
  }];

  if(!props.clip) {
    handles = [
      {
        position: store.FrameToProgress(store.clipInFrame || 0),
        className: "clip-in-handle",
        toolTip: `Mark In - ${store.FrameToSMPTE(store.clipInFrame)}`,
        handleControlOnly: true
      },
      {
        position: store.seek,
        toolTip: `Playhead - ${store.FrameToSMPTE(store.frame)}`,
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
      key={`video-seek-clip-range-${store.scaleMin}-${store.scaleMax}`}
      min={store.scaleMin}
      max={store.scaleMax}
      showMarks
      topMarks
      marks={props.sliderMarks || store.sliderMarks}
      markTextEvery={store.majorMarksEvery}
      handles={handles}
      renderToolTip={value => <span>{ store.ProgressToSMPTE(value) }</span>}
      onChange={(values) => {
        if(!props.clip) {
          const [inProgress, seek, outProgress] = values;
          store.SetClipMark({inProgress, outProgress});
          store.SeekPercentage(Fraction(seek).div(100));
        } else {
          store.SeekPercentage(values / 100);
        }
      }}
      className={`video-clip-range ${props.clip ? "clip-video-clip-range" : ""}`}
    />
  );
};

let ClipIn = (props) => {
  const store = Store(props);

  return (
    <ToolTip content="Mark In">
      <IconButton
        className="video-control-button video-control-clip"
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
        className="video-control-button video-control-clip"
        icon={ClipEndIcon}
        onClick={() => store.SetClipMark({outFrame: store.frame})}
      />
    </ToolTip>
  );
};

let SaveClip = (props) => {
  return (
    <ToolTip content="Save Clip">
      <IconButton
        className="video-control-button video-control-clip"
        icon={ClipIcon}
        onClick={() => props.clipStore.SaveClip({start: props.videoStore.clipInFrame, end: props.videoStore.clipOutFrame})}
      />
    </ToolTip>
  );
};

const Inject = (Component) =>
  inject("videoStore")(inject("clipVideoStore")(observer(Component)));

ClipSeek = Inject(ClipSeek);
ClipIn = Inject(ClipIn);
ClipOut = Inject(ClipOut);
DropFrame = Inject(DropFrame);
FrameControl = Inject(FrameControl);
FrameRate = Inject(FrameRate);
FullscreenToggle = Inject(FullscreenToggle);
PlaybackLevel = Inject(PlaybackLevel);
AudioTrackSelect = Inject(AudioTrackSelect);
PlaybackRate = Inject(PlaybackRate);
PlayPause = Inject(PlayPause);
SaveFrame = Inject(SaveFrame);
SaveVideo = Inject(SaveVideo);
Offering = Inject(Offering);
Volume = Inject(Volume);

SaveClip = inject("clipStore")(Inject(SaveClip));

export {
  ClipSeek,
  ClipIn,
  ClipOut,
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackLevel,
  AudioTrackSelect,
  PlaybackRate,
  PlayPause,
  SaveClip,
  SaveFrame,
  SaveVideo,
  Scale,
  Offering,
  Volume
};
