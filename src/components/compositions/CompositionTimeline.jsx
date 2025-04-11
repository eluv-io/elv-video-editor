import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {rootStore, compositionStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames, StopScroll} from "@/utils/Utils.js";
import {AsyncButton, Confirm, Icon, IconButton, SMPTEInput} from "@/components/common/Common";
import MarkedSlider from "@/components/common/MarkedSlider";

import {
  FrameBack10Button,
  FrameBack1Button,
  FrameDisplay,
  FrameForward10Button,
  FrameForward1Button,
  PlayCurrentClipButton
} from "@/components/video/VideoControls.jsx";
import KeyboardControls from "@/components/timeline/KeyboardControls.jsx";
import CompositionTrack from "@/components/compositions/CompositionTrack.jsx";
import {useLocation, useParams} from "wouter";
import CompositionSelection from "@/components/compositions/CompositionSelection.jsx";
import Share from "@/components/download/Share.jsx";

import UndoIcon from "@/assets/icons/v2/undo.svg";
import RedoIcon from "@/assets/icons/v2/redo.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";
import SplitIcon from "@/assets/icons/v2/split.svg";
import LinkIcon from "@/assets/icons/v2/external-link.svg";
import DiscardDraftIcon from "@/assets/icons/v2/discard-draft.svg";
import ReloadIcon from "@/assets/icons/v2/reload.svg";

const S = CreateModuleClassMatcher(TimelineStyles);

const TimelineTopBar = observer(() => {
  return (
    <div className={S("toolbar", "timeline-section__top-bar")}>
      <div className={S("toolbar__controls-group", "left")}>
        <IconButton
          icon={UndoIcon}
          label={`Undo ${compositionStore.nextUndoAction?.label || ""}`}
          disabled={!compositionStore.nextUndoAction}
          onClick={() => compositionStore.Undo()}
        />
        <IconButton
          icon={RedoIcon}
          label={`Redo ${compositionStore.nextRedoAction?.label || ""}`}
          disabled={!compositionStore.nextRedoAction}
          onClick={() => compositionStore.Redo()}
        />
        <div className={S("toolbar__separator")}/>
        <div className={S("jump-to")}>
          <label>Jump to</label>
          <SMPTEInput
            store={compositionStore.videoStore}
            label="Jump to"
            aria-label="Jump to"
            value={compositionStore.videoStore.smpte}
            onChange={({frame}) => compositionStore.videoStore.Seek(frame)}
          />
        </div>
      </div>
      <div className={S("toolbar__controls-group", "center", "frame-controls")}>
        <FrameBack10Button store={compositionStore.videoStore} />
        <FrameBack1Button store={compositionStore.videoStore} />
        <FrameDisplay store={compositionStore.videoStore} />
        <FrameForward1Button store={compositionStore.videoStore} />
        <FrameForward10Button store={compositionStore.videoStore} />
      </div>
      <div className={S("toolbar__controls-group", "right")}>
        <IconButton
          icon={ClipInIcon}
          highlight
          label="Set Clip In to Current Frame"
          onClick={() => compositionStore.videoStore.SetClipMark({inFrame: compositionStore.videoStore.frame})}
        />
        <SMPTEInput
          store={compositionStore.videoStore}
          label="Clip Start"
          highlight
          value={compositionStore.videoStore.FrameToSMPTE(compositionStore.videoStore.clipInFrame) || "00:00:00:00"}
          onChange={({frame}) => compositionStore.videoStore.SetClipMark({inFrame: frame})}
        />
        <PlayCurrentClipButton store={compositionStore.videoStore}/>
        <SMPTEInput
          store={compositionStore.videoStore}
          label="Clip End"
          highlight
          value={compositionStore.videoStore.FrameToSMPTE(compositionStore.videoStore.clipOutFrame) || "00:00:00:00"}
          onChange={({frame}) => compositionStore.videoStore.SetClipMark({outFrame: frame})}
        />
        <IconButton
          icon={ClipOutIcon}
          highlight
          label="Set Clip Out to Current Frame"
          onClick={() => compositionStore.videoStore.SetClipMark({outFrame: compositionStore.videoStore.frame})}
        />
        <div className={S("toolbar__separator")}/>
        <IconButton
          icon={SplitIcon}
          disabled={compositionStore.clipIdList.length === 0 || compositionStore.videoStore.frame === 0}
          onClick={() => compositionStore.SplitClip(compositionStore.videoStore.seek)}
          label="Split Clip at Playhead"
        />
        <div className={S("toolbar__separator")}/>
        <IconButton
          icon={ReloadIcon}
          label="Reload"
          onClick={async () => Confirm({
            title: "Reload Content",
            text: "Are you sure you want to reload this content?",
            onConfirm: async () => await compositionStore.SetCompositionObject({...compositionStore.compositionObject})
          })}
        />
        <div className={S("toolbar__separator")}/>
        <IconButton
          icon={LinkIcon}
          label="View Composition in Fabric Browser"
          disabled={!compositionStore.saved}
          onClick={() => compositionStore.OpenFabricBrowserLink()}
        />
        <Share
          disabled={!compositionStore.saved}
          store={compositionStore.videoStore}
          label={
            !compositionStore.saved ?
              "Please publish your changes before sharing this composition" :
              "Share Composition"
          }
        />
      </div>
    </div>
  );
});

