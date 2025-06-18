import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, DragHandler, StorageHandler} from "@/utils/Utils.js";
import {aiStore, browserStore, compositionStore, rootStore, trackStore} from "@/stores/index.js";
import {ClipTimeInfo, Confirm, CopyableField, Icon, IconButton, Linkish, Loader} from "@/components/common/Common.jsx";
import {Tooltip} from "@mantine/core";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import UrlJoin from "url-join";
import {ClipTooltipContent} from "@/components/compositions/Clips.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";

import ClipIcon from "@/assets/icons/v2/clip.svg";
import VideoIcon from "@/assets/icons/v2/video.svg";
import CompositionIcon from "@/assets/icons/v2/composition.svg";
import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import XIcon from "@/assets/icons/X.svg";
import TagIcon from "@/assets/icons/v2/tag.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import ChevronUpIcon from "@/assets/icons/chevron-up.svg";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import BackIcon from "@/assets/icons/v2/back.svg";

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
  showTagLinks,
  showEmpty
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

  if(clips.length === 0 && !loading && !showEmpty) {
    return null;
  }

  const hidden = hide || (!loading && (!clips || clips.length === 0));

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
         hidden ? (showEmpty ? <div className={S("clip-group__empty")}>No Results</div> : null) :
          loading ? <Loader className={S("clip-group__loader")} /> :
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
    compositionStore.searchClipIds[compositionStore.selectedSourceId] || [] :
    compositionStore.selectedSource?.highlightClipIds || [];

  useEffect(() => {
    if(!compositionStore.filter) {
      setLoading(false);
      setClipSource("highlights");
      return;
    }

    setLoading(true);

    const selectedSourceId = compositionStore.selectedSourceId;

    compositionStore.SearchClips({
      objectId: compositionStore.selectedSourceId,
      query: compositionStore.filter
    })
      .finally(() => {
        if(selectedSourceId !== compositionStore.selectedSourceId) {
          // Source has changed
          return;
        }

        setClipSource("search");
        setLoading(false);
      });
  }, [compositionStore.filter, aiStore.selectedSearchIndexId, compositionStore.selectedSourceId]);

  return  (
    <ClipGroup
      key={`ai-clips-${compositionStore.selectedSourceId}`}
      noFilter
      groupKey="ai"
      icon={AISparkleIcon}
      showTagLinks
      title={compositionStore.filter ? "Results" : "Suggestions"}
      subtitle={!compositionStore.filter ? "Prompt" : ""}
      clipIds={clipIds}
      loading={loading}
      showEmpty
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
            color={trackStore.TrackColor(category, "clip")}
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
  const [selectedObjectInfo, setSelectedObjectInfo] = useState(undefined);
  const [myLibraryInfo, setMyLibraryInfo] = useState({content: []});
  const [deleting, setDeleting] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState(rootStore.selectedObjectId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(deleting) { return; }

    setSelectedObjectInfo(undefined);

    if(selectedObjectId) {
      setLoading(true);
      browserStore.LookupContent(selectedObjectId)
        .then(info => setSelectedObjectInfo(info))
        .finally(() => setLoading(false));
    }
  }, [selectedObjectId, deleting]);

  let compositions = myLibraryInfo.content;
  if(selectedObjectId) {
    if(!selectedObjectInfo) {
      return <Loader />;
    }

    // Specific object selected
    compositions = [
      {
        id: "",
        label: `Main Content - ${selectedObjectInfo.name}`,
        objectId: selectedObjectInfo.objectId,
        lastModified: selectedObjectInfo.lastModified,
        compositionKey: ""
      },
      ...(selectedObjectInfo.channels || [])
    ]
      .map(composition => ({
        ...composition,
        name:
          compositionStore.myCompositions[composition.objectId]?.[composition.compositionKey]?.name ||
          composition.name ||
          composition.label ||
          composition.compositionKey
      }))
      .filter(({name, compositionKey}) =>
        !compositionStore.filter ||
        name.toLowerCase().includes(compositionStore.filter.toLowerCase()) ||
        compositionKey.toLowerCase().includes(compositionStore.filter.toLowerCase())
      );
  }

  return (
    <>
      <div className={S("composition-browser-header")}>
        {
          !selectedObjectId ? "My Compositions" :
            <>
              <IconButton
                faded
                icon={BackIcon}
                label="Back to My Compositions"
                onClick={() => {
                  setSelectedObjectInfo(undefined);
                  setSelectedObjectId(undefined);
                }}
              />
              <span className={S("ellipsis")}>{selectedObjectInfo?.name}</span>
            </>
        }
      </div>
      <div className={S("composition-browser")}>
        <InfiniteScroll
          watchList={[selectedObjectId]}
          batchSize={5}
          className={S("composition-browser__content")}
          Update={async limit => {
            if(
              selectedObjectId ||
              (myLibraryInfo.paging && myLibraryInfo.paging.start >= myLibraryInfo.content.length)
            ) { return; }

            setLoading(true);

            try {
              const {content, paging} = await browserStore.ListMyLibrary({
                start: myLibraryInfo.content.length,
                limit,
                type: "composition"
              });

              setMyLibraryInfo({
                content: [...myLibraryInfo.content, ...content],
                paging
              });
            } catch(error) {
              // eslint-disable-next-line no-console
              console.error(error);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className={S("composition-browser__header", "composition-browser__item")}>
            <span />
            <span>Name</span>
            <span>Last Modified</span>
            <span />
          </div>

          {compositions.map(({name, objectId, compositionKey, lastModified}) =>
            <Linkish
              disabled={deleting}
              key={compositionKey}
              onClick={() => compositionStore.SetFilter("")}
              to={
                !compositionKey ?
                  UrlJoin("/", objectId) :
                  UrlJoin("/compositions", objectId, compositionKey)
              }
              className={S("composition-browser__item")}
            >
              <Icon
                icon={compositionKey ? CompositionIcon : VideoIcon}
                className={S("composition-browser__item-icon")}
              />
              <Tooltip openDelay={500} label={name || compositionKey}>
                <div className={S("ellipsis")}>
                  <div className={S("composition-browser__item-name", "ellipsis")}>
                    { name || compositionKey }
                  </div>
                  <div className={S("composition-browser__item-id")}>
                    <CopyableField value={objectId} showOnHover />
                  </div>
                </div>
              </Tooltip>
              <span>
                {lastModified}
              </span>
              <span>
                {
                  !compositionKey ? null :
                    <IconButton
                      icon={DeleteIcon}
                      label="Delete Composition"
                      disabled={deleting}
                      faded
                      small
                      loading={deleting === compositionKey}
                      onClick={async event => {
                        event.stopPropagation();
                        event.preventDefault();

                        await Confirm({
                          title: "Delete Composition",
                          text: `Are you sure you want to delete the composition '${name}'?`,
                          onConfirm: async () => {
                            setDeleting(compositionKey);

                            try {
                              await compositionStore.DeleteComposition({
                                objectId,
                                compositionKey
                              });

                              setMyLibraryInfo({content: []});
                            } finally {
                              setDeleting(false);
                            }
                          }
                        });
                      }}
                    />
                }
              </span>
            </Linkish>
          )}
          {
            !loading ? null :
              <Loader className={S("composition-browser__loader")} />
          }
        </InfiniteScroll>
      </div>
    </>
  );
});
