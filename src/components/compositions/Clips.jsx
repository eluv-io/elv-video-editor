import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore} from "@/stores/index.js";
import {CreateModuleClassMatcher, DragHandler, JoinClassNames, SP} from "@/utils/Utils.js";
import ThumbnailTrack from "@/components/timeline/ThumbnailTrack.jsx";
import {ClipTimeInfo, Confirm, Icon, IconButton, Modal, StyledButton} from "@/components/common/Common.jsx";
import {Select, Slider} from "@mantine/core";

import InvertedTriangleIcon from "@/assets/icons/v2/inverted-triangle.svg";
import TransitionIcon from "@/assets/icons/transition.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import ReorderIcon from "@/assets/icons/v2/sort-clips.svg";
import SplitIcon from "@/assets/icons/v2/split.svg";
import ClipIcon from "@/assets/icons/scissors.svg";
import AddEffectIcon from "@/assets/icons/v2/plus.svg";

const S = CreateModuleClassMatcher(CompositionStyles);

const CalculateClipPosition = ({clip, containerDimensions}) => {
  if(!clip) { return { clipWidth: 0, clipLeft: 0 }; }

  const totalFrames = compositionStore.compositionDurationFrames;
  const visibleStartFrame = (compositionStore.videoStore.scaleMin / 100) * totalFrames;
  const visibleFrames = (compositionStore.videoStore.scaleMagnitude / 100) * totalFrames;

  const clipWidth = containerDimensions.width * (clip.clipOutFrame - clip.clipInFrame) / visibleFrames;
  const clipLeft = ((clip.startFrame - visibleStartFrame) / visibleFrames) * containerDimensions.width;

  return { clipWidth, clipLeft };
};

export const DropIndicator = observer(({containerDimensions}) => {
  if(typeof compositionStore.dropIndicatorIndex === "undefined") {
    return null;
  }

  let left = 0;
  if(compositionStore.dropIndicatorIndex > 0) {
    const previousClip = compositionStore.clipList[compositionStore.dropIndicatorIndex - 1];
    const { clipLeft, clipWidth } = CalculateClipPosition({clip: previousClip, containerDimensions});
    left = clipLeft + clipWidth - 1;
  }

  return (
    <div
      draggable={false}
      style={{left}}
      key={`indicator-${compositionStore.dropIndicatorIndex}`}
      className={S("composition-track__drop-indicator")}
    >
      <Icon icon={InvertedTriangleIcon} />
    </div>
  );
});

export const DraggedClip = observer(() => {
  const visible = !(
    !compositionStore.showDragShadow ||
    !compositionStore.draggingClip ||
    compositionStore.mousePositionX === 0
  );

  useEffect(() => {
    if(!visible) { return; }

    const EndDrag = () => compositionStore.EndDrag();

    document.body.addEventListener("mouseup", EndDrag);
    document.body.addEventListener("mousedown", EndDrag);

    return () => {
      document.body.removeEventListener("mouseup", EndDrag);
      document.body.removeEventListener("mousedown", EndDrag);
    };
  }, [visible]);

  if(!visible) {
    return null;
  }

  const clip = compositionStore.draggingClip;

  const {clipWidth} = CalculateClipPosition({
    clip,
    containerDimensions: {width: window.innerWidth}
  });

  return (
    <div
      style={{
        width: Math.max(Math.min(clipWidth, window.innerWidth / 2), 200),
        left: compositionStore.mousePositionX + 10,
        top: compositionStore.mousePositionY + 10
      }}
      className={S("dragged-clip")}
    >
      <div className={S("dragged-clip__thumbnail-container")}>
        <ThumbnailTrack
          noHover
          store={compositionStore.ClipStore({...clip})}
          startFrame={clip.clipInFrame}
          endFrame={clip.clipOutFrame}
          className={S("dragged-clip__thumbnails")}
        />
      </div>
    </div>
  );
});

export const ClipTooltipContent = observer(({clip}) => {
  return (
    <div className={S("clip__tooltip")}>
      <div className={S("clip__tooltip-name")}>{clip.name}</div>
      <div className={S("clip__tooltip-time")}>
        <ClipTimeInfo
          store={compositionStore.ClipStore({...clip})}
          clipInFrame={clip.clipInFrame}
          clipOutFrame={clip.clipOutFrame}
        />
      </div>
    </div>
  );
});

