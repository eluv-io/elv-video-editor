import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, DragHandler, StorageHandler} from "@/utils/Utils.js";
import {aiStore, browserStore, compositionStore, rootStore, trackStore} from "@/stores/index.js";
import {ClipTimeInfo, Confirm, Icon, IconButton, Linkish, Loader} from "@/components/common/Common.jsx";
import {Tooltip} from "@mantine/core";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import UrlJoin from "url-join";

import ClipIcon from "@/assets/icons/v2/clip.svg";
import MediaIcon from "@/assets/icons/v2/play-clip.svg";
import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import XIcon from "@/assets/icons/X.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import ChevronUpIcon from "@/assets/icons/chevron-up.svg";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import {ClipTooltipContent} from "@/components/compositions/Clips.jsx";

const S = CreateModuleClassMatcher(SidePanelStyles);

const SidePanelClip = observer(({clip, showTagLink=false}) => {
  if(!clip) { return null; }

  const store = compositionStore.ClipStore({clipId: clip.clipId});

  return (
    <div
      draggable
      role="button"
      onDragStart={DragHandler(() => compositionStore.SetDragging({
        source: "side-panel",
        clip,
        showDragShadow: true,
        createNewClip: true
      }))}
      onDragEnd={() => compositionStore.EndDrag()}
      onClick={() => compositionStore.SetSelectedClip({clipId: clip.clipId, source: "side-panel"})}
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
      <Tooltip
        disabled={!!compositionStore.draggingClip}
        label={<ClipTooltipContent clip={clip} />}
        maw={300}
      >
        <div draggable={false} className={S("clip__name", "ellipsis")}>
          {clip.name}
        </div>
      </Tooltip>
      {
        clip.clipId === compositionStore.sourceFullClipId ? null :
          <ClipTimeInfo
            store={store}
            clipInFrame={clip.clipInFrame}
            clipOutFrame={clip.clipOutFrame}
            className={S("clip__time")}
          />
      }
      {
        !compositionStore.myClipIds.includes(clip.clipId) ? null :
          <IconButton
            icon={XIcon}
            small
            className={S("clip__action")}
            onClick={async event => {
              event.stopPropagation();

              await Confirm({
                title: "Remove from My Clips",
                text: "Are you sure you want to remove this clip?",
                onConfirm: () => compositionStore.RemoveMyClip(clip.clipId)
              });
            }}
          />
      }
      {
        !showTagLink ? null :
          <IconButton
            label="View in Tag Editor"
            to={UrlJoin("/", clip.objectId, `tags?sf=${clip.clipInFrame}&ef=${clip.clipOutFrame}&isolate=true`)}
            icon={TagIcon}
            small
            className={S("clip__action")}
          />
      }
    </div>
  );
});


const ClipGroup = observer(({
  icon,
  color,
  title,
  subtitle,
  groupKey,
  clipIds=[],
  noFilter,
  loading=false,
  showTagLinks
}) => {
  const [hide, setHide] = useState(StorageHandler.get({type: "session", key: `hide-clips-${groupKey}`}));

  useEffect(() => {
    if(hide) {
      StorageHandler.set({type: "session", key: `hide-clips-${groupKey}`, value: "true"});
    } else {
      StorageHandler.remove({type: "session", key: `hide-clips-${groupKey}`});
    }
  }, [hide]);

  let clips = (clipIds || []).map(clipId => compositionStore.clips[clipId]);

  if(!noFilter && compositionStore.filter) {
    clips = clips.filter(clip =>
      clip.name?.toLowerCase()?.includes(compositionStore.filter.toLowerCase())
    );
  }

  if(clips.length === 0 && !loading) {
    return null;
  }

  return (
    <div className={S("clip-group", hide ? "clip-group--closed" : "")}>
      <button onClick={() => setHide(!hide)} className={S("clip-group__header")}>
        {
          !icon ? null :
            <Icon icon={icon} className={S("clip-group__header-icon")} />
        }
        {
          !color ? null :
            <div
              style={{backgroundColor: `rgb(${color.r} ${color.g} ${color.b}`}}
              className={S("clip-group__header-color")}
            />
        }
        <div className={S("clip-group__text")}>
          <div className={S("clip-group__title")}>
            { title }
          </div>
          {
            !subtitle ? null :
              <div className={S("clip-group__subtitle")}>
              </div>
          }
        </div>
        <Icon icon={hide ? ChevronDownIcon : ChevronUpIcon} className={S("clip-group__header-indicator")} />
      </button>
      {
        hide || (!loading && (!clips || clips.length === 0)) ? null :
          loading ?
            <Loader className={S("clip-group__loader")} /> :
            <div className={S("clip-group__clips")}>
              { clips.map(clip => <SidePanelClip clip={clip} key={`clip-${clip.clipId}`} showTagLink={showTagLinks} />) }
            </div>
      }
    </div>
  );
});

