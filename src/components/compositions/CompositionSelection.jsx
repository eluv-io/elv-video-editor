import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Capitalize, CreateModuleClassMatcher, Slugify, StorageHandler} from "@/utils/Utils.js";
import {
  AsyncButton, Confirm,
  FormNumberInput,
  FormSelect,
  FormTextInput, Icon,
  Loader,
  Modal
} from "@/components/common/Common.jsx";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";
import {Redirect} from "wouter";
import {rootStore, compositionStore, aiStore, videoStore} from "@/stores/index.js";
import {Button, Checkbox, Group} from "@mantine/core";
import UrlJoin from "url-join";
import {LoadVideo} from "@/stores/Helpers.js";

import CompositionIcon from "@/assets/icons/v2/composition.svg";
import FolderIcon from "@/assets/icons/v2/library.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";

import ManualCompositionSelectionImage from "@/assets/images/composition-manual.svg";
import AICompositionSelectionImage from "@/assets/images/composition-ai.svg";
import SportsCompositionSelectionImage from "@/assets/images/composition-sports.svg";
import EntertainmentCompositionSelectionImage from "@/assets/images/composition-entertainment.svg";
import HighlightProfileForm from "@/components/compositions/HighlightProfileForm.jsx";

const S = CreateModuleClassMatcher(CompositionStyles);

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
            className={S("composition-selection__browser")}
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
            className={S("composition-selection__browser")}
          />
      }
    </Modal>
  );
});

const ProfileTypeSelection = observer(({Select, Cancel}) => {
  const availableTypes = Object.keys(aiStore.highlightProfileInfo || {});
  const [selectedType, setSelectedType] = useState(
    StorageHandler.get({type: "local", key: `highlight-type-${rootStore.tenantContractId}`}) || ""
  );
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if(availableTypes.length === 1) {
      Select(availableTypes[0]);
    }
  }, []);

  return (
    <div key="form" className={S("composition-selection")}>
      <form onSubmit={event => event.preventDefault()} className={S("composition-form")}>
        <div className={S("composition-form__title")}>
          <Icon icon={CompositionIcon} />
          Create New Compositions with AI
        </div>
        <div className={S("composition-form__profile-type")}>
          <div className={S("composition-form__profile-type-label")}>Choose a category to get started</div>
          <button
            onClick={() => setSelectedType("sports")}
            className={S("selection-block", selectedType === "sports" ? "selection-block--selected" : "")}
          >
            <img alt="Sports" src={SportsCompositionSelectionImage} className={S("selection-block__image")}/>
            <div className={S("selection-block__text")}>
              <div className={S("selection-block__title")}>
                Sports
              </div>
              <div className={S("selection-block__subtitle")}>
                Let AI give you a head start on highlight compositions.
              </div>
            </div>
          </button>
          <button
            onClick={() => setSelectedType("entertainment")}
            className={S("selection-block", selectedType === "entertainment" ? "selection-block--selected" : "")}
          >
            <img alt="Entertainment" src={EntertainmentCompositionSelectionImage} className={S("selection-block__image")}/>
            <div className={S("selection-block__text")}>
              <div className={S("selection-block__title")}>
                Entertainment
              </div>
              <div className={S("selection-block__subtitle")}>
                Let AI give you a head start on short form compositions.
              </div>
            </div>
          </button>
        </div>
        <div className={S("composition-form__actions")}>
          <Checkbox
            label="Remember my choice for next time"
            value={remember}
            onChange={event => setRemember(event.target.checked)}
            fz="sm"
            className={S("composition-form__checkbox")}
          />
          <Button
            color="gray.6"
            variant="subtle"
            w={150}
            onClick={Cancel}
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedType}
            color="gray.1"
            autoContrast
            w={150}
            onClick={() => {
              Select(selectedType);

              if(remember) {
                StorageHandler.set({type: "local", key: `highlight-type-${rootStore.tenantContractId}`, value: selectedType});
              } else {
                StorageHandler.remove({type: "local", key: `highlight-type-${rootStore.tenantContractId}`, value: selectedType});
              }
            }}
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
});

