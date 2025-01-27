import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {tracksStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {IconButton, Input, SwitchInput} from "@/components/common/Common";
import MarkedSlider from "@/components/common/MarkedSlider";

import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import AddUserIcon from "@/assets/icons/v2/add-user.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";

import FrameBack10 from "@/assets/icons/v2/frame-back-10.svg";
import FrameBack1 from "@/assets/icons/v2/frame-back-1.svg";
import FrameForward1 from "@/assets/icons/v2/frame-forward-1.svg";
import FrameForward10 from "@/assets/icons/v2/frame-forward-10.svg";

import PlayClipIcon from "@/assets/icons/v2/play-clip.svg";
import AddNewItemIcon from "@/assets/icons/v2/add-new-item.svg";
import SplitIcon from "@/assets/icons/v2/split.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";

import UploadIcon from "@/assets/icons/v2/upload.svg";
import SaveIcon from "@/assets/icons/v2/save.svg";
import KeyboardIcon from "@/assets/icons/v2/keyboard.svg";
import Track from "@/components/timeline/Track.jsx";
import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";

const S = CreateModuleClassMatcher(TimelineStyles);

const FrameDisplay = observer(() => {
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

const JumpToSMPTE = function({smpteInput, setSMPTEInput}) {
  try {
    const frame = videoStore.SMPTEToFrame(smpteInput);
    setSMPTEInput(videoStore.FrameToSMPTE(frame));
    videoStore.Seek(frame);
  } catch(error) {
    setSMPTEInput(videoStore.smpte);
  }
};

const JumpToDisplay = observer(() => {
  const [smpteInput, setSMPTEInput] = useState(videoStore.smpte);

  useEffect(() => {
    setSMPTEInput(videoStore.smpte);
  }, [videoStore.frame]);

  return (
    <div className={S("jump-to")}>
      <label>Jump to</label>
      <Input
        w={150}
        value={smpteInput}
        disabled={videoStore.playing}
        monospace
        aria-label="Jump to SMPTE"
        onChange={event => setSMPTEInput(event.target.value)}
        onKeyDown={event => event.key === "Enter" && JumpToSMPTE({smpteInput, setSMPTEInput})}
        onBlur={() => JumpToSMPTE({smpteInput, setSMPTEInput})}
      />
    </div>
  );
});

const TimelineTopBar = observer(() => {
  return (
    <div className={S("toolbar", "timeline-section__top-bar")}>
      <div className={S("toolbar__controls-group", "left")}>
        <IconButton icon={UndoIcon} label="Undo" onClick={() => {}} />
        <IconButton icon={RedoIcon} label="Redo" onClick={() => {}} />
        <div className={S("toolbar__separator")} />
        <IconButton icon={AddUserIcon} label="Add User" onClick={() => {}} />
        <IconButton icon={DownloadIcon} label="Save Video at Current Quality" onClick={() => videoStore.SaveVideo()} />
        <div className={S("toolbar__separator")} />
        <JumpToDisplay />
      </div>
      <div className={S("toolbar__controls-group", "center", "frame-controls")}>
        <IconButton icon={FrameBack10} label="Back 10 Frames" onClick={() => videoStore.SeekFrames({frames: -10})} />
        <IconButton icon={FrameBack1} label="Back 1 Frame" onClick={() => videoStore.SeekFrames({frames: -1})} />
        <FrameDisplay />
        <IconButton icon={FrameForward1} label="Forward 1 Frame" onClick={() => videoStore.SeekFrames({frames: 1})} />
        <IconButton icon={FrameForward10} label="Forward 10 Frames" onClick={() => videoStore.SeekFrames({frames: 10})} />
      </div>
      <div className={S("toolbar__controls-group", "right")}>
        <IconButton icon={PlayClipIcon} label="Play Current Selection" className={videoStore.segmentEnd ? S("highlight") : ""} onClick={() => videoStore.PlaySegment(videoStore.clipInFrame, videoStore.clipOutFrame)} />
        <IconButton icon={AddNewItemIcon} label="Add New Item" onClick={() => {}} />
        <IconButton icon={SplitIcon} label="Split" onClick={() => {}} />
        <div className={S("toolbar__separator")} />
        <IconButton icon={ClipInIcon} label="Set Clip In to Current Frame" onClick={() => videoStore.SetClipMark({inFrame: videoStore.frame})} />
        <Input label="Clip Start" monospace value={videoStore.FrameToSMPTE(videoStore.clipInFrame) || "00:00:00:00"} w={150} onChange={() => {}} />
        <IconButton icon={ClipOutIcon} label="Set Clip Out to Current Frame" onClick={() => videoStore.SetClipMark({outFrame: videoStore.frame})} />
        <Input label="Clip End" monospace value={videoStore.FrameToSMPTE(videoStore.clipOutFrame) || "00:00:00:00"} w={150} onChange={() => {}} />
      </div>
    </div>
  );
});

const TimelineBottomBar = observer(() => {
  return (
    <div className={S("toolbar", "timeline-section__bottom-bar")}>
      <IconButton icon={UploadIcon} label="Upload" onClick={() => {}}/>
      <IconButton icon={SaveIcon} label="Save Changes" onClick={() => {}}/>
      <IconButton icon={KeyboardIcon} label="Keyboard Shortcuts" onClick={() => {}}/>
      <div className={S("toolbar__separator")}/>
      <SwitchInput
        label="Show Tags"
        checked={tracksStore.showTags}
        onChange={event => tracksStore.ToggleTrackType({type: "Tags", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Segments"
        checked={tracksStore.showSegments}
        onChange={event => tracksStore.ToggleTrackType({type: "Segments", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Audio"
        checked={tracksStore.showAudio}
        onChange={event => tracksStore.ToggleTrackType({type: "Audio", visible: event.currentTarget.checked})}
      />
      <div className={S("toolbar__spacer")}/>
    </div>
  );
});

const TimelineSeekBar = observer(({hoverSeek}) => {
  if(!videoStore.initialized) { return null; }

  let indicators = [];
  if(videoStore.clipInFrame) {
    indicators.push({position: 100 * videoStore.clipInFrame / (videoStore.totalFrames || 1), style: "start"});
  }

  if(videoStore.clipOutFrame < videoStore.totalFrames - 1) {
    indicators.push({position: 100 * videoStore.clipOutFrame / (videoStore.totalFrames || 1), style: "end"});
  }

  if(hoverSeek) {
    indicators.push({position: hoverSeek, opacity: 0.25});
  }

  return (
     <div className={S("timeline-row", "timeline-row--seek", "seek-bar-container")}>
      <div className={S("timeline-row__label", "seek-bar-container__spacer")} />
      <MarkedSlider
        min={videoStore.scaleMin}
        max={videoStore.scaleMax}
        handles={[{ position: videoStore.seek }]}
        indicators={indicators}
        showMarks
        topMarks
        nMarks={videoStore.sliderMarks}
        majorMarksEvery={videoStore.majorMarksEvery}
        RenderText={progress => videoStore.ProgressToSMPTE(progress)}
        onChange={progress => videoStore.Seek(videoStore.ProgressToFrame(progress))}
        className={S("seek-bar")}
      />
     </div>
  );
});

const TimelineScaleBar = observer(({hoverSeek}) => {
  if(!videoStore.initialized) { return null; }

  let indicators = [];
  if(videoStore.clipInFrame) {
    indicators.push({position: 100 * videoStore.clipInFrame / (videoStore.totalFrames || 1), style: "start"});
  }

  if(videoStore.clipOutFrame < videoStore.totalFrames - 1) {
    indicators.push({position: 100 * videoStore.clipOutFrame / (videoStore.totalFrames || 1), style: "end"});
  }

  if(hoverSeek) {
    indicators.push({position: hoverSeek, opacity: 0.25});
  }

  return (
     <div className={S("timeline-row", "timeline-row--scale", "scale-bar-container")}>
       <div className={S("timeline-row__label", "scale-bar-container__label")}>
         <div>{videoStore.ProgressToSMPTE(videoStore.scaleMin)}</div>
         <div>-</div>
         <div>{videoStore.ProgressToSMPTE(videoStore.scaleMax)}</div>
       </div>
       <MarkedSlider
         min={0}
         max={100}
         showTopMarks={false}
         handles={[
           { position: videoStore.scaleMin },
           { position: videoStore.scaleMax }
         ]}
         handleSeparator={100 * videoStore.currentTime / (videoStore.duration || 1)}
         indicators={[
           { position: 100 * videoStore.currentTime / (videoStore.duration || 1) },
           ...indicators
         ]}
         showMarks
         topMarks
         nMarks={videoStore.sliderMarks}
         majorMarksEvery={videoStore.majorMarksEvery}
         RenderText={progress => videoStore.ProgressToSMPTE(progress)}
         onChange={values => videoStore.SetScale(values[0], values[1])}
         onSlide={diff => videoStore.SetScale(videoStore.scaleMin + diff, videoStore.scaleMax + diff, true)}
         className={S("scale-bar")}
      />
     </div>
  );
});

const TimelinePlayheadIndicator = observer(({value, timelineRef, className=""}) => {
  const [dimensions, setDimensions] = useState({});

  useEffect(() => {
    if(!timelineRef?.current) { return; }

    const resizeObserver = new ResizeObserver(() => {
      const contentBox = document.querySelector(`.${S("timeline-row__content")}`);

      if(!contentBox) { return; }

      // Position is relative to entire timeline
      // Need to determine the difference between content and timeline to determine label + gap width
      const contentDimensions = contentBox.getBoundingClientRect();
      const parentDimensions = contentBox.parentElement.getBoundingClientRect();

      contentDimensions.diff = contentDimensions.left - parentDimensions.left;
      setDimensions(contentDimensions);
    });

    resizeObserver.observe(timelineRef.current);

    return () => resizeObserver.disconnect();
  }, [timelineRef]);

  const seekPercent = (value - videoStore.scaleMin) / videoStore.scaleMagnitude;
  const position = dimensions.width * seekPercent;

  if(!position || position < 0) { return null; }

  return (
    <div
      style={{left: position + dimensions.diff}}
      className={JoinClassNames(S("playhead-indicator"), className)}
    />
  );
});

const TimelineSection = observer(() => {
  const [hoverPosition, setHoverPosition] = useState(undefined);
  const timelineRef = useRef(null);

  let tracks = [];
  if(tracksStore.showTags) {
    tracks = tracksStore.tracks
      .filter(track => track.trackType !== "vtt" && track.trackType !== "clip" && track.trackType !== "segments").slice()
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }

  if(tracksStore.showSegments) {
    tracks = [
      ...tracks,
      ...(
        tracksStore.tracks
          .filter(track => track.trackType === "segments").slice()
          .sort((a, b) => (a.label > b.label ? 1 : -1))
      )
    ];
  }

  if(tracksStore.showAudio) {
    tracks = [
      ...tracks,
      ...tracksStore.audioTracks
    ];
  }

  useEffect(() => {
    if(!timelineRef.current) { return; }

    StopScroll({element: timelineRef.current, control: true, meta: true});
  }, [timelineRef?.current]);

  let hoverSeek;
  if(hoverPosition && timelineRef?.current) {
    // Get position / width of seek bar without label
    const seekDimensions = timelineRef.current.children[0]?.children[1]?.getBoundingClientRect();
    if(seekDimensions) {
      const progress = (hoverPosition - seekDimensions?.left) / seekDimensions?.width;

      if(progress > 0 && progress < 1) {
        hoverSeek = videoStore.scaleMin + videoStore.scaleMagnitude * progress;
      }
    }
  }



  return (
    <div className={S("content-block", "timeline-section")}>
      <TimelineTopBar />
      <TimelinePlayheadIndicator value={videoStore.seek} timelineRef={timelineRef} />
      {
        !hoverSeek ? null :
          <TimelinePlayheadIndicator value={hoverSeek} timelineRef={timelineRef} className={S("playhead-indicator--hover")} />
      }
      <div
        ref={timelineRef}
        onMouseMove={event => setHoverPosition(event.clientX)}
        onMouseLeave={() => setHoverPosition(undefined)}
        onScroll={event => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onWheel={event => {
          // Scroll wheel zoom in/out
          if(!event.ctrlKey && !event.metaKey) { return; }

          event.preventDefault();

          if(event.metaKey) {
            videoStore.SetScale(videoStore.scaleMin + event.deltaX * 0.01, videoStore.scaleMax + event.deltaX * 0.01, true);
            return;
          }

          const contentElement = document.querySelector("." + S("timeline-row__content"));

          if(!contentElement) {
            return;
          }

          const { left, width } = contentElement.getBoundingClientRect();
          const position = (event.clientX - left) / width;

          videoStore.ScrollScale(position, event.deltaY);
        }}
        className={S("timeline-section__content")}
      >
        <TimelineSeekBar hoverSeek={hoverSeek} />
        {
          !tracksStore.thumbnailsLoaded ? null :
            <div className={S("timeline-row")}>
              <div className={S("timeline-row__label")}>
                Thumbnails
              </div>
              <div className={S("timeline-row__content")}>
                <ThumbnailTrack />
              </div>
            </div>
        }
        {
          tracks.map((track, i) =>
            <div key={`track-${track.trackId || i}`} className={S("timeline-row")}>
              <div className={S("timeline-row__label")}>
                {track.label}
              </div>
              <div className={S("timeline-row__content")}>
                <Track track={track} />
              </div>
            </div>
          )
        }
        <TimelineScaleBar hoverSeek={hoverSeek} />
      </div>

      <TimelineBottomBar />
    </div>
  );
});

export default TimelineSection;
