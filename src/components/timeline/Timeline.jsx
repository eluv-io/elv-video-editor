import TimelineStyles from "Assets/stylesheets/modules/timeline.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {videoStore} from "Stores";
import {CreateModuleClassMatcher} from "Utils/Utils";
import {IconButton, Input} from "Components/common/Common";

import UndoIcon from "Assets/icons/v2/undo";
import RedoIcon from "Assets/icons/v2/redo";
import AddUserIcon from "Assets/icons/v2/add-user";
import DownloadIcon from "Assets/icons/v2/download";

import FrameBack10 from "Assets/icons/v2/frame-back-10";
import FrameBack1 from "Assets/icons/v2/frame-back-1";
import FrameForward1 from "Assets/icons/v2/frame-forward-1";
import FrameForward10 from "Assets/icons/v2/frame-forward-10";

import PlayClipIcon from "Assets/icons/v2/play-clip";
import AddNewItemIcon from "Assets/icons/v2/add-new-item";
import SplitIcon from "Assets/icons/v2/split";
import ClipInIcon from "Assets/icons/v2/clip-start";
import ClipOutIcon from "Assets/icons/v2/clip-end";

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

    </div>
  );
});

const TimelineSection = observer(() => {
  return (
    <div className={S("content-block", "timeline-section")}>
      <TimelineTopBar />
      <div className={S("timeline-section__content")}>
        <div className={S("timeline-section__content-test")}>
          Content
        </div>
      </div>
      <TimelineBottomBar />
    </div>
  );
});

export default TimelineSection;