const AIClips = observer(() => {
  const [loading, setLoading] = useState(false);
  const [clipSource, setClipSource] = useState("highlights");
  const clipIds = clipSource === "search" ?
    compositionStore.searchClipIds : compositionStore.aiClipIds;

  useEffect(() => {
    if(!compositionStore.filter) {
      setLoading(false);
      setClipSource("highlights");
      return;
    }

    setLoading(true);

    compositionStore.SearchClips(compositionStore.filter)
      .finally(() => {
        setClipSource("search");
        setLoading(false);
      });
  }, [compositionStore.filter, aiStore.selectedSearchIndexId]);

  return  (
    !loading && clipIds.length === 0 ? null :
      <ClipGroup
        noFilter
        groupKey="ai"
        icon={AISparkleIcon}
        showTagLinks
        title={compositionStore.filter ? "Results" : "Suggestions"}
        subtitle={!compositionStore.filter ? "Prompt" : ""}
        clipIds={clipIds}
        loading={loading}
      />
  );
});

export const CompositionClips = observer(() => {
  const [showDragIndicator, setShowDragIndicator] = useState(false);

  if(!compositionStore.compositionObject) { return null; }

  return (
    <div
      onDragOver={event => {
        event.preventDefault();
        event.stopPropagation();

        setShowDragIndicator(compositionStore.draggingClip.source !== "side-panel");
      }}
      onDragLeave={() => setShowDragIndicator(false)}
      className={S("composition-clips")}
    >
      <div
        onDrop={() => {
          setShowDragIndicator(false);
          compositionStore.AddMyClip({clip: compositionStore.draggingClip});
          compositionStore.EndDrag();
        }}
        className={S("composition-clips__drag-indicator", showDragIndicator ? "composition-clips__drag-indicator--active" : "")}
      >
        <Icon icon={ClipIcon}/>
        <div>
          Save to My Clips
        </div>
      </div>
      <ClipGroup
        title="My Clips"
        groupKey="my-clips"
        clipIds={[
          compositionStore.sourceFullClipId,
          ...compositionStore.myClipIds
        ]}
      />
      {
        !compositionStore.compositionObject?.objectId ? null :
          <AIClips/>
      }
      {
        Object.keys(compositionStore.sourceClipIds).map(category =>
          <ClipGroup
            title={compositionStore.sourceClipIds[category].label || category}
            color={trackStore.TrackColor(category)}
            key={`clip-${category}`}
            groupKey={`clip-${category}`}
            clipIds={compositionStore.sourceClipIds[category].clipIds}
          />
        )
      }
    </div>
  );
});

export const CompositionBrowser = observer(() => {
  const [info, setInfo] = useState(undefined);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if(!rootStore.selectedObjectId || deleting) {
      return;
    }

    browserStore.LookupContent(rootStore.selectedObjectId)
      .then(setInfo);
  }, [rootStore.selectedObjectId, deleting]);

  if(!rootStore.selectedObjectId) {
    return null;
  }

  if(!info) {
    return <Loader />;
  }

  let compositions = (info.channels || [])
    .filter(({label, key}) =>
      !compositionStore.filter ||
      label.toLowerCase().includes(compositionStore.filter.toLowerCase()) ||
      key.toLowerCase().includes(compositionStore.filter.toLowerCase())
    );

  return (
    <div className={S("composition-browser")}>
      {
        compositions.length === 0 ?
          <div className={S("composition-browser__empty")}>No Compositions</div> :
          <div className={S("composition-browser__content")}>
            {compositions.map(({label, key}) =>
              <Linkish
                disabled={deleting}
                key={key}
                onClick={() => compositionStore.SetFilter("")}
                to={UrlJoin("/compositions", rootStore.selectedObjectId, key)}
                className={S("composition-browser__item")}
              >
                <span>
                  <Icon icon={MediaIcon} />
                  { compositionStore.myCompositions[rootStore.selectedObjectId]?.[key]?.name || label }
                </span>
                <span>
                  <IconButton
                    icon={DeleteIcon}
                    label="Delete Composition"
                    disabled={deleting}
                    faded
                    small
                    loading={deleting === key}
                    onClick={async event => {
                      event.stopPropagation();
                      event.preventDefault();

                      await Confirm({
                        title: "Delete Composition",
                        text: `Are you sure you want to delete the composition '${label}'?`,
                        onConfirm: async () => {
                          setDeleting(key);
                          try {
                            await compositionStore.DeleteComposition({
                              objectId: rootStore.selectedObjectId,
                              compositionKey: key
                            });
                          } finally {
                            setDeleting(false);
                          }
                        }
                      });
                    }}
                  />
                </span>
              </Linkish>
            )}
          </div>
      }
    </div>
  );
});
