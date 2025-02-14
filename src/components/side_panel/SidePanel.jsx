import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Input} from "@/components/common/Common.jsx";
import {useDebouncedState} from "@mantine/hooks";
import {assetStore, rootStore, tagStore, trackStore} from "@/stores/index.js";

import SearchIcon from "@/assets/icons/v2/search.svg";
import {TagDetails, TagsList} from "@/components/side_panel/Tags.jsx";
import Assets from "@/components/side_panel/Assets.jsx";

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
      setContentHeight(ref.current.getBoundingClientRect().height + 55);
    });

    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  useEffect(() => {
    if(hovering) {
      const showScrollTimeout = setTimeout(() => setShowScroll(true), 100);

      return () => clearTimeout(showScrollTimeout);
    } else {
      ref?.current?.parentElement?.scrollTo({top: 0});
      setShowScroll(false);
    }
  }, [ref, hovering]);

  const willScroll = contentHeight > 140;
  const willScrollExpanded = contentHeight > rootStore.sidePanelDimensions.height * 0.3;

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

/* Assets */

export const TagSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter store={tagStore} label="Search within tags" />
        <TrackSelection store={trackStore} />
        <TagsList />

        {
          !tagStore.selectedTagId ? null :
            <TagDetails />
        }
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
        <Assets />
      </div>
    </div>
  );
});