const ClipTransitionMenu = observer(({clip, Close}) => {
  const [effects, setEffects] = useState(clip.effects || []);

  const Update = ({index, key, value}) => {
    let newEffects = [...effects];
    newEffects[index][key] = value;
    setEffects(newEffects);
  };

  const availableEffects = [
    "fade_in",
    "fade_out"
  ];

  const nextEffect = availableEffects.find(type => !effects.find(effect => effect.type === type));

  return (
    <Modal
      onClick={SP()}
      title="Manage Transitions"
      alwaysOpened
      centered
      size={600}
      onClose={() => {}}
      withCloseButton={false}
    >
      <div className={S("effects-menu")}>
        <div className={S("effects-menu__effects")}>
          {
            effects.map((effect, index) =>
              <div key={`effect-${index}`} className={S("effects-menu__effect")}>
                <Select
                  value={effect.type}
                  onChange={value => Update({index, key: "type", value})}
                  data={[
                    {label: "Fade In", value: "fade_in"},
                    {label: "Fade Out", value: "fade_out"},
                  ]}
                />
                <Slider
                  min={0}
                  max={5}
                  step={0.1}
                  label={`Duration: ${effect.duration.toFixed(1)}s`}
                  value={effect.duration}
                  marks={[
                    {value: 1, label: "1"},
                    {value: 2, label: "2"},
                    {value: 3, label: "3"},
                    {value: 4, label: "4"}
                  ]}
                  onChange={value => Update({index, key: "duration", value})}
                  className={S("effects-menu__duration")}
                />
                <IconButton
                  icon={DeleteIcon}
                  label="Remove Effect"
                  onClick={() => setEffects(effects.filter((_, i) => i !== index))}
                />
              </div>
            )
          }
        </div>
        <div className={S("effects-menu__actions")}>
          <IconButton
            icon={AddEffectIcon}
            label="Add Effect"
            disabled={!nextEffect}
            onClick={() => {
              setEffects([
                ...effects,
                { type: nextEffect, duration: 1.5 }
              ]);
            }}
            className={S("effects-menu__add")}
          />
        </div>
        <div className={S("effects-menu__actions")}>
          <StyledButton
            onClick={Close}
            color="--background-active"
          >
            Cancel
          </StyledButton>
          <StyledButton
            onClick={() => {
              compositionStore.ModifyClip({
                clipId: clip.clipId,
                label: "Update Transitions",
                attrs: {
                  effects: effects.map(effect => ({
                    type: effect.type,
                    duration: effect.duration,
                    position: ["fade_in"].includes(effect.type) ? "start" : "end"
                  }))
                }
              });

              Close();
            }}
          >
            Update
          </StyledButton>
        </div>
      </div>
    </Modal>
  );
});

const TimelineClipMenu = observer(({clip, position, clipPosition, ShowTransitionsMenu, Close}) => {
  const [menuElement, setMenuElement] = useState(null);

  useEffect(() => {
    if(!menuElement) { return; }

    // Click outside handler
    const onClickOutside = () => {
      setTimeout(() => {
        if(!menuElement.contains(document.activeElement)) {
          Close();
        }
      }, 100);
    };

    window.addEventListener("focusout", onClickOutside, {passive: true});
    window.addEventListener("blur", onClickOutside, {passive: true});

    return () => {
      window.removeEventListener("focusout", onClickOutside);
      window.removeEventListener("blur", onClickOutside);
    };
  }, [menuElement]);

  const splitDisabled = (
    compositionStore.videoStore.frame <= clip.clipInFrame ||
    compositionStore.videoStore.frame >= clip.clipOutFrame
  );

  return (
    <div
      ref={setMenuElement}
      style={{
        position: "fixed",
        top: clipPosition.top - (menuElement?.getBoundingClientRect().height || 0) - 3,
        left: position.x,
      }}
      className={S("clip-menu")}
    >
      <button
        onClick={() => {
          compositionStore.SetSelectedClip({clipId: clip.clipId, source: "timeline"});
          Close();
        }}
        className={S("clip-menu__button")}
        autoFocus
      >
        <Icon icon={ClipIcon}/>
        Edit Clip
      </button>
      <button
        disabled={splitDisabled}
        title={
          !splitDisabled ? null :
            "Seek composition playback to this clip to split it"
        }
        onClick={() => {
          compositionStore.SplitClip(compositionStore.seek);
          Close();
        }}
        className={S("clip-menu__button")}
      >
        <Icon icon={SplitIcon}/>
        Split
      </button>
      <button
        onClick={() => {
          ShowTransitionsMenu();
          Close();
        }}
        className={S("clip-menu__button")}
      >
        <Icon icon={TransitionIcon}/>
        Transitions
      </button>
      <button
        onClick={() => {
          Confirm({
            title: "Reorder Clips",
            text: "Are you sure you want to reorder your composition clips?",
            onConfirm: async () => await compositionStore.SortCompositionClips()
          });

          Close();
        }}
        className={S("clip-menu__button")}
      >
        <Icon icon={ReorderIcon}/>
        Reorder Clips
      </button>
      <div className={S("clip-menu__separator")}/>
      <button
        onClick={() => {
          compositionStore.RemoveClip(clip.clipId);
          Close();
        }}
        className={S("clip-menu__button")}
      >
        <Icon icon={DeleteIcon}/>
        Remove Clip
      </button>
    </div>
  );
});



