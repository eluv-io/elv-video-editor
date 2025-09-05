import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, Slugify} from "@/utils/Utils.js";
import {
  AsyncButton,
  FormNumberInput,
  FormSelect,
  FormTextInput,
  Loader,
  Modal
} from "@/components/common/Common.jsx";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";
import {Redirect} from "wouter";
import {rootStore, compositionStore} from "@/stores/index.js";
import {Button, Checkbox, Group} from "@mantine/core";
import UrlJoin from "url-join";
import {LoadVideo} from "@/stores/Helpers.js";

import ManualCompositionSelectionImage from "@/assets/images/composition-manual.svg";
import AICompositionSelectionImage from "@/assets/images/composition-ai.svg";

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

const CompositionCreationModal = observer(({type, Cancel}) => {
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [keyExists, setKeyExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sourceInfo, setSourceInfo] = useState(undefined);
  const [offeringKey, setOfferingKey] = useState(undefined);
  const [options, setOptions] = useState({
    creating: false,
    created: false,
    sourceId: rootStore.selectedObjectId,
    sourceName: rootStore.selectedObjectName,
    name: "",
    key: "",
    prompt: "",
    maxDuration: undefined,
    regenerate: false,
    length: undefined
  });

  const key = options.key || Slugify(options.name);

  useEffect(() => {
    if(!compositionStore.compositionFormOptions) { return; }

    setOptions({...options, ...compositionStore.compositionFormOptions});
  }, []);

  useEffect(() => {
    compositionStore.SetCompositionFormOptions({...options});
  }, [options]);

  useEffect(() => {
    clearTimeout(keyCheckTimeout);

    if(!options.sourceId || !key) { return; }

    keyCheckTimeout = setTimeout(() => {
      compositionStore.__CheckCompositionKeyExists({objectId: options.sourceId, key})
        .then(exists => setKeyExists(exists));
    }, 500);
  }, [options.sourceId, key]);

  useEffect(() => {
    if(!options.sourceId) { return; }

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
  } else if(keyExists) {
    error = "A composition with this key already exists for this content";
  }

  // Creation form
  return (
    <div key="form" className={S("composition-selection")}>
      <form onSubmit={event => event.preventDefault()} className={S("composition-form")}>
        <div className={S("composition-form__title")}>
          {
            options.type === "manual" ?
              "Create Composition" :
              "Create Highlight Compositions with AI"
          }
        </div>
        <Button color="gray.5" autoContrast onClick={() => setShowSourceModal(true)}>
          Choose Source Content
        </Button>
        {
          !options.sourceName ? null :
            <FormTextInput
              disabled
              label="Source"
              value={options.sourceName}
            />
        }
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
              {
                /*
                  <FormSelect
                    label="Search Index"
                    value={aiStore.selectedSearchIndexId}
                    onChange={value => aiStore.SetSelectedSearchIndex(value)}
                    options={
                      aiStore.searchIndexes.map(searchIndex =>
                        ({label: searchIndex.name || "", value: searchIndex.id})
                      )
                    }
                  />
                 */
              }
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
            onClick={Cancel}
          >
            Cancel
          </Button>
          <AsyncButton
            tooltip={error}
            disabled={!!error || !sourceInfo}
            color="gray.1"
            autoContrast
            w={150}
            loading={!!options.sourceId && !sourceInfo && !error}
            onClick={async () => {
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
    </div>
  );
});

let keyCheckTimeout;
const CompositionSelection = observer(() => {
  const [type, setType] = useState(undefined);

  return (
    <>
      <div key="selection" className={S("composition-selection")}>
        <button onClick={() => setType("manual")} className={S("selection-block", "selection-block--manual")}>
          <img src={ManualCompositionSelectionImage} className={S("selection-block__image")}/>
          <div className={S("selection-block__text")}>
            <div className={S("selection-block__title")}>
              Choose a Source & Create
            </div>
            <div className={S("selection-block__subtitle")}>
              Pick a source and build your composition your way.
            </div>
          </div>
        </button>
        <button onClick={() => setType("ai")} className={S("selection-block", "selection-block--ai")}>
          <img src={AICompositionSelectionImage} className={S("selection-block__image")}/>
          <div className={S("selection-block__text")}>
            <div className={S("selection-block__title")}>
              Create Compositions with AI
            </div>
            <div className={S("selection-block__subtitle")}>
              Let AI give you a head start on highlight compositions.
            </div>
          </div>
        </button>
      </div>
      {
        !type ? null :
          <Modal
            withCloseButton={false}
            alwaysOpened
            centered
            size={600}
            padding={0}
            onClose={() => setType(undefined)}
          >
            <CompositionCreationModal
              type={type}
              Cancel={() => setType(undefined)}
            />
          </Modal>
      }
    </>
  );
});

export default CompositionSelection;
