import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {CopyableField, Icon, IconButton, Input, Modal} from "@/components/common/Common.jsx";
import {rootStore, assetStore, compositionStore, tagStore, trackStore, aiStore} from "@/stores/index.js";
import {TagDetails, TagsList} from "@/components/side_panel/Tags.jsx";
import Assets from "@/components/side_panel/Assets.jsx";
import {TrackDetails} from "@/components/side_panel/Tracks.jsx";

import {
  GroundTruthAssetFromOverlayForm,
  OverlayTagDetails,
  OverlayTagsList
} from "@/components/side_panel/OverlayTags.jsx";
import {CompositionBrowser, CompositionClips} from "@/components/side_panel/Compositions.jsx";
import {Combobox, Menu, PillsInput, Switch, Tooltip, useCombobox} from "@mantine/core";
import {useLocation} from "wouter";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";

import SelectArrowsIcon from "@/assets/icons/v2/select-arrows.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import SourcesIcon from "@/assets/icons/v2/folder.svg";
import SearchIcon from "@/assets/icons/v2/search.svg";
import SettingsIcon from "@/assets/icons/v2/settings.svg";
import SearchSettings from "@/components/search/SearchSettings.jsx";

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
        onChange={event => navigate(event.currentTarget.checked ? "/clips" : "/tags")}
      />
      <label>Clips</label>
    </div>
  );
});

const SourceSelectionModal = observer(({Select, Cancel}) => {
  const [libraryId, setLibraryId] = useState(undefined);

  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      {
        libraryId ?
          <ObjectBrowser
            withFilterBar
            filterQueryParam="source"
            libraryId={libraryId}
            videoOnly
            Back={() => setLibraryId(undefined)}
            Select={({objectId, name}) => Select({objectId, name})}
            className={S("search__source-browser")}
          /> :
          <LibraryBrowser
            withFilterBar
            filterQueryParam="source"
            title="Select source content for your composition"
            Select={({libraryId, objectId, name}) => {
              if(objectId) {
                Select({objectId, name});
              } else {
                setLibraryId(libraryId);
              }
            }}
            className={S("search__source-browser")}
          />
      }
    </Modal>
  );
});

const SourceSelection = observer(() => {
  const [showMenu, setShowMenu] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  if(!compositionStore.compositionObject) {
    return null;
  }

  return (
    <>
      <Menu
        opened={showMenu}
        onChange={setShowMenu}
        shadow="md"
        width={250}
        offset={10}
        position="bottom-middle"
      >
        <Menu.Target>
          <Tooltip label="Select Source" disabled={showMenu} openDelay={500}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={S("search__source-button", showMenu ? "search__source-button--active" : "")}
            >
              <Icon icon={SourcesIcon} />
            </button>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown w={450} radius={10} p={0}>
          <div className={S("search__source-menu")}>
            <div className={S("search__index-title")}>
              Select Source
            </div>
            {
              Object.values(compositionStore.sources).map(({objectId, name}) =>
                <div
                  role="button"
                  tabIndex={0}
                  key={`source-${objectId}`}
                  onClick={() => {
                    compositionStore.SetSelectedSource({objectId});
                    setShowMenu(false);
                  }}
                  className={S("search__source-option", compositionStore.selectedSourceId === objectId ? "search__source-option--active" : "")}
                >
                  <Tooltip label={name}>
                    <div className={S("search__source-text")}>
                      <div className={S("search__source-option-name")}>
                        {name}
                      </div>
                      <div className={S("search__source-option-id", "ellipsis")}>
                        <CopyableField value={objectId} />
                      </div>
                    </div>
                  </Tooltip>
                </div>
              )
            }
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowBrowser(true);
                setShowMenu(false);
              }}
              className={S("search__source-option", "search__source-add")}
            >
              Add Source
            </div>
          </div>
        </Menu.Dropdown>
      </Menu>
      {
        !showBrowser ? null :
          <SourceSelectionModal
            Select={async ({objectId}) => {
              setShowBrowser(false);
              await compositionStore.AddSource({objectId});
            }}
            Cancel={() => setShowBrowser(false)}
          />
      }
    </>
  );
});

const SidebarFilter = observer(({store, label, sideContent, rightSideContent, beforeContent, afterContent, className=""}) => {
  const [filter, setFilter] = useState(store.filter);

  return (
    <div className={JoinClassNames(S("search"), className)}>
      {beforeContent}
      <Input
        placeholder={label}
        h={35}
        value={filter}
        onChange={event => setFilter(event.currentTarget.value)}
        onKeyDown={async event =>
          event.key === "Enter" && store.SetFilter(filter)
        }
        aria-label={label}
        className={S("search__input", sideContent ? "search__input--with-side-content" : "")}
        leftSection={
          <div className={S("search__buttons")}>
            {sideContent}
          </div>
        }
        rightSection={
          <div className={S("search__buttons")}>
            <IconButton
              noHover
              icon={SearchIcon}
              onClick={() => store.SetFilter(filter)}
            />
            {
              !filter ? null :
                <IconButton
                  noHover
                  icon={XIcon}
                  onClick={() => {
                    setFilter("");
                    store.SetFilter("");
                  }}
                />
            }
            {rightSideContent }
          </div>

        }
        leftSectionWidth="max-content"
        rightSectionWidth="max-content"
      />
      { afterContent }
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

    if(!track) { return null; }

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
        <SidebarFilter delay={1000} rightSideContent={<TagSwitch />} store={tagStore} label="Search within tags" />
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
                  <OverlayTagDetails/> :
                  tagStore.selectedTrackId ?
                    <TrackDetails/> :
                    <TagDetails/>
              }
            </div>
        }
        {
          !tagStore.editedGroundTruthAsset ? null :
            <div className={S("side-panel-modal")}>
              <GroundTruthAssetFromOverlayForm Close={() => tagStore.ClearEditing()} />
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
        <SidebarFilter rightSideContent={<TagSwitch />} store={tagStore} label="Search clips" />
        <TrackSelection mode="clips" />
        <TagsList mode="clips" />
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
    </div>
  );
});

export const CompositionSearchSettings = observer(() => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  return (
    <>
      <div
        className={S("side-panel__search-icon", aiStore.customSearchSettingsActive ? "side-panel__search-icon--active" : "")}
      >
        <IconButton
          onClick={() => setShowSettingsModal(true)}
          icon={SettingsIcon}
        />
      </div>
      {
        !showSettingsModal ? null :
          <SearchSettings
            store={compositionStore}
            singleObject
            Close={() => setShowSettingsModal(false)}
          />
      }
    </>
  );
});

export const CompositionSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter
          beforeContent={<CompositionSearchSettings/>}
          afterContent={<SourceSelection />}
          store={compositionStore}
          label="Search"
          className={S("search--ai")}
        />
        <CompositionClips />
      </div>
    </div>
  );
});

export const CompositionBrowserPanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter
          key="composition-browser"
          store={compositionStore}
          label="Filter Compositions"
          className={S("search__input--filter")}
        />
        <CompositionBrowser />
      </div>
    </div>
  );
});
