import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, keyboardControlsStore} from "@/stores";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AudioControls,
  OfferingControls,
  PlaybackRateControl,
  PlayCurrentClipButton,
  SubtitleControls,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import MarkedSlider from "@/components/common/MarkedSlider.jsx";
import {IconButton} from "@/components/common/Common.jsx";
import {TextInput, Tooltip} from "@mantine/core";

import ZoomInIcon from "@/assets/icons/v2/zoom-in.svg";
import ZoomOutIcon from "@/assets/icons/v2/zoom-out.svg";
import ClipIcon from "@/assets/icons/v2/clip-return.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";
import AddClipIcon from "@/assets/icons/v2/add-new-item.svg";
import DragClipIcon from "@/assets/icons/v2/drag-handle.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import CheckIcon from "@/assets/icons/check-circle.svg";
import XIcon from "@/assets/icons/X.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const ClipControls = observer(() => {
  const store = compositionStore.selectedClipStore;
  const clip = compositionStore.selectedClip;

  if(!store.initialized) {
    return null;
  }

  return (
    <div className={S("toolbar", "clip-toolbar")}>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Zoom Out"
          icon={ZoomOutIcon}
          disabled={store.scaleMin === 0 && store.scaleMax === 100}
          onClick={() => store.SetScale(store.scaleMin - 0.5, store.scaleMax + 0.5)}
        />
        <IconButton
          label="Reset View to Selected Clip"
          icon={ClipIcon}
          onClick={() => {
            let clipInProgress = 100 * (clip.clipInFrame || 0) / store.totalFrames;
            let clipOutProgress = 100 * (clip.clipOutFrame || (store.totalFrames - 1)) / store.totalFrames;

            store.SetSegment(clip.clipInFrame, clip.clipOutFrame);
            store.SetScale(
              Math.max(0, clipInProgress - 0.5),
              Math.min(100, clipOutProgress + 0.5),
            );
          }}
        />
        <IconButton
          label="Zoom In"
          icon={ZoomInIcon}
          disabled={store.scaleMagnitude < 0.5}
          onClick={() => store.SetScale(store.scaleMin + 0.5, store.scaleMax - 0.5)}
        />
      </div>
      <div className={S("toolbar__separator")}/>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Set Clip In to Current Frame"
          highlight
          icon={ClipInIcon}
          onClick={() => {
            store.SetClipMark({inFrame: store.frame});
            compositionStore.ModifyClip({
              label: "Modify Clip Points",
              clipId: clip.clipId,
              attrs: {
                clipInFrame: store.clipInFrame,
                clipOutFrame: store.clipOutFrame
              }
            });
          }}
        />
        <PlayCurrentClipButton store={store}/>
        <IconButton
          label="Set Clip Out to Current Frame"
          highlight
          icon={ClipOutIcon}
          onClick={() => {
            store.SetClipMark({outFrame: store.frame});
            compositionStore.ModifyClip({
              label: "Modify Clip Points",
              clipId: clip.clipId,
              attrs: {
                clipInFrame: store.clipInFrame,
                clipOutFrame: store.clipOutFrame
              }
            });
          }}
        />
      </div>
      <div className={S("toolbar__separator")}/>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Append Clip to Composition"
          icon={AddClipIcon}
          onClick={() => compositionStore.AppendClip(compositionStore.selectedClip)}
        />
        <IconButton
          key={compositionStore.selectedClip.clipKey}
          label="Drag Clip to Timeline"
          icon={DragClipIcon}
          style={{cursor: "grab"}}
          draggable
          onDragStart={event => {
            const dragElement = document.querySelector("#drag-dummy") || document.createElement("div");
            document.body.appendChild(dragElement);
            dragElement.style.display = "none";
            dragElement.id = "drag-dummy";
            event.dataTransfer.setDragImage(dragElement, -10000, -10000);
            compositionStore.SetDragging({
              clip: compositionStore.selectedClip,
              showDragShadow: true,
              createNewClip: true
            });
          }}
          onDragEnd={() => compositionStore.EndDrag()}
        />
      </div>
    </div>
  );
});

const ClipSeekBar = observer(() => {
  const store = compositionStore.selectedClipStore;
  const clip = compositionStore.selectedClip;

  if(!store.initialized) {
    return null;
  }

  let indicators = [];
  if(clip.clipInFrame) {
    indicators.push({
      position: 100 * clip.clipInFrame / (store.totalFrames || 1),
      style: "start",
      connectStart: true
    });
  }

  if(clip.clipOutFrame < store.totalFrames - 1) {
    indicators.push({
      position: 100 * clip.clipOutFrame / (store.totalFrames || 1),
      style: "end",
      connectEnd: true
    });
  }

  return (
    <MarkedSlider
      min={store.scaleMin}
      max={store.scaleMax}
      handles={[{ position: store.seek }]}
      indicators={indicators}
      showMarks
      topMarks
      nMarks={store.sliderMarks}
      majorMarksEvery={store.majorMarksEvery}
      RenderText={progress => store.ProgressToSMPTE(progress)}
      RenderHover={
        !store.thumbnailStore.thumbnailStatus.available ? undefined :
          progress => (
            <div className={S("thumbnail-hover")}>
              <img
                src={store.thumbnailStore.ThumbnailImage(store.ProgressToTime(progress))}
                style={{aspectRatio: store.aspectRatio}}
                className={S("thumbnail-hover__image")}
              />
              <div className={S("thumbnail-hover__time")}>{store.ProgressToSMPTE(progress)}</div>
            </div>
          )
      }
      onChange={progress => store.Seek(store.ProgressToFrame(progress), false)}
      className={S("seek-bar")}
    />
  );
});

