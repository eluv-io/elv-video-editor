import VideoStyles from "@/assets/stylesheets/modules/video.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore, keyboardControlsStore} from "@/stores";
import {CreateModuleClassMatcher, DragHandler} from "@/utils/Utils.js";
import {
  AudioControls,
  OfferingControls,
  PlaybackRateControl,
  PlayCurrentClipButton, QualityControls,
  SubtitleControls,
} from "@/components/video/VideoControls";
import Video from "@/components/video/Video";
import MarkedSlider from "@/components/common/MarkedSlider.jsx";
import {AsyncButton, FormTextArea, Icon, IconButton, Modal} from "@/components/common/Common.jsx";
import {Button, Text, Tooltip} from "@mantine/core";
import {modals} from "@mantine/modals";

import ZoomInIcon from "@/assets/icons/v2/zoom-in.svg";
import ZoomOutIcon from "@/assets/icons/v2/zoom-out.svg";
import ZoomOutFullIcon from "@/assets/icons/v2/arrows-horizontal.svg";
import ClipIcon from "@/assets/icons/v2/clip-return.svg";
import ClipInIcon from "@/assets/icons/v2/clip-start.svg";
import ClipOutIcon from "@/assets/icons/v2/clip-end.svg";
import AddClipIcon from "@/assets/icons/v2/add.svg";
import DragClipIcon from "@/assets/icons/v2/drag.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import XIcon from "@/assets/icons/X.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import PublishIcon from "@/assets/icons/v2/publish.svg";

const S = CreateModuleClassMatcher(VideoStyles);

