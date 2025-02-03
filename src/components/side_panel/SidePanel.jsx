import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {IconButton, Input, Linkish, LoaderImage} from "@/components/common/Common.jsx";
import {useDebouncedState} from "@mantine/hooks";
import {assetStore, rootStore, tagStore, tracksStore, videoStore} from "@/stores/index.js";
import {Tooltip} from "@mantine/core";

import SearchIcon from "@/assets/icons/v2/search.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import UrlJoin from "url-join";
import {useParams} from "wouter";

const S = CreateModuleClassMatcher(SidePanelStyles);

const SidebarFilter = observer(({store, label}) => {
  const [filter, setFilter] = useDebouncedState(store.filter, 100);

  useEffect(() => {
    store.SetFilter(filter);
  }, [filter]);

  return (
    <div className={S("search")}>
      <Input
        placeholder={label}
        defaultValue={filter}
        onChange={event => setFilter(event.currentTarget.value)}
        aria-label={label}
        className={S("search__input")}
        rightIcon={SearchIcon}
      />
    </div>
  );
});

const TrackSelection = observer(({store}) => {
  const ref = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [hovering, setHovering] = useDebouncedState(false, 250);
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    if(!ref?.current) { return; }

    const resizeObserver = new ResizeObserver(() => {
      setContentHeight(ref.current.getBoundingClientRect().height + 20);
    });

    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  useEffect(() => {
    if(hovering) {
      const showScrollTimeout = setTimeout(() => setShowScroll(true), 100);

      return () => clearTimeout(showScrollTimeout);
    } else {
      setShowScroll(false);
    }
  }, [hovering]);

  const willScroll = contentHeight > 90;
  const willScrollExpanded = contentHeight > rootStore.sidePanelDimensions.height * 0.4;

  const tracks = store.metadataTracks || store.assetTracks;

  return (
    <div
      style={{"--content-height": `${contentHeight}px`}}
      className={S("tracks", willScroll && hovering ? "tracks--hover" : "", willScrollExpanded && showScroll ? "tracks--show-scroll" : "")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {
        !willScroll ? null :
          <div className={S("tracks__cover")} />
      }
      <div ref={ref} className={S("tracks__content")}>
        {
          tracks.map(track =>
            <button
              key={`track-${track.key}`}
              onClick={() => store.ToggleTrackSelected(track.key)}
              className={S("track", store.selectedTracks[track.key] ? "track--selected" : "")}
            >
              <div
                style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
                className={S("track__color")}
              />
              <div className={S("track__label")}>{ track.label }</div>
            </button>
          )
        }
      </div>
    </div>
  );
});

// Infinite scroll
const SidebarScrollContent = observer(({watchList=[], children, batchSize=10, Update, className=""}) => {
  const ref = useRef(null);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [limit, setLimit] = useDebouncedState(batchSize, 250);

  useEffect(() => {
    // Reset limit when tag content changes
    setLimit(batchSize);

    if(ref.current) {
      ref.current.scrollTop = 0;
    }

    setUpdate(update + 1);
  }, [
    ...watchList,
    videoStore.scaleMax,
    videoStore.scaleMin,
    tracksStore.tracks.length
  ]);

  useEffect(() => {
    Update(limit);
  }, [update]);

  return (
    <div
      ref={ref}
      onScroll={event => {
        if(event.currentTarget.scrollTop + event.currentTarget.offsetHeight > event.currentTarget.scrollHeight * 0.86) {
          setLimit(limit + batchSize);
          setUpdate(update + 1);
        }
      }}
      className={className}
    >
      { children }
    </div>
  );
});


/* Metadata tags */

const Tag = observer(({track, tag}) => {
  const color = track.color;

  return (
    <div
      onClick={() => tagStore.SetTags(track.trackId, tag.tagId, tag.startTime)}
      onMouseEnter={() => tagStore.SetHoverTags([tag.tagId], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      onMouseLeave={() => tagStore.SetHoverTags([], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      className={
        S(
          "tag",
          tracksStore.thumbnailStatus.available ? "tag--thumbnail" : "",
          tagStore.selectedTagIds.includes(tag.tagId) ? "tag--selected" : "",
          tagStore.hoverTags.includes(tag.tagId) ? "tag--hover" : ""
        )
      }
    >
      <div
        style={{backgroundColor: `rgb(${color?.r} ${color?.g} ${color?.b}`}}
        className={S("tag__color")}
      />
      <div className={S("tag__left")}>
        {
          !tracksStore.thumbnailStatus.available ? null :
            <img
              src={tracksStore.ThumbnailImage(tag.startTime)}
              style={{aspectRatio: videoStore.aspectRatio}}
              className={S("tag__image")}
            />
        }
        <div className={S("tag__text")}>
          <Tooltip.Floating
            position="top"
            offset={20}
            label={
              tag.content ?
                <pre className={S("tag__tooltip", "tag__tooltip--json")}>{JSON.stringify(tag.content, null, 2)}</pre> :
                <div className={S("tag__tooltip")}>{tag.textList.join(", ")}</div>
            }
          >
            <div className={S("tag__content", `tag__content--${tag.content ? "json" : "text"}`)}>
              {
                tag.content ?
                  JSON.stringify(tag.content) :
                  tag.textList.join(", ")
              }
            </div>
          </Tooltip.Floating>
          <div className={S("tag__track")}>
            {track.label}
          </div>
          <div className={S("tag__time")}>
            <span>{videoStore.TimeToSMPTE(tag.startTime)}</span>
            <span>-</span>
            <span>{videoStore.TimeToSMPTE(tag.endTime)}</span>
            <span>({ parseFloat((tag.endTime - tag.startTime).toFixed(2))}s)</span>
          </div>
        </div>
      </div>
      <div className={S("tag__actions")}>
        <IconButton
          label="Play Tag"
          icon={PlayIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.SetTags(track.trackId, tag.tagId, tag.startTime);
            tagStore.PlayTag(tag);
          }}
        />
      </div>
    </div>
  );
});

const Tags = observer(() => {
  const [tags, setTags] = useState([]);
  let tracks = {};
  tracksStore.metadataTracks.forEach(track => tracks[track.key] = track);

  return (
    <SidebarScrollContent
      watchList={[
        tagStore.filter,
        Object.keys(tracksStore.selectedTracks).length
      ]}
      className={S("tags")}
      Update={limit =>
        setTags(
          tagStore.Tags({
            startFrame: videoStore.scaleMinFrame,
            endFrame: videoStore.scaleMaxFrame,
            limit
          })
        )
      }
    >
      { tags.map(tag => <Tag key={`tag-${tag.tagId}`} track={tracks[tag.trackKey]} tag={tag} />) }
    </SidebarScrollContent>
  );
});


/* Assets */

const Asset = observer(({asset, selected}) => {
  return (
    <Linkish
      to={UrlJoin("/assets", asset.key)}
      className={S("asset", selected ? "asset--selected" : "")}
    >
      <LoaderImage
        lazy={false}
        loaderDelay={0}
        loaderAspectRatio={1}
        src={assetStore.AssetLink(asset.key, {width: 400})}
        className={S("asset__image")}
      />
      <div className={S("asset__name")}>
        { asset.key }
      </div>
    </Linkish>
  );
});

const AssetList = observer(() => {
  const [assets, setAssets] = useState([]);
  const { assetKey } = useParams();

  return (
    <SidebarScrollContent
      watchList={[
        assetStore.filter,
        Object.keys(assetStore.selectedTracks).length
      ]}
      batchSize={30}
      className={S("assets")}
      Update={limit =>
        setAssets(assetStore.filteredAssetList.slice(0, limit))
      }
    >
      {
        assets.map(asset =>
          <Asset
            selected={asset.key === assetKey}
            asset={asset}
            key={asset.key}
          />
        )
      }
    </SidebarScrollContent>
  );
});

export const TagSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter store={tagStore} label="Search within tags" />
        <TrackSelection store={tracksStore} />
        <Tags />
      </div>
    </div>
  );
});

export const AssetSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter store={assetStore} label="Search assets" />
        <TrackSelection store={assetStore} />
        <AssetList />
      </div>
    </div>
  );
});
