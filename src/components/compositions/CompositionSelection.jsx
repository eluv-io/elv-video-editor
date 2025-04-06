import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, Slugify} from "@/utils/Utils.js";
import {AsyncButton, FormTextArea, FormTextInput, IconButton, Loader, Modal} from "@/components/common/Common.jsx";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";
import {Redirect} from "wouter";
import {compositionStore} from "@/stores/index.js";
import {Button, Checkbox, Group} from "@mantine/core";

import BackIcon from "@/assets/icons/v2/back.svg";
import ManualCompositionSelectionImage from "@/assets/images/composition-manual.svg";
import AICompositionSelectionImage from "@/assets/images/composition-ai.svg";
import UrlJoin from "url-join";

const S = CreateModuleClassMatcher(CompositionStyles);

const SourceSelectionModal = observer(({Select, Cancel}) => {
  const [libraryId, setLibraryId] = useState(undefined);
  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      {
        libraryId ?
          <ObjectBrowser
            libraryId={libraryId}
            title="Select source content for your composition"
            //videoOnly
            Back={() => setLibraryId(undefined)}
            Select={({objectId, name}) => Select({objectId, name})}
            className={S("composition-selection__browser")}
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
            className={S("composition-selection__browser")}
          />
      }
    </Modal>
  );
});

let keyCheckTimeout;
const CompositionForm = observer(({type, Cancel}) => {
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [keyExists, setKeyExists] = useState(false);
  const [options, setOptions] = useState({
    type: undefined,
    sourceId: rootStore.selectedObjectId,
    sourceName: rootStore.selectedObjectName,
    name: "",
    key: "",
    prompt: "",
    regenerate: false,
    length: undefined
  });

  const [createStatus, setCreateStatus] = useState(undefined);

  const key = options.key || Slugify(options.name);

  // TODO: Select source offering
  useEffect(() => {
    clearTimeout(keyCheckTimeout);

    if(!options.sourceId || !key) { return; }

    keyCheckTimeout = setTimeout(() => {
      compositionStore.__CheckCompositionKeyExists({objectId: options.sourceId, key})
        .then(exists => setKeyExists(exists));
    }, 500);
  }, [options.sourceId, key]);

  if(created) {
    return <Redirect to={UrlJoin("/compositions", options.sourceId, key)} />;
  }

  if(creating) {
    const progress = createStatus?.progress?.split("/");

    return (
      <div className={S("composition-selection")}>
        <div className={S("composition-selection__creating")}>
          <div className={S("composition-selection__title")}>
            {
              createStatus ?
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

  let error;
  if(!options.sourceId) {
    error = "Please select source content";
  } else if(!options.name) {
    error = "Please specify a name for your composition";
  } else if(keyExists) {
    error = "A composition with this key already exists for this content";
  }

  return (
    <div className={S("composition-selection")}>
      <form onSubmit={event => event.preventDefault()} className={S("composition-form")}>
        <div className={S("composition-form__title")}>
          <IconButton
            type="button"
            icon={BackIcon}
            onClick={Cancel}
          />
          {
            type === "manual" ?
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
          type !== "ai" ? null :
            <FormTextArea
              label="Prompt (optional)"
              value={options.prompt}
              onChange={event => setOptions({...options, prompt: event.target.value})}
            />
        }
        {
          type !== "ai" ? null :
            <Group my="xs" justify="end">
              <Checkbox
                label="Regenerate Results (if present)"
                checked={options.regenerate}
                onChange={event => setOptions({...options, regenerate: event.currentTarget.checked})}
              />
            </Group>
        }
        <div className={S("composition-form__actions")}>
          <AsyncButton
            tooltip={error}
            disabled={!!error}
            color="gray.1"
            autoContrast
            mt={5}
            w={150}
            onClick={async () => {
              setCreating(true);

              try {
                await compositionStore.CreateComposition({
                  type,
                  sourceObjectId: options.sourceId,
                  name: options.name,
                  key,
                  prompt: options.prompt,
                  regenerate: options.regenerate,
                  StatusCallback: status => setCreateStatus(status),
                });

                setCreated(true);
              } catch(error) {
                // eslint-disable-next-line no-console
                console.error(error);
                setCreating(false);
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

const CompositionSelection = observer(() => {
  const [type, setType] = useState(undefined);

  if(type) {
    return <CompositionForm type={type} Cancel={() => setType(undefined)} />;
  }

  return (
    <div className={S("composition-selection")}>
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
  );
});

export default CompositionSelection;