const ClipControls = observer(() => {
  const [resetFrames, setResetFrames] = useState({min: 0, max: 100});
  const store = compositionStore.selectedClipStore;
  const clip = compositionStore.selectedClip;

  const ResetView = () => {
    if(!store.initialized) { return; }

    let clipInProgress = 100 * (clip.clipInFrame || 0) / store.totalFrames;
    let clipOutProgress = 100 * (clip.clipOutFrame || (store.totalFrames - 1)) / store.totalFrames;

    store.SetSegment(clip.clipInFrame, clip.clipOutFrame);
    store.SetScale(
      Math.max(0, clipInProgress - 0.5),
      Math.min(100, clipOutProgress + 0.5),
    );

    setResetFrames({min: store.scaleMinFrame, max: store.scaleMaxFrame});
  };

  useEffect(() => {
    ResetView();
  }, [compositionStore.originalSelectedClipId]);

  if(!store.initialized) {
    return null;
  }

  const isReset = store.scaleMinFrame === resetFrames.min && store.scaleMaxFrame === resetFrames.max;

  return (
    <div className={S("toolbar", "clip-toolbar")}>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Zoom Out"
          icon={ZoomOutIcon}
          disabled={store.scaleMin === 0 && store.scaleMax === 100}
          onClick={() => store.SetScale(store.scaleMin - 1, store.scaleMax + 1)}
        />
        {
          isReset ?
            <IconButton
              label="View Entire Content"
              icon={ZoomOutFullIcon}
              onClick={() => store.SetScale(0, 100)}
            /> :
            <IconButton
              label="Reset View to Selected Clip"
              icon={ClipIcon}
              onClick={ResetView}
            />
        }
        <IconButton
          label="Zoom In"
          icon={ZoomInIcon}
          disabled={store.scaleMagnitude < 1}
          onClick={() => store.SetScale(store.scaleMin + 1, store.scaleMax - 1)}
        />
      </div>
      <div className={S("toolbar__separator")}/>
      <div className={S("toolbar__controls-group")}>
        <IconButton
          label="Set Clip In to Current Frame"
          highlight
          icon={ClipInIcon}
          onClick={() => compositionStore.ModifyClip({
            clipId: compositionStore.selectedClipId,
            attrs: { clipInFrame: store.frame },
            label: "Modify Clip Points"
          })}
        />
        <PlayCurrentClipButton store={store}/>
        <IconButton
          label="Set Clip Out to Current Frame"
          highlight
          icon={ClipOutIcon}
          onClick={() => compositionStore.ModifyClip({
            clipId: compositionStore.selectedClipId,
            attrs: { clipOutFrame: store.frame },
            label: "Modify Clip Points"
          })}
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
          onDragStart={DragHandler(() =>
            compositionStore.SetDragging({
              clip: compositionStore.selectedClip,
              showDragShadow: true,
              createNewClip: true
            })
          )}
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

  if(clip.clipOutFrame < store.totalFrames - 5) {
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

const TitleEditModal = observer(({name, clipView, Close}) => {
  const [editedName, setEditedName] = useState(name);

  const Save = () => {
    if(clipView) {
      compositionStore.ModifyClip({
        clipId: compositionStore.selectedClipId,
        originalClipId: compositionStore.originalSelectedClipId,
        attrs: { name: editedName || name },
        label: "Modify Clip Name"
      });
    } else {
      compositionStore.SetCompositionName(editedName);
    }

    Close();
  };

  return (
    <Modal
      onClose={Close}
      opened
      centered
      withCloseButton={false}
    >
      <form onSubmit={event => event.preventDefault()}>
        <div className={S("form__title")}>Update {clipView ? "Clip" : "Composition"}</div>
        <div className={S("form__inputs")}>
          <FormTextArea
            autoFocus
            value={editedName}
            label={clipView ? "Clip Description" : "Composition Name"}
            onChange={event => setEditedName(event.target.value)}
          />
        </div>
      </form>
      <div className={S("form__actions")}>
        <Button variant="subtle" color="gray.5" onClick={Close}>
          Cancel
        </Button>
        <Button color="gray.5" autoContrast onClick={Save}>
          Update
        </Button>
      </div>
    </Modal>
  );
});

const Title = observer(({clipView}) => {
  const name = clipView ? compositionStore.selectedClip.name : compositionStore.compositionObject?.name;

  const [editing, setEditing] = useState(false);

  if(!name) {
    return (
      <h1 className={S("video-section__title")} />
    );
  }

  return (
    <h1 className={S("video-section__title")}>
      {
        !editing ? null :
          <TitleEditModal name={name} clipView={clipView} Close={() => setEditing(false)} />
      }
      <Tooltip label={<div style={{textOverflow: "ellipsis", overflowX: "hidden"}}>{name}</div>} multiline maw={500}>
        <div className={S("ellipsis")}>
          {name}
        </div>
      </Tooltip>
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
            label="Remove Clip from Composition"
            icon={TrashIcon}
            onClick={() => compositionStore.RemoveClip(compositionStore.selectedClipId)}
          />
      }
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
      <div className={S("video-section__title-actions")}>
        {
          clipView ? null :
            <AsyncButton
              color="gray.5"
              variant="outline"
              autoContrast
              h={30}
              px="xs"
              onClick={async () => {
                if(!await new Promise(resolve =>
                  modals.openConfirmModal({
                    title: "Publish Composition",
                    centered: true,
                    children: <Text fz="sm">Are you sure you want to publish this composition?</Text>,
                    labels: {confirm: "Publish", cancel: "Cancel"},
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                  })
                )) {
                  return;
                }

                await compositionStore.SaveComposition();
              }}
            >
              <Icon icon={PublishIcon}/>
              <span style={{marginLeft: 10}}>
                Publish to Fabric
              </span>
            </AsyncButton>
        }
      </div>
    </h1>
  );
});

const CompositionVideoSection = observer(({store, clipView=false}) => {
  const [sectionRef, setSectionRef] = useState(undefined);
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
    if(!clipView || !store || !store.initialized || !store.videoHandler) { return; }

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
  }, [store.initialized, !!store.videoHandler, compositionStore.selectedClipId, store.originalSelectedClipId]);

  return (
    <div
      ref={setSectionRef}
      tabIndex="0"
      onKeyDown={event => {
        if(event.key === "[") {
          compositionStore.ModifyClip({
            clipId: compositionStore.selectedClipId,
            attrs: { clipInFrame: store.frame },
            label: "Modify Clip Points"
          });
        } else if(event.key === "]") {
          compositionStore.ModifyClip({
            clipId: compositionStore.selectedClipId,
            attrs: { clipOutFrame: store.frame },
            label: "Modify Clip Points"
          });
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
        !sectionRef ? null :
          <Video
            blank={!clipView && compositionStore.clipIdList.length === 0}
            muted={clipView ? compositionStore.clipMuted : compositionStore.compositionMuted}
            volume={clipView ? compositionStore.clipVolume : compositionStore.compositionVolume}
            playoutUrl={clipView ? undefined : compositionStore.compositionPlayoutUrl}
            key={clipView ? undefined : compositionStore.compositionPlayoutUrl}
            Callback={video => {
              video.addEventListener("volumechange", () => compositionStore.__UpdateVideoSettings(
                clipView ? "clip" : "composition",
                video
              ));

              if(!clipView && compositionStore.seekProgress) {
                video.addEventListener("durationchange", () => video.currentTime = video.duration * compositionStore.seekProgress / 100);
              }
            }}
            store={store}
            fullscreenContainer={sectionRef}
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
              </>
          }
          <QualityControls store={store}/>
          <AudioControls store={store}/>
        </div>
      </div>
    </div>
  );
});

export default CompositionVideoSection;
