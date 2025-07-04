import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Confirm, CopyableField, Icon, IconButton, Input, Modal} from "@/components/common/Common.jsx";
import {rootStore, assetStore, compositionStore, tagStore, trackStore, aiStore} from "@/stores/index.js";
import {TagDetails, TagsList} from "@/components/side_panel/Tags.jsx";
import Assets from "@/components/side_panel/Assets.jsx";
import {TrackDetails} from "@/components/side_panel/Tracks.jsx";

import {OverlayTagDetails, OverlayTagsList} from "@/components/side_panel/OverlayTags.jsx";
import {CompositionBrowser, CompositionClips} from "@/components/side_panel/Compositions.jsx";
import {Combobox, Menu, PillsInput, RingProgress, Switch, Tooltip, useCombobox} from "@mantine/core";
import {useLocation} from "wouter";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";

import SelectArrowsIcon from "@/assets/icons/v2/select-arrows.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import SettingsIcon from "@/assets/icons/v2/settings.svg";
import UpdateIndexIcon from "@/assets/icons/v2/reload.svg";
import SourcesIcon from "@/assets/icons/v2/folder.svg";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";

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
      <label>My Clips</label>
    </div>
  );
});

const SearchIndexBrowseModal = observer(({Select, Cancel}) => {
  const [libraryId, setLibraryId] = useState(undefined);

  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      {
        libraryId ?
          <ObjectBrowser
            libraryId={libraryId}
            noDuration
            Back={() => setLibraryId(undefined)}
            Select={({objectId, name}) => Select({objectId, name})}
            className={S("search__index-browser")}
          /> :
          <LibraryBrowser
            title="Select search index"
            Select={({libraryId, objectId, name}) => {
              if(objectId) {
                Select({objectId, name});
              } else {
                setLibraryId(libraryId);
              }
            }}
            className={S("search__index-browser")}
          />
      }
    </Modal>
  );
});

