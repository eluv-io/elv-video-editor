import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react-lite";
import React from "react";
import {CreateModuleClassMatcher, DragHandler} from "@/utils/Utils.js";
import {compositionStore} from "@/stores/index.js";
import {Icon} from "@/components/common/Common.jsx";

import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import {Tooltip} from "@mantine/core";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";

const S = CreateModuleClassMatcher(SidePanelStyles);

const Clip = observer(({clip}) => {
  if(!clip) { return null; }

  const store = compositionStore.ClipStore({clipId: clip.clipId});

  return (
    <div
      draggable
      role="button"
      onDragStart={DragHandler(() => compositionStore.SetDragging({clip, showDragShadow: true, createNewClip: true}))}
      onDrop={() => compositionStore.EndDrag()}
      onDragEnd={() => compositionStore.EndDrag()}
      onClick={() => compositionStore.SetSelectedClip(clip.clipId)}
      className={S("clip", compositionStore.originalSelectedClipId === clip.clipId ? "clip--active" : "")}
    >
      <PreviewThumbnail
        useLoaderImage
        store={store}
        onDragEnd={() => compositionStore.EndDrag()}
        startFrame={clip.clipInFrame}
        endFrame={clip.clipOutFrame}
        style={{aspectRatio: store.aspectRatio}}
        className={S("clip__image")}
      />
      <Tooltip disabled={!!compositionStore.draggingClip} label={clip.name} multiline maw={300}>
        <div draggable={false} className={S("clip__name", "ellipsis")}>
          { clip.name }
        </div>
      </Tooltip>
    </div>
  );
});

export const CompositionClips = observer(() => {
  if(!compositionStore.compositionObject) { return null; }

  return (
    <div className={S("composition-clips")}>
      <div className={S("composition-clips__title")}>
        My Clips
      </div>
      <div className={S("composition-clips__list")}>
        <Clip clip={compositionStore.sourceClip}/>
      </div>
      {
        compositionStore.aiClips.length === 0 ? null :
          <>
            <div className={S("composition-clips__title")}>
              <Icon icon={AISparkleIcon}/>
              Suggestions
            </div>
            <div className={S("composition-clips__list")}>
              {
                compositionStore.aiClips.map(clip =>
                  <Clip clip={clip} key={`clip-${clip.clipId}`} />
                )
              }
            </div>
          </>
      }
    </div>
  );
});
