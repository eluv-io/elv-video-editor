import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {editStore, groundTruthStore, rootStore, tagStore, trackStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {
  Confirm,
  IconButton,
  SMPTEInput,
  SwitchInput
} from "@/components/common/Common";
import MarkedSlider from "@/components/common/MarkedSlider";

import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";
import {
  FrameBack10Button,
  FrameBack1Button,
  FrameDisplay,
  FrameForward10Button,
  FrameForward1Button,
  PlayCurrentClipButton
} from "@/components/video/VideoControls.jsx";
import KeyboardControls from "@/components/timeline/KeyboardControls.jsx";
import Download from "@/components/download/Download.jsx";
import Share from "@/components/download/Share.jsx";
import Track from "@/components/timeline/Track.jsx";
import {CreateTrackButton} from "@/components/forms/CreateTrack.jsx";
import {
  AggregateTagsButton,
  ClipModalButton,
  LiveToVodButton,
  MyClipsButton
} from "@/components/timeline/Controls.jsx";

import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import AddTagIcon from "@/assets/icons/v2/add-tag.svg";
import AddOverlayIcon from "@/assets/icons/v2/add-overlay.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";
import QuestionMarkIcon from "@/assets/icons/v2/question-mark.svg";
import ZoomOutFullIcon from "@/assets/icons/v2/arrows-horizontal.svg";
import IsolateClipIcon from "@/assets/icons/v2/isolate.svg";
import ReloadIcon from "@/assets/icons/v2/reload.svg";
import CheckmarkIcon from "@/assets/icons/check-circle.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import XIcon from "@/assets/icons/X.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";

const S = CreateModuleClassMatcher(TimelineStyles);


const TimelineTopBar = observer(({simple}) => {
  return (
    <div className={S("toolbar", "timeline-section__top-bar")}>
      <div className={S("toolbar__controls-group", "left")}>
        {
          simple ?
            null :
            <>
              <IconButton
                icon={UndoIcon}
                label={`Undo ${editStore.nextUndoAction?.label || ""}`}
                disabled={!editStore.nextUndoAction}
                onClick={() => editStore.Undo()}
              />
              <IconButton
                icon={RedoIcon}
                label={`Redo ${editStore.nextRedoAction?.label || ""}`}
                disabled={!editStore.nextRedoAction}
                onClick={() => editStore.Redo()}
              />
              <div className={S("toolbar__separator")}/>
              <div className={S("tag-tools")}>
                <div className={S("tag-tools__label")}>
                  Tag Tools
                </div>
                <CreateTrackButton/>
                <IconButton
                  icon={AddTagIcon}
                  disabled={trackStore.viewTracks.length === 0}
                  label={`Add New ${rootStore.page === "tags" ? "Tag" : "Clip"}`}
                  onClick={() =>
                    tagStore.AddTag({
                      trackId: tagStore.selectedTrackId,
                      text: "<New Tag>",
                      tagType: rootStore.page === "clips" ? "clip" : "metadata"
                    })
                  }
                />
                <IconButton
                  icon={AddOverlayIcon}
                  disabled={trackStore.viewTracks.length === 0}
                  label="Add New Overlay Tag"
                  onClick={() => {
                    tagStore.ClearEditing(false);
                    tagStore.ClearSelectedTag();
                    tagStore.ClearSelectedOverlayTags();
                    tagStore.AddOverlayTag({
                      trackId: tagStore.selectedTrackId,
                      text: "<New Tag>"
                    });
                  }}
                />
                {
                  Object.keys(groundTruthStore.pools).length === 0 ? null :
                    <IconButton
                      icon={GroundTruthIcon}
                      label="Add New Ground Truth Asset"
                      onClick={() => tagStore.AddGroundTruthAsset()}
                    />
                }
              </div>
              <div className={S("toolbar__separator")}/>
            </>
        }
        <div className={S("jump-to")}>
          <label>Jump to</label>
          <SMPTEInput
            label="Jump to"
            aria-label="Jump to"
            value={videoStore.smpte}
            onChange={({frame}) => {
              videoStore.Seek(frame);
              videoStore.SetScale(0, 100);
            }}
          />
        </div>
      </div>
      <div className={S("toolbar__controls-group", "center", "frame-controls")}>
        <FrameBack10Button store={videoStore} />
        <FrameBack1Button store={videoStore} />
        <FrameDisplay store={videoStore} />
        <FrameForward1Button store={videoStore} />
        <FrameForward10Button store={videoStore} />
      </div>
      <div className={S("toolbar__controls-group", "right")}>
        <IconButton
          highlight
          icon={ClipInIcon}
          label="Set Clip In to Current Frame"
          onClick={() => videoStore.SetClipMark({inFrame: videoStore.frame})}
        />
        <SMPTEInput
          highlight
          label="Clip Start"
          value={videoStore.FrameToSMPTE(videoStore.clipInFrame) || "00:00:00:00"}
          onChange={({frame}) => videoStore.SetClipMark({inFrame: frame})}
        />
        <PlayCurrentClipButton store={videoStore}/>
        <SMPTEInput
          highlight
          label="Clip End"
          value={videoStore.FrameToSMPTE(videoStore.clipOutFrame) || "00:00:00:00"}
          onChange={({frame}) => videoStore.SetClipMark({outFrame: frame})}
        />
        <IconButton
          highlight
          icon={ClipOutIcon}
          label="Set Clip Out to Current Frame"
          onClick={() => videoStore.SetClipMark({outFrame: videoStore.frame})}
        />
        {
          !simple ? null :
            <ClipModalButton/>
        }
        {
          !videoStore.isLiveToVod ? null :
            <>
              <div className={S("toolbar__separator")}/>
              <LiveToVodButton/>
            </>
        }
        <div className={S("toolbar__separator")}/>
        <IconButton
          icon={ReloadIcon}
          label="Reload"
          onClick={async () => Confirm({
            title: "Reload Content",
            text: "Are you sure you want to reload this content? Any changes you have made will be lost.",
            onConfirm: async () => await videoStore.Reload()
          })}
        />
        <div className={S("toolbar__separator")}/>
        {
          simple ? null :
            <AggregateTagsButton />
        }
        <Download store={videoStore} />
        <Share store={videoStore}/>

      </div>
    </div>
  );
});

const TimelineBottomBar = observer(({simple}) => {
  return (
    <div className={S("toolbar", "timeline-section__bottom-bar")}>
      <KeyboardControls />
      <div className={S("toolbar__separator")}/>
      {
        simple ? null :
          <SwitchInput
            label="Show Thumbnails"
            checked={trackStore.showThumbnails}
            onChange={event => trackStore.ToggleTrackType({type: "Thumbnails", visible: event.currentTarget.checked})}
          />
      }
      {
        simple ? null :
          rootStore.page === "tags" ?
            //Tags
            <>
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
            </> :
            // Clips
            <SwitchInput
              label="Show Primary Content"
              checked={trackStore.showPrimaryContent}
              onChange={event => trackStore.ToggleTrackType({type: "PrimaryContent", visible: event.currentTarget.checked})}
            />
      }
      <div className={S("toolbar__spacer")}/>
      {
        !tagStore.isolatedTag ? null :
          <IconButton
            highlight
            icon={IsolateClipIcon}
            onClick={() => tagStore.ClearIsolatedTag()}
            label="Clear Isolated Tag"
            tooltipProps={{
              withinPortal: false
            }}
          />
      }
      <IconButton
        disabled={videoStore.scaleMagnitude === 100}
        highlight={videoStore.scaleMagnitude !== 100}
        icon={ZoomOutFullIcon}
        onClick={() => {
          videoStore.SetScale(0, 100);
          tagStore.ClearIsolatedTag();
        }}
        label="Reset Timeline Scale"
      />
      {
        !simple ? null :
          <>
            <div className={S("toolbar__separator")}/>
            <MyClipsButton/>
          </>
      }

    </div>
  );
});

const TimelineSeekBar = observer(({hoverSeek}) => {
  if(!videoStore?.initialized) { return null; }

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
        handles={[{ position: videoStore.seek, style: "arrow" }]}
        indicators={indicators}
        showMarks
        topMarks
        nMarks={videoStore.sliderMarks}
        majorMarksEvery={videoStore.majorMarksEvery}
        RenderText={progress => videoStore.ProgressToSMPTE(progress)}
        onChange={progress => {
          videoStore.Seek(videoStore.ProgressToFrame(progress));
          tagStore.SetScrollSeekTime(videoStore.ProgressToTime(progress));
        }}
        className={S("seek-bar")}
      />
     </div>
  );
});

