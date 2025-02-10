import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {rootStore, trackStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {IconButton, SMPTEInput, SwitchInput} from "@/components/common/Common";
import MarkedSlider from "@/components/common/MarkedSlider";

import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import AddUserIcon from "@/assets/icons/v2/add-user.svg";

import AddNewItemIcon from "@/assets/icons/v2/add-new-item.svg";
import SplitIcon from "@/assets/icons/v2/split.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";

import UploadIcon from "@/assets/icons/v2/upload.svg";
import SaveIcon from "@/assets/icons/v2/save.svg";
import Track from "@/components/timeline/Track.jsx";
import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";
import {
  FrameBack10Button,
  FrameBack1Button,
  FrameDisplay,
  FrameForward10Button,
  FrameForward1Button,
  PlaySelectedTagButton
} from "@/components/video/VideoControls.jsx";
import KeyboardControls from "@/components/timeline/KeyboardControls.jsx";
import Download from "@/components/download/Download.jsx";

const S = CreateModuleClassMatcher(TimelineStyles);

const TimelineTopBar = observer(() => {
  return (
    <div className={S("toolbar", "timeline-section__top-bar")}>
      <div className={S("toolbar__controls-group", "left")}>
        <IconButton icon={UndoIcon} label="Undo" onClick={() => {}} />
        <IconButton icon={RedoIcon} label="Redo" onClick={() => {}} />
        <div className={S("toolbar__separator")} />
        <IconButton icon={AddUserIcon} label="Add User" onClick={() => {}} />
        <Download />
        <div className={S("toolbar__separator")} />
        <div className={S("jump-to")}>
          <label>Jump to</label>
          <SMPTEInput
            label="Jump to"
            aria-label="Jump to"
            value={videoStore.smpte}
            onChange={({frame}) => videoStore.Seek(frame)}
          />
        </div>
      </div>
      <div className={S("toolbar__controls-group", "center", "frame-controls")}>
        <FrameBack10Button />
        <FrameBack1Button />
        <FrameDisplay />
        <FrameForward1Button />
        <FrameForward10Button />
      </div>
      <div className={S("toolbar__controls-group", "right")}>
        <PlaySelectedTagButton />
        <IconButton icon={AddNewItemIcon} label="Add New Item" onClick={() => {}} />
        <IconButton icon={SplitIcon} label="Split" onClick={() => {}} />
        <div className={S("toolbar__separator")} />
        <IconButton icon={ClipInIcon} label="Set Clip In to Current Frame" onClick={() => videoStore.SetClipMark({inFrame: videoStore.frame})} />
        <SMPTEInput
          label="Clip Start"
          value={videoStore.FrameToSMPTE(videoStore.clipInFrame) || "00:00:00:00"}
          onChange={({frame}) => videoStore.SetClipMark({inFrame: frame})}
        />
        <IconButton icon={ClipOutIcon} label="Set Clip Out to Current Frame" onClick={() => videoStore.SetClipMark({outFrame: videoStore.frame})} />
        <SMPTEInput
          label="Clip End"
          value={videoStore.FrameToSMPTE(videoStore.clipOutFrame) || "00:00:00:00"}
          onChange={({frame}) => videoStore.SetClipMark({outFrame: frame})}
        />
      </div>
    </div>
  );
});

const TimelineBottomBar = observer(() => {
  return (
    <div className={S("toolbar", "timeline-section__bottom-bar")}>
      <IconButton icon={UploadIcon} label="Upload" onClick={() => {}}/>
      <IconButton icon={SaveIcon} label="Save Changes" onClick={() => {}}/>
      <KeyboardControls />
      <div className={S("toolbar__separator")}/>
      <SwitchInput
        label="Show Thumbnails"
        checked={trackStore.showThumbnails}
        onChange={event => trackStore.ToggleTrackType({type: "Thumbnails", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Tags"
        checked={trackStore.showTags}
        onChange={event => trackStore.ToggleTrackType({type: "Tags", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Bounding Boxes"
        checked={trackStore.showOverlay}
        onChange={event => trackStore.ToggleTrackType({type: "Overlay", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Subtitles"
        checked={trackStore.showSubtitles}
        onChange={event => trackStore.ToggleTrackType({type: "Subtitles", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Segments"
        checked={trackStore.showSegments}
        onChange={event => trackStore.ToggleTrackType({type: "Segments", visible: event.currentTarget.checked})}
      />
      <SwitchInput
        label="Show Audio"
        checked={trackStore.showAudio}
        onChange={event => trackStore.ToggleTrackType({type: "Audio", visible: event.currentTarget.checked})}
      />
      <div className={S("toolbar__spacer")}/>
    </div>
  );
});

const TimelineSeekBar = observer(({hoverSeek}) => {
  if(!videoStore.initialized) { return null; }

  let indicators = [];
  if(videoStore.clipInFrame) {
    indicators.push({
      position: 100 * videoStore.clipInFrame / (videoStore.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(videoStore.clipOutFrame < videoStore.totalFrames - 1) {
    indicators.push({
      position: 100 * videoStore.clipOutFrame / (videoStore.totalFrames || 1),
      style: "end",
      connectEnd: true
    });
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
    indicators.push({
      position: 100 * videoStore.clipInFrame / (videoStore.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(videoStore.clipOutFrame < videoStore.totalFrames - 1) {
    indicators.push({
      position: 100 * videoStore.clipOutFrame / (videoStore.totalFrames || 1),
      style: "end",
      connectEnd: true
    });
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
      // Seek bar should always be present, use its width
      const seekBarRow = timelineRef?.current?.children[0];
      let seekBarDimensions = seekBarRow?.children[1]?.getBoundingClientRect() || {};

      // Left position is relative to entire width - determine width of label + gap to add in
      seekBarDimensions.diff = seekBarDimensions.left - seekBarRow?.getBoundingClientRect()?.left;
      setDimensions(seekBarDimensions);
    });

    resizeObserver.observe(timelineRef.current);

    return () => resizeObserver.disconnect();
  }, [timelineRef]);

  const seekPercent = (value - videoStore.scaleMin) / videoStore.scaleMagnitude;
  const position = dimensions.width * seekPercent;

  if(typeof position !== "number" || position < 0 || !timelineRef?.current) { return null; }

  return (
    <div
      style={{left: position + dimensions.diff - 1, height: timelineRef.current.getBoundingClientRect().height}}
      className={JoinClassNames(S("playhead-indicator"), className)}
    />
  );
});

const TimelineSection = observer(() => {
  const [hoverPosition, setHoverPosition] = useState(undefined);
  const timelineRef = useRef(null);

  let tracks = [];
  if(trackStore.showTags) {
    tracks = trackStore.metadataTracks;
  }

  if(trackStore.showSubtitles) {
    tracks = [
      ...tracks,
      ...(
        trackStore.tracks
          .filter(track => track.trackType === "vtt")
          .sort((a, b) => (a.label > b.label ? 1 : -1))
      )
    ];
  }

  if(trackStore.showSegments) {
    tracks = [
      ...tracks,
      ...(
        trackStore.tracks
          .filter(track => track.trackType === "segments")
          .sort((a, b) => (a.label > b.label ? 1 : -1))
      )
    ];
  }

  if(trackStore.showAudio) {
    tracks = [
      ...tracks,
      ...trackStore.audioTracks
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

  if(rootStore.errorMessage) {
    return (
      <div className={S("content-block", "timeline-section")}>
        <div className={S("error-message")}>
          { rootStore.errorMessage }
        </div>
      </div>
    );
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
          if(!event.ctrlKey && !event.shiftKey) { return; }

          event.preventDefault();

          if(event.shiftKey) {
            videoStore.SetScale(videoStore.scaleMin + event.deltaX * 0.05, videoStore.scaleMax + event.deltaX * 0.05, true);
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
          !videoStore.initialized || !trackStore.thumbnailStatus.loaded || !trackStore.showThumbnails ? null :
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
            <div
              key={`track-${track.trackId || i}`}
              style={
                track.trackType !== "metadata" ||
                !trackStore.tracksSelected ||
                trackStore.selectedTracks[track.key] ?
                  {} :
                  {display: "none"}
              }
              className={S("timeline-row")}
            >
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
