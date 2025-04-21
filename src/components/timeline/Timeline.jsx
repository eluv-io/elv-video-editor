import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, editStore, rootStore, tagStore, trackStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {
  Confirm,
  FormTextArea,
  IconButton,
  Linkish,
  Modal,
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
import {Button} from "@mantine/core";

import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import AddTagIcon from "@/assets/icons/v2/add-tag.svg";
import AddOverlayIcon from "@/assets/icons/v2/add-overlay.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";
import UploadIcon from "@/assets/icons/v2/upload.svg";
import SaveIcon from "@/assets/icons/v2/save.svg";
import QuestionMarkIcon from "@/assets/icons/v2/question-mark.svg";
import ZoomOutFullIcon from "@/assets/icons/v2/arrows-horizontal.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import IsolateClipIcon from "@/assets/icons/v2/isolate.svg";
import ReloadIcon from "@/assets/icons/v2/reload.svg";

const S = CreateModuleClassMatcher(TimelineStyles);

const ClipModalButton = observer(() => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName("");
    setSubmitting(false);
  }, [showModal]);

  const Submit = async () => {
    if(!name) { return; }

    setSubmitting(true);

    compositionStore.AddMyClip({
      clip: {
        name,
        libraryId: videoStore.videoObject.libraryId,
        objectId: videoStore.videoObject.objectId,
        versionHash: videoStore.videoObject.versionHash,
        offering: videoStore.offeringKey,
        clipInFrame: videoStore.clipInFrame || 0,
        clipOutFrame: videoStore.clipOutFrame || videoStore.totalFrames - 1
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    setShowModal(false);
  };

  return (
    <>
      {
        !showModal ? null :
          <Modal
            title={<div className={S("form__title")}>Save to My Clips</div>}
            opened
            centered
            onClose={() => setShowModal(false)}
          >
            <div className={S("form", "clip-form")}>
              <PreviewThumbnail
                store={videoStore}
                startFrame={videoStore.clipInFrame}
                endFrame={videoStore.clipOutFrame}
                className={S("clip-form__preview")}
              />
              <div className={S("form__inputs")}>
                <div className={S("clip-form__title")}>
                  { videoStore.name }
                </div>
                <div className={S("clip-form__details")}>
                  <span>
                    {videoStore.FrameToSMPTE(videoStore.clipInFrame)}
                  </span>
                  <span>-</span>
                  <span>
                    {videoStore.FrameToSMPTE(videoStore.clipOutFrame)}
                  </span>
                  <span>
                    ({videoStore.videoHandler.FrameToString({frame: videoStore.clipOutFrame - videoStore.clipInFrame})})
                  </span>
                </div>
                <FormTextArea
                  autoFocus
                  label="Clip Description"
                  autosize
                  value={name}
                  onChange={event => setName(event.target.value)}
                  onKeyPress={event => {
                    if(event.key === "Enter") {
                      Submit();
                    }
                  }}
                />
                <div className={S("form__actions")}>
                  <Button
                    w={150}
                    color="gray.5"
                    onClick={() => setShowModal(false)}
                    variant="subtle"
                  >
                    Cancel
                  </Button>
                  <Button
                    w={150}
                    loading={submitting}
                    autoContrast
                    color="gray.5"
                    disabled={!name}
                    onClick={Submit}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
      }
      <IconButton
        icon={ClipIcon}
        disabled={!videoStore.clipInFrame && videoStore.clipOutFrame >= videoStore.totalFrames - 1}
        label="Save Clip"
        onClick={() => setShowModal(true)}
      />
    </>
  );
});

const TimelineTopBar = observer(({simple}) => {
  return (
    <div className={S("toolbar", "timeline-section__top-bar")}>
      <div className={S("toolbar__controls-group", "left")}>
        {
          simple ? null :
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
                  onClick={() =>
                    tagStore.AddOverlayTag({
                      trackId: tagStore.selectedTrackId,
                    text: "<New Tag>"
                    })
                  }
                />
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
        <Download/>
        <Share store={videoStore}/>

      </div>
    </div>
  );
});

const TimelineBottomBar = observer(({simple}) => {
  return (
    <div className={S("toolbar", "timeline-section__bottom-bar")}>
      {
        simple ? null :
          <>
            <IconButton icon={UploadIcon} label="Upload" onClick={() => {}}/>
            <IconButton icon={SaveIcon} label="Save Changes" onClick={() => {}}/>
          </>
      }
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
        handles={[{ position: videoStore.seek, style: "arrow" }]}
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

const TimelineThumbnailTrack = observer(() => {
  if(!videoStore.initialized || !trackStore.showThumbnails) {
    return null;
  }

  return (
    <div className={S("timeline-row", "timeline-row--thumbnails")}>
      <div className={S("timeline-row__label")}>
        Thumbnails
        <IconButton
          icon={ReloadIcon}
          small
          faded
          withinPortal
          label="Regenerate Thumbnails"
          className={S("timeline-row__icon")}
          onClick={async event => {
            event.preventDefault();
            event.stopPropagation();

            await Confirm({
              title: "Regenerate Thumbnails",
              text: "Are you sure you want to regenerate thumbnails for this content?",
              onConfirm: async () => {
                localStorage.setItem(`regenerate-thumbnails-${videoStore.videoObject.objectId}`, "true");

                await videoStore.thumbnailStore.GenerateVideoThumbnails();
              }
            });
          }}
        />
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
          { rootStore.errorMessage }
        </div>
      </div>
    );
  }

  return (
    <>
      <TimelineThumbnailTrack />
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
            <Linkish
              onClick={
                track.trackType !== "metadata" ? undefined :
                  () => tagStore.selectedTrackId === track.trackId ?
                    tagStore.ClearSelectedTrack() :
                    tagStore.SetSelectedTrack(track.trackId)
              }
              className={S("timeline-row__label")}
            >
              {track.label}
            </Linkish>
            <div className={S("timeline-row__content")}>
              <Track track={track} />
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
      <TimelineThumbnailTrack />
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
              <Linkish
                onClick={
                  track.trackType === "primary-content" ? undefined :
                    () => tagStore.selectedTrackId === track.trackId ?
                      tagStore.ClearSelectedTrack() :
                      tagStore.SetSelectedTrack(track.trackId)
                }
                className={S("timeline-row__label")}
              >
                {track.label}
                {
                  track.trackType !== "primary-content" ? null :
                    <IconButton
                      withinPortal
                      icon={QuestionMarkIcon}
                      label="Modifying the primary content tag allows you to specify the start and end times for this offering"
                      className={S("timeline-row__icon")}
                    />
                }
              </Linkish>
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