const TimelineScaleBar = observer(({hoverSeek}) => {
  if(!videoStore?.initialized) { return null; }

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
           { position: videoStore.scaleMin, style: "arrow-bottom" },
           { position: videoStore.scaleMax, style: "arrow-bottom" }
         ]}
         handleSeparator={100 * videoStore.currentTime / (videoStore.duration || 1)}
         indicators={[
           { position: videoStore.seek },
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

  if(typeof position !== "number" || isNaN(position) || position < 0 || !timelineRef?.current) { return null; }

  return (
    <div
      style={{left: position + dimensions.diff - 1, height: timelineRef.current.getBoundingClientRect().height}}
      className={JoinClassNames(S("playhead-indicator"), className)}
    />
  );
});

let thumbnailInterval;
const TimelineThumbnailTrack = observer(() => {
  const available = videoStore?.thumbnailStore.thumbnailStatus.available;
  const regenerating = videoStore?.thumbnailStore?.generating;
  const state = videoStore?.thumbnailStore.thumbnailStatus.status?.state;

  useEffect(() => {
    clearInterval(thumbnailInterval);

    if(available && regenerating && (!state || ["running", "started"].includes(state))) {
      thumbnailInterval = setInterval(
        () => videoStore.thumbnailStore.ThumbnailGenerationStatus(),
        5000
      );
    }

    return () => clearInterval(thumbnailInterval);
  }, [state, regenerating, videoStore.initialized]);

  if(!videoStore?.initialized || !trackStore?.showThumbnails) {
    return null;
  }

  let button;
  if(available && regenerating && state === "finished") {
    button = (
      <IconButton
        icon={CheckmarkIcon}
        small
        highlight
        withinPortal
        label="Finalize Thumbnails"
        className={S("timeline-row__icon")}
        onClick={async event => {
          event.preventDefault();
          event.stopPropagation();

          await Confirm({
            title: "Finalize Thumbnails",
            text: "Are you sure you want to finalize thumbnails for this content?",
            onConfirm: async () => {
              await videoStore.thumbnailStore.ThumbnailGenerationStatus({finalize: true});

              videoStore.Reload();
            }
          });
        }}
      />
    );
  } else if(available) {
    button = (
      <IconButton
        icon={ReloadIcon}
        small
        faded
        withinPortal
        loadingProgress={
          !regenerating ? null :
            videoStore.thumbnailStore.thumbnailStatus.status?.progress || 1
        }
        label="Regenerate Thumbnails"
        className={S("timeline-row__icon")}
        onClick={async event => {
          event.preventDefault();
          event.stopPropagation();

          await Confirm({
            title: "Regenerate Thumbnails",
            text: "Are you sure you want to regenerate thumbnails for this content?",
            onConfirm: async () => {
              await videoStore.thumbnailStore.GenerateVideoThumbnails();
            }
          });
        }}
      />
    );
  }

  return (
    <div className={S("timeline-row", "timeline-row--thumbnails")}>
      <div className={S("timeline-row__label")}>
        Thumbnails
        {button}
      </div>
      <div className={S("timeline-row__content")}>
        <ThumbnailTrack
          store={videoStore}
          allowCreation
          onClick={progress => videoStore.SeekPercentage(progress)}
          className={S("track-container")}
        />
      </div>
    </div>
  );
});

