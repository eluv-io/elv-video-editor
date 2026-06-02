import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";

import {observer} from "mobx-react-lite";
import {
  Confirm,
  CopyableField,
  FormTextInput,
  Icon,
  IconButton,
  Loader,
  Modal,
  StyledButton
} from "@/components/common/Common.jsx";
import React, {useEffect, useState} from "react";
import {FormatFieldName, CreateModuleClassMatcher} from "@/utils/Utils.js";

import {rootStore, aiStore} from "@/stores/index.js";
import {Checkbox, NumberInput, Slider, TextInput} from "@mantine/core";
import {LibraryBrowser, ObjectBrowser, SearchIndexContentBrowser} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";

import SettingsIcon from "@/assets/icons/v2/settings.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import UpdateIndexIcon from "@/assets/icons/v2/reload.svg";
import AddIcon from "@/assets/icons/v2/plus.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import VideoIcon from "@/assets/icons/v2/video.svg";
import SearchIcon from "@/assets/icons/v2/search.svg";

const S = CreateModuleClassMatcher(SearchStyles);

const visualFields = [
  "celebrity",
  "characters",
  "object",
  "logo"
];

const audioLanguageFields = [
  "speech_to_text",
  "music",
  "llava"
];

const IndexConfigDefaults = {
  clips_pad_duration: 15,
  clips_truncate_duration: 120
};

const SearchIndexContentBrowserModal = observer(({contentIds, Submit, Close}) => {
  const [selectedContentIds, setSelectedContentIds] = useState(contentIds || []);

  return (
    <Modal
      opened
      centered
      size={1200}
      onClose={Close}
      title={
        <div className={S("search-settings__header")}>
          <Icon icon={SettingsIcon}/>
          <span>
            Select Source Content
          </span>
        </div>
      }
    >
      <SearchIndexContentBrowser
        contentIds={selectedContentIds}
        setContentIds={setSelectedContentIds}
      />
      <div className={S("search-settings__actions")}>
        <StyledButton
          onClick={Close}
          color="--background-active"
          w={150}
        >
          Cancel
        </StyledButton>
        <StyledButton
          onClick={() => Submit(selectedContentIds)}
          w={150}
        >
          Submit
        </StyledButton>
      </div>
    </Modal>
  );
});

