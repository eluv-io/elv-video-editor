import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";

import {observer} from "mobx-react-lite";
import {Confirm, CopyableField, Icon, IconButton, Modal, StyledButton} from "@/components/common/Common.jsx";
import React, {useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import {rootStore, aiStore} from "@/stores/index.js";
import {Button, Checkbox, Slider, TextInput} from "@mantine/core";

import SettingsIcon from "@/assets/icons/v2/settings.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";
import UpdateIndexIcon from "@/assets/icons/v2/reload.svg";

const S = CreateModuleClassMatcher(SearchStyles);


const SearchIndexBrowseModal = observer(({Select, Cancel}) => {
  const [libraryId, setLibraryId] = useState(undefined);

  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      {
        libraryId ?
          <ObjectBrowser
            withFilterBar
            filterQueryParam="index"
            libraryId={libraryId}
            noDuration
            Back={() => setLibraryId(undefined)}
            Select={({objectId, name}) => Select({objectId, name})}
            className={S("index__browser")}
          /> :
          <LibraryBrowser
            withFilterBar
            filterQueryParam="index"
            title="Select search index"
            Select={({libraryId, objectId, name}) => {
              if(objectId) {
                Select({objectId, name});
              } else {
                setLibraryId(libraryId);
              }
            }}
            className={S("index__browser")}
          />
      }
    </Modal>
  );
});