const TimelineBottomBar = observer(() => {
  const [, navigate] = useLocation();

  return (
    <div className={S("toolbar", "timeline-section__bottom-bar")}>
      <KeyboardControls />
      <div className={S("toolbar__spacer")}/>
      {
        !compositionStore.compositionObject ? null :
          <AsyncButton
            autoContrast
            h={30}
            px="xs"
            color="gray.6"
            variant="outline"
            disabled={compositionStore.saved && !compositionStore.hasUnsavedChanges}
            onClick={async () => await Confirm({
              title: "Discard Changes",
              text: "Are you sure you want to discard changes to this composition? This action cannot be undone",
              onConfirm: () => {
                navigate("/compositions");
                compositionStore.DiscardDraft({...compositionStore.compositionObject, removeComposition: true});
                compositionStore.Reset();
              }
            })}
          >
            <Icon style={{height: 18, width: 18}} icon={DiscardDraftIcon}/>
            <span style={{marginLeft: 10}}>
              Discard Draft
            </span>
          </AsyncButton>
      }
    </div>
  );
});

const TimelineSeekBar = observer(({hoverSeek}) => {
  let indicators = [];
  if(compositionStore.videoStore.clipInFrame) {
    indicators.push({
      position: 100 * compositionStore.videoStore.clipInFrame / (compositionStore.videoStore.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(compositionStore.videoStore.clipOutFrame < compositionStore.videoStore.totalFrames - 1) {
    indicators.push({
      position: 100 * compositionStore.videoStore.clipOutFrame / (compositionStore.videoStore.totalFrames || 1),
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
        min={compositionStore.videoStore.scaleMin}
        max={compositionStore.videoStore.scaleMax}
        handles={[{ position: compositionStore.videoStore.seek, style: "arrow" }]}
        indicators={indicators}
        showMarks
        topMarks
        nMarks={compositionStore.videoStore.sliderMarks}
        majorMarksEvery={compositionStore.videoStore.majorMarksEvery}
        RenderText={progress => compositionStore.videoStore.ProgressToSMPTE(progress)}
        onChange={progress => compositionStore.videoStore.Seek(compositionStore.videoStore.ProgressToFrame(progress))}
        className={S("seek-bar")}
      />
     </div>
  );
});

const TimelineScaleBar = observer(({hoverSeek}) => {
  let indicators = [];
  if(compositionStore.videoStore.clipInFrame) {
    indicators.push({
      position: 100 * compositionStore.videoStore.clipInFrame / (compositionStore.videoStore.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(compositionStore.videoStore.clipOutFrame < compositionStore.videoStore.totalFrames - 1) {
    indicators.push({
      position: 100 * compositionStore.videoStore.clipOutFrame / (compositionStore.videoStore.totalFrames || 1),
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
        {
          !compositionStore.videoStore.videoHandler ? null :
            <>
              <div>{compositionStore.CompositionProgressToSMPTE(compositionStore.videoStore.scaleMin)}</div>
              <div>-</div>
              <div>{compositionStore.CompositionProgressToSMPTE(compositionStore.videoStore.scaleMax)}</div>
            </>
        }
      </div>
      <MarkedSlider
        min={0}
        max={100}
        showTopMarks={false}
        handles={[
          { position: compositionStore.videoStore.scaleMin },
          { position: compositionStore.videoStore.scaleMax }
        ]}
        handleSeparator={100 * compositionStore.videoStore.currentTime / (compositionStore.compositionDuration || 1)}
        indicators={[
          { position: 100 * compositionStore.videoStore.currentTime / (compositionStore.compositionDuration || 1) },
          ...indicators
        ]}
        showMarks
        topMarks
        nMarks={compositionStore.videoStore.sliderMarks}
        majorMarksEvery={compositionStore.videoStore.majorMarksEvery}
        RenderText={progress => compositionStore.videoStore.ProgressToSMPTE(progress)}
        onChange={values => compositionStore.videoStore.SetScale(values[0], values[1])}
        onSlide={diff => compositionStore.videoStore.SetScale(compositionStore.videoStore.scaleMin + diff, compositionStore.videoStore.scaleMax + diff, true)}
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

  const seekPercent = (value - compositionStore.videoStore.scaleMin) / compositionStore.videoStore.scaleMagnitude;
  const position = dimensions.width * seekPercent;

  if(typeof position !== "number" || isNaN(position) || position < 0 || !timelineRef?.current) { return null; }

  return (
    <div
      style={{left: position + dimensions.diff - 1, height: timelineRef.current.getBoundingClientRect().height}}
      className={JoinClassNames(S("playhead-indicator"), className)}
    />
  );
});

const CompositionTimelineContent = observer(({hoverSeek}) => {
  const CalculateDragProgress = event => {
    const startProgress = compositionStore.videoStore.scaleMinTime / compositionStore.compositionDuration;
    const dimensions = event.currentTarget.querySelector(`.${S("timeline-row__content")}`).getBoundingClientRect();
    return startProgress + ((event.clientX - dimensions.left) / dimensions.width) * compositionStore.videoStore.scaleMagnitude / 100;
  };

  let dragLeaveTimeout;
  return (
    <>
      <TimelineSeekBar hoverSeek={hoverSeek}/>
      <div
        onDragOver={event => {
          clearTimeout(dragLeaveTimeout);
          event.preventDefault();
          event.stopPropagation();

          compositionStore.SetDropIndicator(CalculateDragProgress(event));
        }}
        onDragLeave={() => dragLeaveTimeout = setTimeout(() => compositionStore.ClearDropIndicator(), 100)}
        onDrop={event => {
          if(!compositionStore.draggingClip) { return; }

          compositionStore.AddClip(compositionStore.draggingClip, CalculateDragProgress(event));
          compositionStore.EndDrag();
        }}
        className={S("timeline-row", "timeline-row--composition")}
      >
        <div className={S("timeline-row__label")}>
          { compositionStore.compositionObject?.name }
        </div>
        <div className={S("timeline-row__content")}>
          <CompositionTrack />
        </div>
      </div>
      <TimelineScaleBar hoverSeek={hoverSeek}/>
    </>
  );
});

const CompositionTimeline = observer(() => {
  const {objectId} = useParams();
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
        hoverSeek = compositionStore.videoStore.scaleMin + compositionStore.videoStore.scaleMagnitude * progress;
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
      {
        !objectId ? null :
          <TimelinePlayheadIndicator value={compositionStore.videoStore.seek} timelineRef={timelineRef} />
      }
      {
        !objectId || !hoverSeek ? null :
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
          if(!event.ctrlKey && !event.shiftKey) {
            return;
          }

          event.preventDefault();

          // On shift+scroll, move current scale window along timeline. Movement based on current scale magnitude
          if(event.shiftKey) {
            const movement = Math.min(5, compositionStore.videoStore.scaleMagnitude * 0.1) * (event.deltaX < 0 ? -1 : 1);
            compositionStore.videoStore.SetScale(compositionStore.videoStore.scaleMin + movement, compositionStore.videoStore.scaleMax + movement, true);
            return;
          }

          const contentElement = document.querySelector("." + S("timeline-row__content"));

          if(!contentElement) {
            return;
          }

          const {left, width} = contentElement.getBoundingClientRect();
          const position = (event.clientX - left) / width;

          compositionStore.videoStore.ScrollScale(position, event.deltaY);
        }}
        className={S("timeline-section__content", !objectId ? "timeline-section__content--selection" : "")}
      >
        {
          objectId ?
            <CompositionTimelineContent hoverSeek={hoverSeek} /> :
            <CompositionSelection />
        }
      </div>
      <TimelineBottomBar/>
    </div>
  );
});

export default CompositionTimeline;