const TrackLabel = observer(({track}) => {
  const toggleable = ["metadata", "clip"].includes(track.trackType);
  return (
    <div
      role={toggleable ? "button" : "label"}
      onClick={
        !toggleable ? undefined :
          () => {
            const activeTracks = rootStore.page === "clips" ?
              trackStore.activeClipTracks :
              trackStore.activeTracks;

            const trackSelected = Object.keys(activeTracks).length === 1 && activeTracks[track.key];
            if(rootStore.page === "clips") {
              trackStore.ResetActiveClipTracks();

              if(!trackSelected) {
                trackStore.ToggleClipTrackSelected(track.key, true);
              }
            } else {
              trackStore.ResetActiveTracks();

              if(!trackSelected) {
                trackStore.ToggleTrackSelected(track.key, true);
              }
            }
          }
      }
      className={S("timeline-row__label", toggleable ? "timeline-row__label--button" : "")}
    >
      {track.label}
      {
        !toggleable ? null :
          <IconButton
            icon={
              tagStore.selectedTrackId === track.trackId ?
                XIcon : EditIcon
            }
            label={
              tagStore.selectedTrackId === track.trackId ?
                "Hide Category Details" :
                "View Category Details"
            }
            onClick={event => {
              event.stopPropagation();
              tagStore.selectedTrackId === track.trackId ?
                tagStore.ClearSelectedTrack() :
                tagStore.SetSelectedTrack(track.trackId);
            }}
            className={
              S(
                "timeline-row__icon",
                "timeline-row__label-edit",
                tagStore.selectedTrackId === track.trackId ? "timeline-row__label-edit--active" : ""
              )
            }
          />
      }
      {
        track.trackType !== "primary-content" ? null :
          <IconButton
            withinPortal
            icon={QuestionMarkIcon}
            label="Modifying the primary content tag allows you to specify the start and end times for this offering"
            className={S("timeline-row__icon")}
          />
      }
    </div>
  );
});