export const SearchIndexForm = observer(({options, setOptions}) => {
  const [updatingIndexes, setUpdatingIndexes] = useState([]);
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

  const SetSearchIndex = searchIndexId => {
    setOptions({
      // Important - must reset fields if search index changes, as they might differ between indexes
      ...aiStore.DEFAULT_SEARCH_SETTINGS,
      minConfidence: options.minConfidence,
      searchIndexId
    });
  };

  return (
    <>
      {
        !showBrowser ? null :
          <SearchIndexBrowseModal
            Select={async ({objectId}) => {
              await aiStore.AddSearchIndex({objectId});
              SetSearchIndex(objectId);
              setShowBrowser(false);
            }}
            Cancel={() => setShowBrowser(false)}
          />
      }
      <div className={S("search-settings__form")}>
        <div className={S("search-settings__form-title")}>
          Search Index
        </div>

        {
          aiStore.searchIndexes.map(index =>
            <div
              role="button"
              tabIndex={0}
              key={`index-${index.id}`}
              onClick={() => SetSearchIndex(index.id)}
              className={S("index__option", options.searchIndexId === index.id ? "index__option--active" : "")}
            >
              <div className={S("index__text")}>
                <div className={S("index__option-name", "ellipsis")}>
                  {index.name || index.id}
                </div>
                {
                  !index.name ? null :
                    <div className={S("index__option-id")}>
                      <CopyableField value={index.id}/>
                    </div>
                }
              </div>
              <div className={S("index__actions")}>
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
                            try {
                              await aiStore.RemoveSearchIndex({objectId: index.id});
                            } catch(error) {
                              console.error(error);
                            } finally {
                              SetSearchIndex(aiStore.searchIndexes[0].id);
                            }
                          }
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
                          title: "Remove Search Index",
                          text: "Are you sure you want to update this search index?",
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
        <StyledButton
          color="--color-border"
          textColor="--text-secondary"
          variant="secondary"
          onClick={() => setShowBrowser(true)}
          size="sm"
          className={S("index__button")}
        >
          Add Search Index
        </StyledButton>
      </div>
    </>
  );
});

const FieldsForm = observer(({options, setOptions}) => {
  const searchIndex = aiStore.searchIndexes.find(index => index.id === options.searchIndexId);

  return (
    <div className={S("search-settings__form")}>
      <div className={S("search-settings__form-title")}>
        Search Fields
      </div>
      <div className={S("search-settings__options-list")}>
        {
          Object.keys(searchIndex.fields || []).map(fieldKey => {
            const active = options.fields.includes(fieldKey);
            const Toggle = () =>
              !active ?
                setOptions({...options, fields: [...options.fields, fieldKey]}) :
                setOptions({...options, fields: options.fields.filter(otherKey => otherKey !== fieldKey)});

            return (
              <button
                key={`option-${fieldKey}`}
                onClick={Toggle}
                className={S("search-settings__option")}
              >
                <Checkbox checked={active} onChange={Toggle}/>
                <span>
                  {searchIndex.fields[fieldKey]?.label || fieldKey}
                </span>
              </button>
            );
          })
        }
      </div>
    </div>
  );
});

const ConfidenceForm = observer(({options, setOptions}) => {
  return (
    <div className={S("search-settings__form")}>
      <div className={S("search-settings__form-title")}>
        Minimum Confidence: {options.minConfidence}%
      </div>
      <Slider
        name="minConfidence"
        label={number => `${number}%`}
        value={options.minConfidence}
        onChange={value => setOptions({...options, minConfidence: value})}
        min={0}
        step={5}
        max={100}
        maw={500}
        px={15}
        marks={[
          {value: 25, label: "25%"},
          {value: 50, label: "50%"},
          {value: 75, label: "75%"},
        ]}
        className={S("search-settings__confidence")}
      />
    </div>
  );
});

/*
const ClipDurationForm = observer(({options, setOptions}) => {
  return (
    <div className={S("search-settings__form")}>
      <div className={S("search-settings__form-title")}>
        Clip Duration: {options.minConfidence}%
      </div>
      <Slider
        name="minConfidence"
        label={number => `${number}%`}
        value={options.minConfidence}
        onChange={value => setOptions({...options, minConfidence: value})}
        min={0}
        step={5}
        max={100}
        maw={500}
        marks={[
          {value: 25, label: "25%"},
          {value: 50, label: "50%"},
          {value: 75, label: "75%"},
        ]}
        className={S("search-settings__confidence")}
      />
    </div>
  );
});

 */

const TitlesForm = observer(({options, setOptions}) => {
  const [filter, setFilter] = useState("");

  const searchIndex = aiStore.searchIndexes.find(index => index.id === options.searchIndexId);

  return (
    <div className={S("search-settings__form")}>
      <TextInput
        value={filter}
        onChange={event => setFilter(event.target.value)}
        placeholder="Search"
        className={S("search-settings__search")}
      />
      <div className={S("search-settings__options-list")}>
        {
          searchIndex?.indexedTitles
            ?.filter(({name, objectId}) =>
              !filter ||
              name?.toLowerCase()?.includes(filter.toLowerCase()) ||
              objectId?.toLowerCase()?.includes(filter.toLowerCase())
            )
            ?.map(({name, objectId}) => {
              const active = options.objectIds.includes(objectId);

              const Toggle = () =>
                !active ?
                  setOptions({...options, objectIds: [...options.objectIds, objectId]}) :
                  setOptions({...options, objectIds: options.objectIds.filter(otherId => otherId !== objectId)});

              return (
                <button
                  key={`option-${objectId}`}
                  onClick={Toggle}
                  className={S("search-settings__option")}
                >
                  <Checkbox checked={active} onChange={Toggle}/>
                  <div className={S("search-settings__option-text")}>
                    <div className={S("search-settings__option-name")}>
                      {name || objectId}
                    </div>
                    <div onClick={event => event.stopPropagation()} className={S("search-settings__option-id")}>
                      <CopyableField value={objectId}/>
                    </div>
                  </div>
                </button>
              );
            })
        }
      </div>
    </div>
  );
});

const SearchSettings = observer(({store, singleObject, Close}) => {
  store = store || aiStore;
  const [tab, setTab] = useState(singleObject ? "confidence" : "titles");
  const [options, setOptions] = useState({
    searchIndexId: store.selectedSearchIndexId,
    ...store.searchSettings
  });

  let form;
  switch(tab) {
    case "index":
      form = <SearchIndexForm options={options} setOptions={setOptions} />;
      break;
    case "titles":
      form = <TitlesForm options={options} setOptions={setOptions} />;
      break;
    case "confidence":
      form = <ConfidenceForm options={options} setOptions={setOptions} />;
      break;
    case "fields":
      form = <FieldsForm options={options} setOptions={setOptions} />;
      break;
    default:
      form = <div />;
      break;
  }

  return (
    <Modal
      opened
      centered
      size={800}
      onClose={Close}
      title={
        <div className={S("search-settings__header")}>
          <Icon icon={SettingsIcon} />
          <span>Filter</span>
        </div>
      }
    >
      <div className={S("search-settings__selected-titles")}>
        {
          options.objectIds.length === 0 ?
            <div className={S("search-settings__selected-title")}>All Titles</div> :
            options.objectIds.map(objectId =>
              <div key={`title-${objectId}`} className={S("search-settings__selected-title")}>
                <span className={S("ellipsis")}>
                  { rootStore.objectNames[objectId] || objectId }
                </span>
                <button
                  onClick={() =>
                    setOptions({
                      ...options,
                      objectIds: options.objectIds.filter(otherId => otherId !== objectId)
                    })
                  }
                >
                  <Icon icon={XIcon} />
                </button>
              </div>
            )
        }
      </div>
      <div className={S("search-settings__content")}>
        <div className={S("search-settings__tabs")}>
          <button
            className={S("search-settings__tab", tab === "index" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("index")}
          >
            Search Index
          </button>
          {
            singleObject ? null :
              <button
                className={S("search-settings__tab", tab === "titles" ? "search-settings__tab--active" : "")}
                onClick={() => setTab("titles")}
              >
                Titles
              </button>
          }
          <button
            className={S("search-settings__tab", tab === "confidence" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("confidence")}
          >
            Confidence
          </button>
          <button
            className={S("search-settings__tab", tab === "fields" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("fields")}
          >
            Fields
          </button>
        </div>
        {form}
      </div>
      <div className={S("search-settings__actions")}>
        <Button
          onClick={Close}
          variant="subtle"
          color="gray.5"
          w={150}
        >
          Cancel
        </Button>
        <Button
          onClick={() => setOptions(aiStore.DEFAULT_SEARCH_SETTINGS)}
          variant="outline"
          color="gray.5"
          w={150}
        >
          Restore Defaults
        </Button>
        <Button
          autoContrast
          color="gray.5"
          w={150}
          onClick={() => {
            store.SetSearchSettings(options);
            Close();
          }}
        >
          Apply
        </Button>
      </div>
    </Modal>
  );
});

export default SearchSettings;