const CreateSearchIndexForm = observer(({indexId, Close}) => {
  let defaultOptions = {
    fields: aiStore.searchIndexTemplateInfo?.optionalFields || [],
    customFields: Object.keys(aiStore.searchIndexCustomFields[indexId || "new"] || {}),
    configuration: {...IndexConfigDefaults},
  };

  const [initialOptions, setInitialOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);
  const [options, setOptions] = useState({
    name: "",
    contentIds: [],
    ...defaultOptions,
  });

  useEffect(() => {
    aiStore.LoadSearchIndexTemplateInfo()
      .then(async () => {
        if(indexId) {
          const {name, fields, customFields, contentIds, configuration} = await aiStore.LoadSearchIndexInfo({indexId});

          setOptions({
            ...options,
            name,
            fields,
            customFields,
            contentIds,
            configuration: {
              ...options.configuration,
              ...configuration
            }
          });

          setInitialOptions({
            fields,
            customFields,
            contentIds
          });

          await new Promise(resolve => setTimeout(resolve, 250));
        } else {
          setOptions({
            ...options,
            fields: aiStore.searchIndexTemplateInfo?.optionalFields || []
          });
        }

        setLoading(false);
      });
  }, []);

  if(!aiStore.searchIndexTemplateInfo) {
    return null;
  }

  return (
    <Modal
      opened
      centered
      size={1000}
      onClose={Close}
      title={
        <div className={S("search-settings__header")}>
          <Icon icon={SettingsIcon}/>
          <span>
            {
              indexId ?
                "Update Search Index" :
                "Create New Search Index"
            }
          </span>
        </div>
      }
    >
      <div className={S("index-form__section")}>
        <FormTextInput
          label="Name"
          placeholder="Search Index"
          value={options.name}
          onChange={event => setOptions({...options, name: event.target.value})}
        />
      </div>
      <div className={S("index-form__section")}>
        <h2 className={S("index-form__title")}>Source Content</h2>
        <h2 className={S("index-form__subtitle")}>Add source content(s) to be included in this search index</h2>

        {
          options.contentIds.length === 0 ?
            <StyledButton
              variant="secondary"
              color="--color-highlight"
              icon={AddIcon}
              size="sm"
              onClick={() => setShowBrowser(true)}
              className={S("index-form__add")}
            >
              Add Source Content
            </StyledButton> :
            <div className={S("index-form__content-summary")}>
              <Icon icon={VideoIcon} />
              <span>
                { options.contentIds.length } content object{options.contentIds.length === 1 ? "" : "s"} selected
              </span>
              <StyledButton
                variant="secondary"
                color="--color-highlight"
                icon={AddIcon}
                size="sm"
                onClick={() => setShowBrowser(true)}
                className={S("index-form__add")}
              >
                Select Source Content
              </StyledButton>
            </div>
        }
      </div>
      <div className={S("index-form__section")}>
        <h2 className={S("index-form__title")}>
          <span>Search Fields</span>
          {
            options.contentIds.length === 0 ? null :
              <StyledButton
                size="sm"
                icon={SearchIcon}
                onClick={async () => {
                  const initialCustomFields = Object.keys(aiStore.searchIndexCustomFields[indexId || "new"] || {});
                  await aiStore.AddSearchIndexFields({indexId: indexId || "new", objectIds: options.contentIds});

                  const newCustomFields = Object.keys(aiStore.searchIndexCustomFields[indexId || "new"] || {})
                    .filter(field => !initialCustomFields.includes(field));

                  if(newCustomFields.length > 0) {
                    setOptions({
                      ...options,
                      customFields: [
                        ...options.customFields,
                        ...newCustomFields
                      ]
                    });
                  }
                }}
              >
                Check for Additional Fields
              </StyledButton>
          }
        </h2>
        <h2 className={S("index-form__subtitle")}>
          Select metadata fields to be included in the index.
        </h2>
        <div className={S("index-form__fields-section")}>
          <div className={S("index-form__field-list")}>
            <h3 className={S("index-form__field-list-title")}>
              Media Metadata
            </h3>
            {
              aiStore.searchIndexTemplateInfo.requiredFields
                .filter(field => !field.startsWith("zz"))
                .map(field =>
                  <Checkbox
                    size="sm"
                    disabled
                    checked
                    key={`field-${field}`}
                    label={FormatFieldName(field)}
                  />
                )
            }
          </div>
          <div className={S("index-form__field-list")}>
            <h3 className={S("index-form__field-list-title")}>
              Visual Recognition
            </h3>
            {
              aiStore.searchIndexTemplateInfo.optionalFields
                .filter(field => visualFields.find(otherField => otherField.startsWith(field)))
                .map(field =>
                  <Checkbox
                    size="sm"
                    key={`field-${field}`}
                    label={FormatFieldName(field)}
                    checked={options.fields.includes(field)}
                    onChange={() => setOptions({
                      ...options,
                      fields:
                        options.fields.includes(field) ?
                          options.fields.filter(otherField => otherField !== field) :
                          [...options.fields, field]
                    })}
                  />
                )
            }
          </div>
          <div className={S("index-form__field-list")}>
            <h3 className={S("index-form__field-list-title")}>
              Audio & Language
            </h3>
            {
              aiStore.searchIndexTemplateInfo.optionalFields
                .filter(field => audioLanguageFields.find(otherField => otherField.startsWith(field)))
                .map(field =>
                  <Checkbox
                    size="sm"
                    key={`field-${field}`}
                    label={FormatFieldName(field)}
                    checked={options.fields.includes(field)}
                    onChange={() => setOptions({
                      ...options,
                      fields:
                        options.fields.includes(field) ?
                          options.fields.filter(otherField => otherField !== field) :
                          [...options.fields, field]
                    })}
                  />
                )
            }
          </div>
          {
            Object.keys(aiStore.searchIndexCustomFields[indexId || "new"] || {}).length === 0 ? null :
              <div className={S("index-form__field-list")}>
                <h3 className={S("index-form__field-list-title")}>
                  Additional Fields
                </h3>
                {
                  Object.values(aiStore.searchIndexCustomFields[indexId || "new"])
                    .map(({name, label}) =>
                      <div key={`field-${name}`} className={S("index-form__field-list-custom-item")}>
                        <Checkbox
                          size="sm"
                          label={label || FormatFieldName(name)}
                          checked={options.customFields.includes(name)}
                          onChange={() => setOptions({
                            ...options,
                            customFields:
                              options.customFields.includes(name) ?
                                options.customFields.filter(otherField => otherField !== name) :
                                [...options.customFields, name]
                          })}
                        />
                        <IconButton
                          icon={XIcon}
                          small
                          onClick={() => Confirm({
                            title: "Remove additional field",
                            text: "Are you sure you want to remove this field from the index?",
                            onConfirm: () => aiStore.RemoveSearchIndexCustomField({indexId: indexId || "new", field: name})
                          })}
                          className={S("index-form__field-list-remove")}
                        />
                      </div>
                    )
                }
              </div>
          }
        </div>
      </div>
      <div className={S("index-form__section", "index-form__section--no-border")}>
        <h2 className={S("index-form__title")}>Clip Search Configuration</h2>
        <div className={S("index-form__inputs")}>
          <div className={S("index-form__input")}>
            <label>
              Clip Min Duration
            </label>
            <Slider
              min={0}
              max={300}
              value={options.configuration.clips_pad_duration}
              miw={200}
              marks={[
                {value: options.configuration.clips_pad_duration, label: `${options.configuration.clips_pad_duration}s`}
              ]}
              onChange={value => setOptions({
                ...options,
                configuration: {
                  ...options.configuration,
                  clips_pad_duration: Math.min(parseInt(value || 0), options.configuration.clips_truncate_duration)
                }
              })}
            />
            <NumberInput
              min={0}
              max={300}
              maw={100}
              type="number"
              value={options.configuration.clips_pad_duration}
              onChange={value => setOptions({
                ...options,
                configuration: {...options.configuration, clips_pad_duration: Math.min(parseInt(value || 0), options.configuration.clips_truncate_duration)}
              })}
            />
            <span>seconds</span>
          </div>
          <div className={S("index-form__input")}>
            <label>
              Clip Max Duration
            </label>
            <Slider
              value={options.configuration.clips_truncate_duration}
              min={0}
              max={300}
              miw={200}
              marks={[
                {value: options.configuration.clips_truncate_duration, label: `${options.configuration.clips_truncate_duration}s`}
              ]}
              onChange={value => setOptions({
                ...options,
                configuration: {...options.configuration, clips_truncate_duration: Math.max(parseInt(value || 0), options.configuration.clips_pad_duration)}
              })}
            />
            <NumberInput
              maw={100}
              min={0}
              max={300}
              type="number"
              value={options.configuration.clips_truncate_duration}
              onChange={value => setOptions({
                ...options,
                configuration: {...options.configuration, clips_truncate_duration: Math.max(parseInt(value || 0), options.configuration.clips_pad_duration)}
              })}
            />
            <span>seconds</span>
          </div>
        </div>
      </div>
      <div className={S("search-settings__actions")}>
        <StyledButton
          onClick={Close}
          color="--background-active"
          w={150}
        >
          Cancel
        </StyledButton>
        <StyledButton
          onClick={() => Confirm({
            title: "Restore Defaults",
            text: "Are you sure you want to restore the default configuration?",
            onConfirm: () =>
              setOptions({
                ...options,
                ...defaultOptions
              })
          })}
          variant="secondary"
          color="--color-border"
          textColor="--text-secondary"
          w={150}
        >
          Restore Defaults
        </StyledButton>
        <StyledButton
          w={150}
          onClick={async () => {
            if(!indexId) {
              indexId = await aiStore.CreateSearchIndex({
                name: options.name,
                selectedFields: options.fields,
                selectedCustomFields: options.customFields,
                contentIds: options.contentIds,
                configuration: {
                  clips_pad_duration: options.configuration.clips_pad_duration,
                  clips_truncate_duration: options.configuration.clips_truncate_duration
                }
              });

              await aiStore.BuildSearchIndex({indexId});
            } else {
              await aiStore.UpdateSearchIndex({
                indexId,
                name: options.name,
                selectedFields: options.fields,
                selectedCustomFields: options.customFields,
                contentIds: options.contentIds,
                configuration: {
                  clips_pad_duration: options.configuration.clips_pad_duration,
                  clips_truncate_duration: options.configuration.clips_truncate_duration
                }
              });

              const optionsChanged =
                JSON.stringify(options.contentIds.slice().sort()) !== JSON.stringify((initialOptions.contentIds || []).slice().sort()) ||
                JSON.stringify(options.fields.slice().sort()) !== JSON.stringify((initialOptions.fields || []).slice().sort()) ||
                JSON.stringify(options.customFields.slice().sort()) !== JSON.stringify((initialOptions.customFields || []).slice().sort());

              if(optionsChanged) {
                await aiStore.BuildSearchIndex({indexId});
              }
            }

            Close();
          }}
        >
          { indexId ? "Update" : "Create" }
        </StyledButton>
      </div>
      {
        !showBrowser ? null :
          <SearchIndexContentBrowserModal
            contentIds={options.contentIds}
            Submit={contentIds => {
              setOptions({...options, contentIds});
              setShowBrowser(false);
            }}
            Close={() => setShowBrowser(false)}
          />
      }
      {
        !loading ? null :
          <Loader className={S("index-form__loader")} />
      }
    </Modal>
  );
});

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
            Select={async ({objectId, name}) => await Select({objectId, name})}
            className={S("index__browser")}
          /> :
          <LibraryBrowser
            withFilterBar
            filterQueryParam="index"
            title="Select search index"
            Select={async ({libraryId, objectId, name}) => {
              if(objectId) {
                await Select({objectId, name});
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
  const [showBrowser, setShowBrowser] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const SetSearchIndex = ({searchIndexId, imageCollectionId}) => {
    setOptions({
      // Important - must reset fields if search index changes, as they might differ between indexes
      ...aiStore.DEFAULT_SEARCH_SETTINGS,
      minConfidence: options.minConfidence,
      searchIndexId: searchIndexId || options.searchIndexId,
      imageCollectionId: imageCollectionId || options.imageCollectionId
    });
  };

  return (
    <>
      {
        !showBrowser ? null :
          <SearchIndexBrowseModal
            Select={async ({objectId}) => {
              if(showBrowser === "index") {
                await aiStore.AddSearchIndex({objectId});
                SetSearchIndex({searchIndexId: objectId});
              } else {
                //await aiStore.AddImageCollection({objectId});
                SetSearchIndex({imageCollectionId: objectId});
              }
              setShowBrowser(false);
            }}
            Cancel={() => setShowBrowser(false)}
          />
      }
      <div className={S("search-settings__form", "search-settings__form--scrollable")}>
        <div className={S("search-settings__form-title")}>
          <span>Search Index</span>
          <Checkbox
            label="Use Cache"
            labelPosition="left"
            checked={options.cache}
            onChange={() => setOptions({...options, cache: !options.cache})}
          />
        </div>

        {
          aiStore.searchIndexes.map(index =>
            <div
              role="button"
              tabIndex={0}
              key={`index-${index.id}`}
              onClick={() => SetSearchIndex({searchIndexId: index.id})}
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
              <div onClick={event => event.stopPropagation()} className={S("index__actions")}>
                {
                  !index.canEdit ? null :
                    <>
                      <IconButton
                        label="Modify Search Index"
                        icon={EditIcon}
                        onClick={() => setShowForm(index.id)}
                      />
                      <IconButton
                        label="Update Search Index"
                        icon={UpdateIndexIcon}
                        loadingProgress={aiStore.searchIndexUpdateProgress[index.id]}
                        onClick={async event => {
                          event.preventDefault();
                          event.stopPropagation();

                          await Confirm({
                            title: "Remove Search Index",
                            text: "Are you sure you want to update this search index?",
                            onConfirm: async () =>
                              await aiStore.BuildSearchIndex({indexId: index.id, aggregate: true})
                          });
                        }}
                      />
                    </>
                }
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
                        }
                      }
                    });
                  }}
                />
              </div>
            </div>
          )
        }
        <div className={S("index__buttons")}>
          <StyledButton
            color="--color-border"
            textColor="--text-secondary"
            variant="secondary"
            onClick={() => setShowBrowser("index")}
            size="md"
          >
            Add Existing Index
          </StyledButton>
          <StyledButton
            variant="white"
            onClick={() => setShowForm(true)}
            size="md"
          >
            Create New Index
          </StyledButton>
        </div>

        {
          aiStore.searchCollectionIndexes.length === 0 ? null :
            <>
              <div className={S("search-settings__form-title")}>
                Image Collections
              </div>
              {
                aiStore.searchCollectionIndexes.map(index =>
                  <div
                    role="button"
                    tabIndex={0}
                    key={`index-${index.id}`}
                    onClick={() => SetSearchIndex({imageCollectionId: index.id})}
                    className={S("index__option", options.imageCollectionId === index.id ? "index__option--active" : "")}
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
                  </div>
                )
              }
            </>
        }
      </div>
      {
        !showForm ? null :
          <CreateSearchIndexForm
            indexId={typeof showForm === "string" ? showForm : undefined}
            Close={() => setShowForm(false)}
          />
      }
      {
        !aiStore.searchIndexesLoading ? null :
          <Loader className={S("search-settings__loader")} />
      }
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
  const [visibleItems, setVisibleItems] = useState(20);
  const searchIndex = aiStore.searchIndexes.find(index => index.id === options.searchIndexId);
  const visibleTitles = (searchIndex?.indexedTitles || [])
    .map(({objectId, name}) => ({objectId, name: rootStore.objectNames[objectId] || name}))
    .slice(0, visibleItems);
  const [loading, setLoading] = useState(visibleTitles.length > 0);

  useEffect(() => {
    if(visibleTitles.length === 0) { return; }

    const timeout = setTimeout(() => setLoading(true), 0);

    Promise.all(
      visibleTitles
        .map(async ({objectId}) =>
          await rootStore.GetObjectName({objectId})
        )
    ).finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });
  }, [visibleItems, visibleTitles]);

  return (
    <div className={S("search-settings__form")}>
      <TextInput
        value={filter}
        onChange={event => setFilter(event.target.value)}
        placeholder="Search"
        className={S("search-settings__search")}
      />
      <InfiniteScroll
        withLoader
        showLoader={loading}
        Update={() => setVisibleItems(visibleItems + 20)}
        className={S("search-settings__options-list")}
      >
        {
          visibleTitles
            .filter(({name, objectId}) =>
              !filter ||
              name?.toLowerCase()?.includes(filter.toLowerCase()) ||
              objectId?.toLowerCase()?.includes(filter.toLowerCase())
            )
            .map(({objectId, name}) => {
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
      </InfiniteScroll>
    </div>
  );
});

const SearchSettings = observer(({store, singleObject, Close}) => {
  store = store || aiStore;
  const [tab, setTab] = useState(!aiStore.searchIndex ? "index" : singleObject ? "confidence" : "titles");
  const [options, setOptions] = useState({
    searchIndexId: store.selectedSearchIndexId,
    imageCollectionId: store.selectedCollectionSearchIndexId,
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
                disabled={!aiStore.searchIndex}
                className={S("search-settings__tab", tab === "titles" ? "search-settings__tab--active" : "")}
                onClick={() => setTab("titles")}
              >
                Titles
              </button>
          }
          <button
            disabled={!aiStore.searchIndex}
            className={S("search-settings__tab", tab === "confidence" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("confidence")}
          >
            Confidence
          </button>
          <button
            disabled={!aiStore.searchIndex}
            className={S("search-settings__tab", tab === "fields" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("fields")}
          >
            Fields
          </button>
        </div>
        {form}
      </div>
      <div className={S("search-settings__actions")}>
        <StyledButton
          onClick={Close}
          color="--background-active"
          w={150}
        >
          Cancel
        </StyledButton>
        <StyledButton
          onClick={() => setOptions({
            ...options,
            ...aiStore.DEFAULT_SEARCH_SETTINGS
          })}
          variant="secondary"
          color="--color-border"
          textColor="--text-secondary"
          w={150}
        >
          Restore Defaults
        </StyledButton>
        <StyledButton
          w={150}
          variant="white"
          onClick={() => {
            store.SetSearchSettings(options);
            Close();
          }}
        >
          Apply
        </StyledButton>
      </div>
    </Modal>
  );
});

export default SearchSettings;