const TagTimelineContent = observer(() => {
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

  if(rootStore.errorMessage) {
    return (
      <div className={S("content-block", "timeline-section")}>
        <div className={S("error-message")}>
          {rootStore.errorMessage}
        </div>
      </div>
    );
  }

  return (
    <>
      <TimelineThumbnailTrack/>
      {
        tracks.map((track, i) =>
          <div
            key={`track-${track.trackId || i}`}
            style={
              track.trackType !== "metadata" ||
              trackStore.IsTrackVisible(track.trackId) ?
                {} :
                {display: "none"}
            }
            className={S("timeline-row", track.trackId === tagStore.selectedTrackId ? "timeline-row--selected" : "")}
          >
            <TrackLabel track={track} />
            <div className={S("timeline-row__content")}>
              <Track track={track}/>
            </div>
          </div>
        )
      }
    </>
  );
});

const ClipTimelineContent = observer(() => {
  let tracks = [...trackStore.clipTracks];
  if(trackStore.showPrimaryContent) {
    tracks.unshift(trackStore.tracks.find(track => track.trackType === "primary-content"));
  }

  return (
    <>
      <TimelineThumbnailTrack/>
      {
        tracks
          .filter(t => t)
          .map((track, i) =>
            <div
              key={`track-${track.trackId || i}`}
              style={
                track.trackType === "primary-content" ||
                !trackStore.clipTracksSelected ||
                trackStore.activeClipTracks[track.key] ?
                  {} :
                  {display: "none"}
              }
              className={S("timeline-row", track.trackId === tagStore.selectedTrackId ? "timeline-row--selected" : "")}
            >
              <TrackLabel track={track} />
              <div className={S("timeline-row__content")}>
                <Track track={track} noActive={track.trackType === "primary-content"} />
              </div>
            </div>
          )
      }
    </>
  );
});

const Timeline = observer(({content, simple=false}) => {
  const [hoverPosition, setHoverPosition] = useState(undefined);
  const timelineRef = useRef(null);

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
    <div className={S("content-block", "timeline-section", simple ? "timeline-section--simple" : "")}>
      <TimelineTopBar simple={simple} />
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

          // On shift+scroll, move current scale window along timeline. Movement based on current scale magnitude
          if(event.shiftKey) {
            const movement = Math.min(5, videoStore.scaleMagnitude * 0.1) * (event.deltaX < 0 ? -1 : 1);
            videoStore.SetScale(videoStore.scaleMin + movement, videoStore.scaleMax + movement, true);
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
        { content }
        <TimelineScaleBar hoverSeek={hoverSeek} />
      </div>

      <TimelineBottomBar simple={simple} />
    </div>
  );
});

export const TagTimeline = observer(() => {
  return <Timeline content={<TagTimelineContent />} />;
});

export const ClipTimeline = observer(() => {
  return <Timeline content={<ClipTimelineContent />} />;
});

export const SimpleTimeline = observer(() => {
  return <Timeline simple content={<TimelineThumbnailTrack />} />;
});