const SearchIndexSelection = observer(() => {
  const [updatingIndexes, setUpdatingIndexes] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  if(aiStore.searchIndexes.length === 0) { return null; }

  let indexUpdateProgress;
  updatingIndexes.forEach(indexId => {
    const progress = aiStore.searchIndexUpdateProgress[indexId] || 0;

    indexUpdateProgress = indexUpdateProgress ? Math.min(progress, indexUpdateProgress) : progress;
  });

  if(updatingIndexes.length > 0) {
    indexUpdateProgress = ((indexUpdateProgress || 0) + (aiStore.tagAggregationProgress || 0)) / 2;
  }

  return (
    <>
      {
        !showBrowser ? null :
          <SearchIndexBrowseModal
            Select={async ({objectId}) => {
              await aiStore.AddSearchIndex({objectId});
              setShowBrowser(false);
              setShowMenu(true);
            }}
            Cancel={() => setShowBrowser(false)}
          />
      }
      <Menu
        opened={showMenu}
        onChange={setShowMenu}
        shadow="md"
        width={250}
        offset={15}
        position="bottom-middle"
        zIndex={200}
      >
        <Menu.Target>
          <Tooltip label="Select Search Index" openDelay={500}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={S("search__button")}
            >
              {
                typeof indexUpdateProgress === "undefined" ?
                  <Icon icon={SettingsIcon} /> :
                  <RingProgress
                    size={25}
                    thickness={3}
                    transitionDuration={500}
                    rootColor="var(--text-secondary)"
                    sections={[{value: indexUpdateProgress, color: "var(--color-highlight"}]}
                  />
              }
            </button>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown p={0} w={450} bg="var(--background-toolbar)">
          <div className={S("search__index-menu")}>
            <div className={S("search__index-title")}>
              Search Index
            </div>
            {
              aiStore.searchIndexes.map(index =>
                <div
                  role="button"
                  tabIndex={0}
                  key={`index-${index.id}`}
                  onClick={() => {
                    aiStore.SetSelectedSearchIndex(index.id);
                    setShowMenu(false);
                  }}
                  className={S("search__index-option", aiStore.selectedSearchIndexId === index.id ? "search__index-option--active" : "")}
                >
                  <div className={S("search__index-text")}>
                    <div className={S("search__index-option-name", "ellipsis")}>
                      {index.name || index.id}
                    </div>
                    {
                      !index.name ? null :
                        <div className={S("search__index-option-id")}>
                          <CopyableField value={index.id}/>
                        </div>
                    }
                  </div>
                  <div className={S("search__index-actions")}>
                    {
                      !index.custom ? null :
                        <IconButton
                          label="Remove Search Index"
                          icon={XIcon}
                          onClick={async event => {
                            event.preventDefault();
                            event.stopPropagation();

                            await Confirm({
                              title: "Remove Index",
                              text: "Are you sure you want to remove this search index?",
                              onConfirm: async () => {
                                await aiStore.RemoveSearchIndex({objectId: index.id});
                                setShowMenu(true);
                              },
                              onCancel: () => setShowMenu(true)
                            });
                          }}
                        />
                    }
                    {
                      !index.canEdit ? null :
                        <IconButton
                          label="Update Search Index"
                          icon={UpdateIndexIcon}
                          loadingProgress={
                            !updatingIndexes.includes(index.id) ? undefined :
                              (
                                (aiStore.tagAggregationProgress || 0) +
                                (aiStore.searchIndexUpdateProgress[index.id] || 0)
                              ) / 2
                          }
                          onClick={async event => {
                            event.preventDefault();
                            event.stopPropagation();

                            await Confirm({
                              title: "Remove Tag",
                              text: "Are you sure you want to update this search index?",
                              onCancel: () => setShowMenu(true),
                              onConfirm: async () => {
                                setUpdatingIndexes([...updatingIndexes, index.id]);
                                try {
                                  await aiStore.UpdateSearchIndex({indexId: index.id, aggregate: true});
                                } finally {
                                  setUpdatingIndexes(updatingIndexes.filter(id => id !== index.id));
                                }
                              }
                            });
                          }}
                        />
                    }
                  </div>
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
              className={S("search__index-option")}
            >
              Add Search Index
            </div>
          </div>
        </Menu.Dropdown>
      </Menu>
    </>
  );
});

const SourceSelectionModal = observer(({Select, Cancel}) => {
  const [libraryId, setLibraryId] = useState(undefined);

  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      {
        libraryId ?
          <ObjectBrowser
            libraryId={libraryId}
            videoOnly
            Back={() => setLibraryId(undefined)}
            Select={({objectId, name}) => Select({objectId, name})}
            className={S("search__source-browser")}
          /> :
          <LibraryBrowser
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
          <Tooltip label="Select Source" openDelay={500}>
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
                  <PreviewThumbnail
                    maxThumbnails={10}
                    store={compositionStore.ClipStore({sourceId: objectId})}
                    className={S("search__source-thumbnail")}
                  />
                  <Tooltip label={name}>
                    <div className={S("search__source-text")}>
                      <div className={S("search__source-option-name", "ellipsis")}>
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

let filterTimeout;
const SidebarFilter = observer(({store, label, sideContent, afterContent, delay = 100}) => {
  const [filter, setFilter] = useState(store.filter);

  useEffect(() => {
    clearTimeout(filterTimeout);

    filterTimeout = setTimeout(() => store.SetFilter(filter), delay);
  }, [filter]);

  return (
    <div className={S("search")}>
      <Input
        placeholder={label}
        h={35}
        value={filter}
        onChange={event => setFilter(event.currentTarget.value)}
        aria-label={label}
        className={S("search__input")}
        rightSection={
          <div className={S("search__buttons")}>
            {sideContent}
            {
              !filter ? null :
                <IconButton
                  noHover
                  icon={XIcon}
                  onClick={() => {
                    setFilter("");
                    store.SetFilter("");
                  }}
                  className={S("search__button")}
                />
            }
          </div>
          }
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

export const CompositionSidePanel = observer(() => {
  return (
    <div className={S("content-block", "side-panel-section")}>
      <div className={S("side-panel")}>
        <SidebarFilter
          delay={1500}
          sideContent={<SearchIndexSelection />}
          afterContent={<SourceSelection />}
          store={compositionStore}
          label="Search Clips"
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
          label="Search Compositions"
          sideContent={<SearchIndexSelection />}
        />
        <CompositionBrowser />
      </div>
    </div>
  );
});
