import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Input} from "@/components/common/Common.jsx";
import {useDebouncedState} from "@mantine/hooks";
import {rootStore, assetStore, compositionStore, tagStore, trackStore} from "@/stores/index.js";
import {TagDetails, TagsList} from "@/components/side_panel/Tags.jsx";
import Assets, {AssetTagDetails, AssetTagsList} from "@/components/side_panel/Assets.jsx";
import {TrackDetails} from "@/components/side_panel/Tracks.jsx";

import {OverlayTagDetails, OverlayTagsList} from "@/components/side_panel/OverlayTags.jsx";
import {CompositionClips} from "@/components/side_panel/Compositions.jsx";
import {Switch} from "@mantine/core";
import {useLocation} from "wouter";

const S = CreateModuleClassMatcher(SidePanelStyles);

const SidebarFilter = observer(({store, label, showTagSwitch=false}) => {
  const [filter, setFilter] = useDebouncedState(store.filter, 100);
  const [, navigate] = useLocation();

  useEffect(() => {
    store.SetFilter(filter);
  }, [filter]);

  return (
    <div className={S("search")}>
      <Input
        placeholder={label}
        h={35}
        defaultValue={filter}
        onChange={event => setFilter(event.currentTarget.value)}
        aria-label={label}
        className={S("search__input")}
      />
      {
        !showTagSwitch ? null :
          <div className={S("search__toggle")}>
            <label>Generated</label>
            <Switch
              color="var(--color-highlight)"
              size="xs"
              checked={rootStore.page === "clips"}
              onChange={event => navigate(event.currentTarget.checked ? "/my-tags" : "/tags")}
            />
            <label>My Clips</label>
          </div>
      }
    </div>
  );
});

const TrackSelection = observer(({mode="tags"}) => {
  let tracks, activeTracks, Toggle;
  switch(mode) {
    case "tags":
      activeTracks = trackStore.activeTracks;
      Toggle = key => trackStore.ToggleTrackSelected(key);
      tracks = trackStore.metadataTracks;
      break;
    case "clips":
      activeTracks = trackStore.activeClipTracks;
      Toggle = key => trackStore.ToggleClipTrackSelected(key);
      tracks = trackStore.clipTracks;
      break;
    case "assets":
      activeTracks = assetStore.activeTracks;
      Toggle = key => assetStore.ToggleTrackSelected(key);
      tracks = assetStore.tracks;
      break;
  }

  return (
    <div className={S("tracks")}>
      <div className={S("tracks__content")}>
        {
          tracks.map(track =>
            <button
              key={`track-${track.trackId}`}
              onClick={() => Toggle(track.key)}
              className={S("track", activeTracks[track.key] ? "track--selected" : "")}
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

export const TagSidePanel = observer(({setElement}) => {
  return (
    <div ref={setElement} className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter showTagSwitch store={tagStore} label="Search within tags" />
        <TrackSelection mode="tags" />
        <TagsList mode="tags" />

        {
          tagStore.selectedOverlayTags.length === 0 ? null :
            <div className={S("side-panel-modal")}>
              <OverlayTagsList />
            </div>
        }
        {
          !tagStore.selectedTrackId && !tagStore.selectedTagId && !tagStore.selectedOverlayTagId ? null :
            <div className={S("side-panel-modal")}>
              {
                tagStore.selectedOverlayTagId ?
                  <OverlayTagDetails /> :
                  tagStore.selectedTrackId ?
                    <TrackDetails /> :
                    <TagDetails />
              }
            </div>
        }
      </div>
    </div>
  );
});

export const ClipSidePanel = observer(({setElement}) => {
  return (
    <div ref={setElement} className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter showTagSwitch store={tagStore} label="Search clips" />
        <TrackSelection mode="clips" />
        <TagsList mode="clips" />

        {
          !tagStore.selectedTrackId && !tagStore.selectedTagId ? null :
            <div className={S("side-panel-modal")}>
              {
                tagStore.selectedOverlayTagId ?
                  <OverlayTagDetails/> :
                  tagStore.selectedTrackId ?
                    <TrackDetails/> :
                    <TagDetails/>
              }
            </div>
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
        <TrackSelection mode="assets" />
        <Assets />
      </div>

      {
        assetStore.selectedTags.length === 0 ? null :
          <div className={S("side-panel-modal")}>
            <AssetTagsList />
          </div>
      }
      {
        !assetStore.selectedTag ? null :
          <div className={S("side-panel-modal")}>
            <AssetTagDetails />
          </div>
      }
    </div>
  );
});

export const CompositionSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter store={compositionStore} label="Search Clips"/>
        <CompositionClips />
      </div>
    </div>
  );
});
