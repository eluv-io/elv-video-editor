import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Input} from "@/components/common/Common.jsx";
import {useDebouncedState} from "@mantine/hooks";
import {rootStore, tagStore, tracksStore, videoStore} from "@/stores/index.js";

import SearchIcon from "@/assets/icons/v2/search.svg";
import {Tooltip} from "@mantine/core";

const S = CreateModuleClassMatcher(SidePanelStyles);

const TagSearch = observer(() => {
  const [filter, setFilter] = useDebouncedState(tagStore.filter, 100);

  useEffect(() => {
    tagStore.SetFilter(filter);
  }, [filter]);

  return (
    <div className={S("search")}>
      <Input
        placeholder="Search within tags"
        defaultValue={filter}
        onChange={event => setFilter(event.currentTarget.value)}
        aria-label="Search within tags"
        className={S("search__input")}
        rightIcon={SearchIcon}
      />
    </div>
  );
});

const Tracks = observer(() => {
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
          tracksStore.metadataTracks.map(track =>
            <button
              key={`track-${track.key}`}
              onClick={() => tagStore.ToggleTrackSelected(track.key)}
              className={S("track", tagStore.selectedTracks[track.key] ? "track--selected" : "")}
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

const Tag = observer(({track, tag}) => {
  const color = track.color;

  return (
    <div
      onMouseEnter={() => tagStore.SetHoverTags([tag.tagId], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      onMouseLeave={() => tagStore.SetHoverTags([], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      className={S("tag", tracksStore.thumbnailsLoaded ? "tag--thumbnail" : "")}
    >
      <div
        style={{backgroundColor: `rgb(${color?.r} ${color?.g} ${color?.b}`}}
        className={S("tag__color")}
      />
      {
        !tracksStore.thumbnailsLoaded ? null :
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
          { track.label }
        </div>
        <div className={S("tag__time")}>
          <span>{videoStore.TimeToSMPTE(tag.startTime)}</span>
          <span>-</span>
          <span>{videoStore.TimeToSMPTE(tag.endTime)}</span>
        </div>
      </div>
    </div>
  );
});

const Tags = observer(() => {
  const ref = useRef(null);
  const [tags, setTags] = useState([]);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [limit, setLimit] = useDebouncedState(100, 250);

  useEffect(() => {
    // Reset limit when tag content changes
    setLimit(100);

    if(ref.current) {
      ref.current.scrollTop = 0;
    }

    setUpdate(update + 1);
  }, [
    tagStore.filter,
    Object.keys(tagStore.selectedTracks).length,
    videoStore.scaleMax,
    videoStore.scaleMin,
    tracksStore.tracks.length
  ]);

  useEffect(() => {
    setTags(
      tagStore.Tags({startFrame: videoStore.scaleMinFrame, endFrame: videoStore.scaleMaxFrame, limit})
    );
  }, [update]);

  let tracks = {};
  tracksStore.metadataTracks.forEach(track => tracks[track.key] = track);

  return (
    <div
      ref={ref}
      onScroll={event => {
        if(event.currentTarget.scrollTop > event.currentTarget.scrollHeight * 0.86) {
          setLimit(limit + 100);
          setUpdate(update + 1);
        }
      }}
      className={S("tags")}
    >
      { tags.map(tag => <Tag key={`tag-${tag.tagId}`} track={tracks[tag.trackKey]} tag={tag} />) }
    </div>
  );
});


const SidePanel = observer(() => {
  const ref = useRef(null);

  useEffect(() => {
    if(!ref?.current) { return; }

    const resizeObserver = new ResizeObserver(() =>
      rootStore.SetSidePanelDimensions(ref.current.getBoundingClientRect())
    );

    resizeObserver.observe(ref.current);

    return () => resizeObserver?.disconnect();
  }, [ref]);

  return (
    <div
      ref={ref}
      style={{
        "--panel-height": `${rootStore.sidePanelDimensions.height}px`,
        "--panel-width": `${rootStore.sidePanelDimensions.width}px`
      }}
      className={S("content-block", "side-panel-section")}
    >
      <div className={S("side-panel")}>
        <TagSearch />
        <Tracks />
        <Tags />
      </div>
    </div>
  );
});

export default SidePanel;