export const TimelineClip = observer(({clip, containerDimensions}) => {
  const {clipLeft, clipWidth} = CalculateClipPosition({clip, containerDimensions});
  const [clipElement, setClipElement] = useState(undefined);
  const [menuPosition, setMenuPosition] = useState(undefined);
  const [showTransitionsMenu, setShowTransitionsMenu] = useState(false);

  return (
    <>
      <div
        ref={setClipElement}
        onContextMenuCapture={event => {
          event.preventDefault();
          setMenuPosition({x: event.clientX, y: event.clientY});
        }}
        draggable
        onDragStart={DragHandler(() => compositionStore.SetDragging({
          source: "timeline",
          clip,
          showDragShadow: true,
          createNewClip: false
        }))}
        onDragEnd={() => compositionStore.EndDrag()}
        onClick={() => compositionStore.SetSelectedClip({clipId: clip.clipId, source: "timeline"})}
        style={{
          left: clipLeft,
          width: clipWidth,
        }}
        className={
          JoinClassNames(
            S(
              "clip",
              !!menuPosition || compositionStore.selectedClip?.clipId === clip.clipId ?
                "clip--selected" : "",
            ),
            (clip.effects || []).map(effect => S(`clip--effect-${effect.type?.replace("_", "-")}-${effect.position}`)).join(" ")
          )
        }
      >
        <div className={S("clip__thumbnail-container")}>
          <div className={S("clip__details")}>
            <div className={S("clip__details-name", "ellipsis")}>{clip.name}</div>
            <div className={S("clip__details-duration")}>
              {compositionStore.ClipStore({...clip})?.videoHandler?.FrameToString({frame: clip.clipOutFrame - clip.clipInFrame})}
            </div>
          </div>

          <ThumbnailTrack
            float={false}
            store={compositionStore.ClipStore({...clip})}
            startFrame={clip.clipInFrame}
            endFrame={clip.clipOutFrame}
            hoverOffset={10}
            thumbnailFrom="start"
            tooltipDisabled={!!menuPosition}
            RenderTooltip={thumbnailUrl =>
              <div className={S("thumbnail-hover")}>
                {
                  !thumbnailUrl ? null :
                    <img
                      src={thumbnailUrl}
                      style={{aspectRatio: compositionStore.ClipStore({...clip}).aspectRatio}}
                      className={S("thumbnail-hover__image")}
                    />
                }
                <div className={S("thumbnail-hover__text")}>{clip.name}</div>
                <ClipTimeInfo
                  store={compositionStore.ClipStore({...clip})}
                  clipInFrame={clip.clipInFrame}
                  clipOutFrame={clip.clipOutFrame}
                  className={S("thumbnail-hover__time")}
                />
              </div>
            }
            className={S("clip__thumbnails")}
          />
        </div>
      </div>
      {
        !menuPosition ? null :
          <TimelineClipMenu
            clip={clip}
            position={menuPosition}
            ShowTransitionsMenu={() => setShowTransitionsMenu(true)}
            clipPosition={clipElement.getBoundingClientRect()}
            Close={() => setMenuPosition(undefined)}
          />
      }
      {
        !showTransitionsMenu ? null :
          <ClipTransitionMenu clip={clip} Close={() => setShowTransitionsMenu(false)} />
      }
    </>
  );
});