const Title = observer(({clipView}) => {
  const name = clipView ? compositionStore.selectedClip.name : compositionStore.compositionObject?.name;

  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);

  if(editing) {
    const Save = () => {
      if(clipView) {
        compositionStore.ModifyClip({
          clipId: compositionStore.selectedClipId,
          attrs: { name: editedName },
          label: "Modify Clip Name"
        });
      } else {
        compositionStore.SetCompositionName(editedName);
      }

      setEditing(false);
    };

    return (
      <h1 className={S("video-section__title")}>
        <TextInput
          value={editedName}
          placeholder={clipView ? "Clip Name" : "Composition Name"}
          onKeyDown={event => event.key === "Enter" && Save()}
          onChange={event => setEditedName(event.target.value)}
          className={S("video-section__title-input")}
        />
        <IconButton
          highlight
          label="Update Name"
          icon={CheckIcon}
          onClick={Save}
        />
      </h1>
    );
  }

  return (
    <h1 className={S("video-section__title")}>
      <Tooltip label={<div style={{textOverflow: "ellipsis", overflowX: "hidden"}}>{name}</div>} multiline maw={500}>
        <div className={S("ellipsis")}>
          {name}
        </div>
      </Tooltip>
      <div className={S("video-section__title-actions")}>
        <IconButton
          faded
          small
          label="Edit Name"
          icon={EditIcon}
          onClick={() => setEditing(true)}
        />
        {
          !clipView || compositionStore.videoStore.fullScreen ? null :
            <IconButton
              faded
              small
              label="Close"
              icon={XIcon}
              onClick={() => compositionStore.ClearSelectedClip()}
            />
        }
      </div>
    </h1>
  );
});

const CompositionVideoSection = observer(({store, clipView=false}) => {
  const sectionRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    keyboardControlsStore.ToggleKeyboardControls(true);

    if(clipView) {
      keyboardControlsStore.SetActiveStore(store);
    }

    return () => {
      if(clipView) {
        keyboardControlsStore.SetActiveStore(compositionStore.videoStore);
      } else {
        keyboardControlsStore.ToggleKeyboardControls(false);
      }
    };
  }, []);

  useEffect(() => {
    if(!clipView) { return; }

    // Switch keyboard control context when focused/blurred
    keyboardControlsStore.SetActiveStore(
      active ? store : compositionStore.videoStore
    );
  }, [active]);

  useEffect(() => {
    if(!clipView || !store.initialized || !store.videoHandler) { return; }

    const clip = compositionStore.selectedClip;
    // Set initial scale for clip

    const clipOutFrame = clip.clipOutFrame || store.totalFrames - 1;

    let clipInProgress = store.FrameToProgress(clip.clipInFrame);
    let clipOutProgress = store.FrameToProgress(clipOutFrame);

    store.SetClipMark({inFrame: clip.clipInFrame, outFrame: clipOutFrame});
    store.SetSegment(clip.clipInFrame, clipOutFrame);
    store.SetScale(
      Math.max(0, clipInProgress - 0.5),
      Math.min(100, clipOutProgress + 0.5),
    );
    store.Seek(clip.clipInFrame);
  }, [store.initialized, !!store.videoHandler, compositionStore.selectedClipId]);

  return (
    <div
      ref={sectionRef}
      tabIndex="0"
      onKeyDown={event => {
        if(event.key === "[") {
          compositionStore.ModifySelectedClip({clipInFrame: store.frame});
        } else if(event.key === "]") {
          compositionStore.ModifySelectedClip({clipOutFrame: store.frame});
        }
      }}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
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
          const movement = Math.min(0.5, store.scaleMagnitude * 0.1) * (event.deltaX < 0 ? -1 : 1);
          store.SetScale(store.scaleMin + movement, store.scaleMax + movement, true);
          return;
        }

        store.ScrollScale(0.5, event.deltaY);
      }}
      className={S("content-block", "video-section", clipView && active ? "video-section--active" : "")}
    >
      <Title clipView={clipView} />
      {
        !sectionRef?.current ? null :
          <Video
            playoutUrl={clipView ? undefined : compositionStore.compositionPlayoutUrl}
            store={store}
            fullscreenContainer={sectionRef.current}
          />
      }
      {
        !clipView ? null :
          <>
            <ClipSeekBar />
            <ClipControls />
          </>
      }
      <div className={S("toolbar")}>
        <div className={S("toolbar__spacer")}/>
        <div className={S("toolbar__controls-group")}>
          <PlaybackRateControl store={store}/>
          {
            !clipView ? null :
              <>
                <OfferingControls store={store}/>
                <SubtitleControls store={store}/>
                <AudioControls store={store}/>
              </>
          }
        </div>
      </div>
    </div>
  );
});

export default CompositionVideoSection;