const CompositionCreationModal = observer(({type, defaultProfileType="", Cancel}) => {
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [keyExists, setKeyExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sourceInfo, setSourceInfo] = useState(undefined);
  const [offeringKey, setOfferingKey] = useState(undefined);
  const [options, setOptions] = useState({
    creating: false,
    created: false,
    sourceId: rootStore.selectedObjectId || videoStore.videoObject?.objectId,
    sourceName: rootStore.selectedObjectName || videoStore.videoObject?.name,
    name: "",
    key: "",
    prompt: "",
    indexId: aiStore.selectedSearchIndexId,
    profileType: defaultProfileType,
    profileSubtype: "",
    profileKey: "",
    maxDuration: undefined,
    regenerate: false,
    length: undefined
  });

  const key = options.key || Slugify(options.name);
  const availableProfiles = (aiStore.highlightProfileInfo || {})[options.profileType];
  const selectedProfile = aiStore.highlightProfiles[options.profileKey];

  useEffect(() => {
    if(!compositionStore.compositionFormOptions) {
      return;
    }

    setOptions({...options, ...compositionStore.compositionFormOptions});
  }, []);

  useEffect(() => {
    compositionStore.SetCompositionFormOptions({...options});
  }, [options]);

  useEffect(() => {
    clearTimeout(keyCheckTimeout);

    if(!options.sourceId || !key) {
      return;
    }

    keyCheckTimeout = setTimeout(() => {
      compositionStore.__CheckCompositionKeyExists({objectId: options.sourceId, key})
        .then(exists => setKeyExists(exists));
    }, 500);
  }, [options.sourceId, key]);

  useEffect(() => {
    if(!options.sourceId) {
      return;
    }

    setErrorMessage(undefined);
    setSourceInfo(undefined);
    setOfferingKey(undefined);

    LoadVideo({
      objectId: options.sourceId
    })
      .then(sourceInfo => {
        if(!sourceInfo.isVideo) {
          setErrorMessage("This content is not a video");
        } else {
          setSourceInfo(sourceInfo);
          setOfferingKey(sourceInfo.offeringKey);
        }
      })
      .catch(error => setErrorMessage(error?.toString()));
  }, [options.sourceId]);

  useEffect(() => {
    const availableProfiles = (aiStore.highlightProfileInfo || {})[options.profileType];

    if(!availableProfiles) {
      return;
    }

    // Automatically reselect profile subtype + profile key on change based on what's available, defaults and last selected

    const lastProfile = aiStore.highlightProfiles[
      StorageHandler.get({type: "local", key: `highlight-profile-${options.profileType}-${rootStore.tenantContractId}`})
    ];
    const defaultProfile = aiStore.highlightProfiles[aiStore.defaultHighlightProfileKey];
    const selectedProfile = aiStore.highlightProfiles[options.profileKey];

    let subtype = options.profileSubtype;
    let key = options.profileKey;
    if(
      selectedProfile?.type !== options.profileType ||
      selectedProfile?.subtype !== options.profileSubtype ||
      selectedProfile?.key !== options.profileKey
    ) {
      // Selected type doesn't contain selected subtype, need to pick default
      if(lastProfile?.type === options.profileType && (!options.profileSubtype || options.profileSubtype === lastProfile.subtype)) {
        subtype = lastProfile.subtype;
        key = lastProfile.key;
      } else if(defaultProfile?.type === options.profileType && (!options.profileSubtype || options.profileSubtype === defaultProfile.subtype)) {
        subtype = defaultProfile.subtype;
        key = defaultProfile.key;
      } else {
        subtype = Object.keys(availableProfiles).includes(options.profileSubtype) ?
          options.profileSubtype : Object.keys(availableProfiles)[0];
        key = availableProfiles[subtype]?.[0]?.key;
      }
    }

    setOptions({
      ...options,
      profileSubtype: subtype,
      profileKey: key
    });
  }, [options.profileType, options.profileSubtype]);

  useEffect(() => {
    if(!options.profileKey) { return; }

    StorageHandler.set({
      type: "local",
      key: `highlight-profile-${options.profileType}-${rootStore.tenantContractId}`,
      value: options.profileKey
    });
  }, [options.profileKey]);

  // Generation complete - redirect to composition view
  if(options.creating && compositionStore.compositionGenerationStatus?.created) {
    compositionStore.SetCompositionFormOptions({});
    return <Redirect to={UrlJoin("/compositions", options.sourceId, key)} />;
  }

  // Creating composition - show status
  if(options.creating) {
    const progress = compositionStore.compositionGenerationStatus?.progress?.split("/");

    return (
      <div key="status" className={S("composition-selection")}>
        <div className={S("composition-selection__creating")}>
          <div className={S("composition-selection__title")}>
            <Icon icon={type === "ai" ? AISparkleIcon : CompositionIcon} />
            {
              type === "ai" ?
                "Generating AI Highlights..." :
                "Initializing Composition..."
            }
          </div>
          {
            !progress || progress[0] === "?" || parseInt(progress?.[0]) >= parseInt(progress?.[1]) ?
              <Loader/> :
              <progress
                value={parseInt(progress[0])}
                max={parseInt(progress[1])}
                className={S("composition-selection__progress")}
              />
          }
        </div>
      </div>
    );
  }

  if(type === "ai" && !options.profileType) {
    return (
      <ProfileTypeSelection
        Select={type => setOptions({...options, profileType: type})}
        Cancel={Cancel}
      />
    );
  }

  // Error
  if(errorMessage) {
    return (
      <div key="error" className={S("composition-selection")}>
        <div className={S("composition-selection__error")}>
          <div className={S("composition-selection__error-message")}>
            { errorMessage }
          </div>
          <Button
            color="gray.5"
            autoContrast
            onClick={Cancel}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  let error;
  if(!options.sourceId) {
    error = "Please select source content";
  } else if(!options.name) {
    error = "Please specify a name for your composition";
  }

  // Creation form
  return (
    <div key="form" className={S("composition-selection")}>
      <form onSubmit={event => event.preventDefault()} className={S("composition-form")}>
        <div className={S("composition-form__title")}>
          <Icon icon={CompositionIcon} />
          {
            options.type === "manual" ?
              "Create New Composition" :
              "Create New Compositions with AI"
          }
        </div>
        {
          type !== "ai" || !availableProfiles?.[options.profileSubtype] ? null :
            <>
              <div className={S("composition-form__input-group")}>
                <FormSelect
                  label="Profile Type"
                  value={options.profileSubtype}
                  options={
                    Object.keys(availableProfiles).map(key => ({
                      label: Capitalize(key), value: key
                    }))
                  }
                  onChange={value => setOptions({...options, profileSubtype: value})}
                />
                <FormSelect
                  label="Profile"
                  value={options.profileKey}
                  options={
                    availableProfiles[options.profileSubtype].map(profile => ({
                      label: profile.name || key, value: profile.key
                    }))
                  }
                  onChange={value => setOptions({...options, profileKey: value})}
                  icon={EditIcon}
                  iconOnClick={() => setShowProfileEditModal(true)}
                  className={S("form__input--wide")}
                />
              </div>
              {
                selectedProfile?.index ? null :
                  <FormSelect
                    label="Search Index"
                    value={options.indexId}
                    onChange={value => setOptions({...options, indexId: value})}
                    options={
                      aiStore.searchIndexes.map(searchIndex =>
                        ({label: searchIndex.name || "", value: searchIndex.id})
                      )
                    }
                  />
              }
            </>
        }
        <FormTextInput
          onClick={() => setShowSourceModal(true)}
          placeholder="Choose Source Content"
          label="Source"
          value={options.sourceName}
          onChange={() => {}}
          icon={FolderIcon}
        />
        <div className={S("composition-form__input-group")}>
          <FormTextInput
            label="Composition Name"
            value={options.name}
            onChange={event => setOptions({...options, name: event.target.value})}
          />
          <FormTextInput
            label="Composition Key"
            value={options.key}
            placeholder={key}
            onChange={event => setOptions({...options, key: event.target.value})}
          />
        </div>
        {
          !sourceInfo || !sourceInfo.availableOfferings || Object.keys(sourceInfo.availableOfferings).length === 0 ? null :
            <FormSelect
              label="Source Offering"
              value={offeringKey}
              onChange={value => setOfferingKey(value)}
              options={
                Object.keys(sourceInfo.availableOfferings).map(key =>
                  ({
                    label: sourceInfo.availableOfferings[key].display_name || key,
                    value: key,
                    disabled: sourceInfo.availableOfferings[key].disabled || false
                  })
                )
              }
            />
        }
        {
          type !== "ai" ? null :
            <>
              <FormNumberInput
                label="Maximum Duration (seconds)"
                placeholder="Automatic"
                value={options.maxDuration}
                min={0}
                max={100000}
                step={1}
                onChange={value => setOptions({...options, maxDuration: value})}
              />
              <FormTextInput
                label="Prompt (optional)"
                value={options.prompt}
                onChange={event => setOptions({...options, prompt: event.target.value})}
              />
              <Group my="xs" justify="end">
                <Checkbox
                  label="Regenerate Results (if present)"
                  checked={options.regenerate}
                  onChange={event => setOptions({...options, regenerate: event.currentTarget.checked})}
                />
              </Group>
            </>
        }
        <div className={S("composition-form__actions")}>
          <Button
            color="gray.6"
            variant="subtle"
            w={150}
            onClick={() => {
              if(type === "ai" && !defaultProfileType) {
                setOptions({...options, profileType: ""});
              } else {
                Cancel();
              }
            }}
          >
            {
              type === "ai" && !defaultProfileType ?
                "Back" : "Cancel"
            }
          </Button>
          <AsyncButton
            tooltip={error}
            disabled={!!error || !sourceInfo}
            color="gray.1"
            autoContrast
            w={150}
            loading={!!options.sourceId && !sourceInfo && !error}
            onClick={async () => {
              if(keyExists) {
                if(
                  !await Confirm({
                    title: "Overwrite Existing Composition",
                    text: "A composition with this key already exists for this content. If you proceed in creating this new composition, it will be overwritten. Would you like to continue?",
                    onConfirm: () => true
                  })
                ) {
                  return;
                }
              }

              setOptions({...options, creating: true});

              try {
                await compositionStore.CreateComposition({
                  type,
                  sourceObjectId: options.sourceId,
                  name: options.name,
                  key,
                  prompt: options.prompt,
                  maxDuration: options.maxDuration,
                  regenerate: options.regenerate,
                  profileKey: options.profileKey,
                  indexId: options.indexId,
                  offeringKey
                });
              } catch(error) {
                console.error(error);
                setOptions({...options, creating: false});

                if(error?.display_error) {
                  setErrorMessage(error.display_error);
                }
              }
            }}
          >
            {
              type === "manual" ?
                "Create" : "Generate"
            }
          </AsyncButton>
        </div>
      </form>

      {
        !showSourceModal ? null :
          <SourceSelectionModal
            Select={({objectId, name}) => {
              setOptions({...options, sourceId: objectId, sourceName: name});
              setShowSourceModal(false);
            }}
            Cancel={() => setShowSourceModal(false)}
          />
      }
      {
        !showProfileEditModal ? null :
          <HighlightProfileForm
            profileKey={options.profileKey}
            Close={key => {
              setShowProfileEditModal(false);

              if(key) {
                setOptions({...options, profileKey: key});
              }
            }}
          />
      }
    </div>
  );
});

let keyCheckTimeout;
const CompositionSelection = observer(() => {
  const [type, setType] = useState(undefined);
  const [skipDefaultType, setSkipDefaultType] = useState(false);
  const [defaultType, setDefaultType] = useState(
    StorageHandler.get({type: "local", key: `highlight-type-${rootStore.tenantContractId}`}) || ""
  );

  useEffect(() => {
    if(!type) {
      setSkipDefaultType(false);
    }

    setDefaultType(StorageHandler.get({type: "local", key: `highlight-type-${rootStore.tenantContractId}`}) || "");
  }, [type]);

  if(!aiStore.highlightProfiles) {
    return null;
  }

  return (
    <>
      <div key="selection" className={S("composition-selection")}>
        <button onClick={() => setType("manual")} className={S("selection-block")}>
          <img alt="Manual" src={ManualCompositionSelectionImage} className={S("selection-block__image")}/>
          <div className={S("selection-block__text")}>
            <div className={S("selection-block__title")}>
              Choose a Source & Create
            </div>
            <div className={S("selection-block__subtitle")}>
              Pick a source and build your composition your way.
            </div>
          </div>
        </button>
        <button onClick={() => setType("ai")} className={S("selection-block")}>
          <img
            alt="AI"
            src={
              defaultType === "sports" ?
                SportsCompositionSelectionImage :
                defaultType === "entertainment" ? EntertainmentCompositionSelectionImage :
                  AICompositionSelectionImage
            }
            className={S("selection-block__image")}
          />
          <div className={S("selection-block__text")}>
            <div className={S("selection-block__title")}>
              Create Compositions with AI
            </div>
            <div className={S("selection-block__subtitle")}>
              Let AI give you a head start on highlight compositions.
            </div>
            {
              !defaultType ? null :
                <div role="button"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();

                    setSkipDefaultType(true);
                    setType("ai");
                  }}
                  className={S("selection-block__options")}
                >
                  More Options
                </div>
            }
          </div>
        </button>
      </div>
      {
        !type ? null :
          <Modal
            withCloseButton={false}
            closeOnEscape={false}
            alwaysOpened
            centered
            size={600}
            padding={0}
            onClose={() => setType(undefined)}
          >
            <CompositionCreationModal
              type={type}
              defaultProfileType={skipDefaultType ? undefined : defaultType}
              Cancel={() => setType(undefined)}
            />
          </Modal>
      }
    </>
  );
});

export default CompositionSelection;
