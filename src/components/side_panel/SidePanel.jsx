import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Icon, IconButton, Input} from "@/components/common/Common.jsx";
import {useDebouncedState} from "@mantine/hooks";
import {rootStore, assetStore, compositionStore, tagStore, trackStore} from "@/stores/index.js";
import {TagDetails, TagsList} from "@/components/side_panel/Tags.jsx";
import Assets, {AssetTagDetails, AssetTagsList} from "@/components/side_panel/Assets.jsx";
import {TrackDetails} from "@/components/side_panel/Tracks.jsx";

import {OverlayTagDetails, OverlayTagsList} from "@/components/side_panel/OverlayTags.jsx";
import {CompositionBrowser, CompositionClips} from "@/components/side_panel/Compositions.jsx";
import {Combobox, Menu, PillsInput, Switch, useCombobox} from "@mantine/core";
import {useLocation} from "wouter";

import SelectArrowsIcon from "@/assets/icons/v2/select-arrows.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import SettingsIcon from "@/assets/icons/v2/settings.svg";

const S = CreateModuleClassMatcher(SidePanelStyles);

const TagSwitch = observer(() => {
  const [, navigate] = useLocation();

  return (
    <div className={S("search__toggle")}>
      <label>Generated</label>
      <Switch
        color="var(--color-highlight)"
        size="xs"
        checked={rootStore.page === "clips"}
        classNames={{track: S("search__toggle-bg")}}
        onChange={event => navigate(event.currentTarget.checked ? "/my-tags" : "/tags")}
      />
      <label>My Clips</label>
    </div>
  );
});

const SearchIndexSelection = observer(() => {
  const [showMenu, setShowMenu] = useState(false);
  if(rootStore.searchIndexes.length === 0) { return null; }

  return (
    <Menu
      opened={showMenu}
      onChange={setShowMenu}
      shadow="md"
      width={250}
      offset={15}
      position="bottom-end"
    >
      <Menu.Target>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={S("search__button")}
        >
          <Icon icon={SettingsIcon} />
        </button>
      </Menu.Target>

      <Menu.Dropdown bg="var(--background-toolbar)">
        <div className={S("search__index-menu")}>
          <div className={S("search__index-title")}>
            Search Index
          </div>
          {
            rootStore.searchIndexes.map(index =>
              <button
                key={`index-${index.id}`}
                onClick={() => {
                  rootStore.SetSelectedSearchIndex(index.id);
                  setShowMenu(false);
                }}
                className={S("search__index-option", rootStore.selectedSearchIndexId === index.id ? "search__index-option--active" : "")}
              >
                <div className={S("search__index-option-name")}>
                  { index.name || index.id }
                </div>
                {
                  !index.name ? null :
                    <div className={S("search__index-option-id")}>
                      { index.id }
                    </div>
                }
              </button>
            )
          }
        </div>
      </Menu.Dropdown>
    </Menu>
  );
});

const SidebarFilter = observer(({store, label, sideContent}) => {
  const [filter, setFilter] = useDebouncedState(store.filter, 100);

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
        rightSection={sideContent}
        rightSectionWidth="max-content"
      />
    </div>
  );
});

const TrackSelection = observer(({mode = "tags"}) => {
  const [optionsElement, setOptionsElement] = useState(undefined);
  const [scroll, setScroll] = useState(false);

  useEffect(() => {
    if(!optionsElement) { return; }

    const resizeObserver = new ResizeObserver(() =>
      setScroll(optionsElement.scrollHeight > 200)
    );

    resizeObserver.observe(optionsElement);

    return () => resizeObserver.disconnect();
  }, [optionsElement]);


  let tracks, activeTracks, Toggle;
  switch(mode) {
    case "tags":
      activeTracks = trackStore.activeTracks;
      Toggle = (key, value) => trackStore.ToggleTrackSelected(key, value);
      tracks = trackStore.metadataTracks;
      break;
    case "clips":
      activeTracks = trackStore.activeClipTracks;
      Toggle = (key, value) => trackStore.ToggleClipTrackSelected(key, value);
      tracks = trackStore.clipTracks;
      break;
    case "assets":
      activeTracks = assetStore.activeTracks;
      Toggle = (key, value) => assetStore.ToggleTrackSelected(key, value);
      tracks = assetStore.tracks;
      break;
  }


  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  const selectedTracks = Object.keys(activeTracks).map(trackKey => {
    const track = tracks.find(track => track.key === trackKey);

    return (
      <div
        key={trackKey}
        className={S("track-option", "track-option--pill")}
      >
        <div
          style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
          className={S("track-option__color")}
        />
        <span>{track.label}</span>
        <IconButton
          icon={XIcon}
          small
          faded
          label="Remove"
          onClick={event => {
            event.stopPropagation();
            Toggle(trackKey, false);
          }}
        />
      </div>
    );
  });

  const options = tracks
    .filter(track => !activeTracks[track.key])
    .map(track =>
      <Combobox.Option value={track.key} key={track.key}>
        <button onClick={() => Toggle(track.key, true)} className={S("track-option")}>
          <div
            style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
            className={S("track-option__color")}
          />
          <span>{track.label}</span>
        </button>
      </Combobox.Option>
    );

  return (
    <Combobox
      offset={3}
      store={combobox}
      onOptionSubmit={trackKey => Toggle(trackKey, true)}
      classNames={{
        dropdown: S("track-options__dropdown"),
      }}
    >
      <Combobox.DropdownTarget>
        <button
          ref={setOptionsElement}
          role="menu"
          onClick={() => combobox.toggleDropdown()}
          style={!scroll ? undefined : {maxHeight: 200, overflowY: "auto"}}
          className={S("track-options")}
        >
          {
            selectedTracks.length > 0 ?
              selectedTracks :
              <div className={S("track-options__placeholder")}>
                <span>Filter by Category</span>
                <Icon icon={SelectArrowsIcon} />
              </div>
          }

          {
            selectedTracks.length === 0 ? null :
              <IconButton
                icon={XIcon}
                label="Clear"
                onClick={event => {
                  event.stopPropagation();

                  Object.keys(activeTracks).forEach(trackKey =>
                    Toggle(trackKey, false)
                  );
                }}
                faded
                small
                className={S("track-options__clear")}
              />
          }

          <Combobox.EventsTarget>
            <PillsInput.Field
              type="hidden"
              onBlur={() => combobox.closeDropdown()}
            />
          </Combobox.EventsTarget>
        </button>
      </Combobox.DropdownTarget>

      {
        options.length === 0 ? null :
          <Combobox.Dropdown>
            <Combobox.Options mah={250} style={{ overflowY: "auto" }}>{options}</Combobox.Options>
          </Combobox.Dropdown>
      }
    </Combobox>
  );
});

/* Assets */

export const TagSidePanel = observer(({setElement}) => {
  return (
    <div ref={setElement} className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter sideContent={<TagSwitch />} store={tagStore} label="Search within tags" />
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
        <SidebarFilter sideContent={<TagSwitch />} store={tagStore} label="Search clips" />
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
        <SidebarFilter sideContent={<SearchIndexSelection />} store={compositionStore} label="Search Clips"/>
        <CompositionClips />
      </div>
    </div>
  );
});

export const CompositionBrowserPanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter key="composition-browser" store={compositionStore} label="Search Compositions" />
        <CompositionBrowser />
      </div>
    </div>
  );
});
