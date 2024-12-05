import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {tracksStore, videoStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton, Input, SwitchInput} from "@/components/common/Common";
import MarkedSlider from "@/components/common/MarkedSlider";
import Fraction from "fraction.js";

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
        <Input label="Clip Start" monospace value={videoStore.FrameToSMPTE(videoStore.clipInFrame) || "00:00:00:00"} w={150} />
        <IconButton icon={ClipOutIcon} label="Set Clip Out to Current Frame" onClick={() => videoStore.SetClipMark({outFrame: videoStore.frame})} />
        <Input label="Clip End" monospace value={videoStore.FrameToSMPTE(videoStore.clipOutFrame) || "00:00:00:00"} w={150} />
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
      <SwitchInput label="Show Tags" />
      <SwitchInput label="Show Segments" />
      <SwitchInput label="Show Audio" />
      <div className={S("toolbar__spacer")}/>
    </div>
  );
});

const TimelineSeekBar = observer(() => {
  return (
     <div className={S("timeline-row", "seek-bar-container")}>
      <div className={S("timeline-row__label", "seek-bar-container__spacer")} />
      <MarkedSlider
        min={videoStore.scaleMin}
        max={videoStore.scaleMax}
        handles={[
          {
            position: videoStore.seek,
            toolTip: `Playhead - ${videoStore.FrameToSMPTE(videoStore.frame)}`,
            className: "seek-handle",
          }
        ]}
        showMarks
        topMarks
        nMarks={videoStore.sliderMarks}
        majorMarksEvery={videoStore.majorMarksEvery}
        RenderText={value => videoStore.ProgressToSMPTE(value)}
        onChange={value => {
          videoStore.SeekPercentage(Fraction(value).div(100));
        }}
        className={S("seek-bar")}
      />
     </div>
  );
});

const TimelinePlayheadIndicator = observer(({timelineRef}) => {
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

  const seekPercent = (videoStore.seek - videoStore.scaleMin) / videoStore.scaleMax;
  const position = dimensions.width * seekPercent;

  if(!position) { return null; }

  return (
    <div
      style={{left: position + dimensions.diff}}
      className={S("playhead-indicator")}
    />
  );
});

const TimelineSection = observer(() => {
  const timelineRef = useRef(null);

  const metadataTracks = tracksStore.tracks
    //.filter(track => track.trackType !== "vtt" && track.trackType !== "clip" && track.trackType !== "segments").slice()
    //.sort((a, b) => (a.label > b.label ? 1 : -1))

  console.log(metadataTracks);

  return (
    <div className={S("content-block", "timeline-section")}>
      <TimelineTopBar />
      <TimelinePlayheadIndicator timelineRef={timelineRef} />
      <div ref={timelineRef} className={S("timeline-section__content")}>
        <TimelineSeekBar/>
        {
          metadataTracks.map((track, i) =>
            <div key={`track-${track.trackId || i}`} className={S("timeline-row")}>
              <div className={S("timeline-row__label")}>
                { track.label }
              </div>
              <div className={S("timeline-row__content")}>
                <Track track={track} />
              </div>
            </div>
          )
        }

        <div className={S("timeline-row")}>
          <div className={S("timeline-row__label")}>
            Label
          </div>
          <div className={S("timeline-row__content")}>
            Content
          </div>
        </div>
        <div className={S("timeline-row")}>
          <div className={S("timeline-row__label")}>
            Label
          </div>
          <div className={S("timeline-row__content")}>
            Content
          </div>
        </div>
        <div className={S("timeline-row")}>
          <div className={S("timeline-row__label")}>
            Label
          </div>
          <div className={S("timeline-row__content")}>
            Content
          </div>
        </div>
        <div className={S("timeline-row")}>
          <div className={S("timeline-row__label")}>
            Label
          </div>
          <div className={S("timeline-row__content")}>
            Content
          </div>
        </div>
      </div>
      <TimelineBottomBar/>
    </div>
  );
});

export default TimelineSection;
