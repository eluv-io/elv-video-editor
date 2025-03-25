import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import ManualCompositionSelectionImage from "@/assets/images/composition-manual.svg";
import AICompositionSelectionImage from "@/assets/images/composition-ai.svg";
import {Loader, Modal} from "@/components/common/Common.jsx";
import {LibraryBrowser, ObjectBrowser} from "@/components/nav/Browser.jsx";
import {Redirect} from "wouter";
import {compositionStore} from "@/stores/index.js";

const S = CreateModuleClassMatcher(TimelineStyles);

const TargetLibrarySelectionModal = observer(({Select, Cancel}) => {
  return (
    <Modal withCloseButton={false} opened centered size={1000} onClose={Cancel}>
      <LibraryBrowser
        Select={Select}
        title="Select a library for your new composition"
        className={S("composition-selection__browser")}
      />
    </Modal>
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
            title="Select source content for your composition"
            videoOnly
            Back={() => setLibraryId(undefined)}
            Select={objectId => Select({libraryId, objectId})}
            className={S("composition-selection__browser")}
          /> :
          <LibraryBrowser
            title="Select source content for your composition"
            Select={libraryId => setLibraryId(libraryId)}
            className={S("composition-selection__browser")}
          />
      }
    </Modal>
  );
});

const CompositionSelection = observer(() => {
  const [creating, setCreating] = useState(false);
  const [compositionId, setCompositionId] = useState(undefined);
  const [options, setOptions] = useState({
    type: undefined,
    sourceId: undefined,
    targetLibraryId: undefined,
    prompt: "",
    length: undefined
  });

  useEffect(() => {
    if(creating || !options.targetLibraryId) { return; }

    setCreating(true);
    setOptions({type: undefined, prompt: ""});

    compositionStore.CreateCompositionObject({
      sourceObjectId: options.sourceId,
      libraryId: options.targetLibraryId
    })
      .then(objectId => setCompositionId(objectId))
      // eslint-disable-next-line no-console
      .catch(error => console.error(error))
      .finally(() => setCreating(false));
  }, [options]);

  if(compositionId) {
    return <Redirect to={`/compositions/${compositionId}`} />;
  }

  if(creating) {
    return (
      <div className={S("composition-selection")}>
        <div className={S("composition-selection__creating")}>
          <div className={S("composition-selection__title")}>
            Initializing Composition...
          </div>
          <Loader />
        </div>
      </div>
    );
  }

  if(options.type) {
    if(!options.sourceId){
      return (
        <SourceSelectionModal
          Select={({objectId}) => setOptions({...options, sourceId: objectId})}
          Cancel={() => setOptions({...options, type: undefined})}
        />
      );
    } else {
      return (
        <TargetLibrarySelectionModal
          Select={libraryId => setOptions({...options, targetLibraryId: libraryId})}
          Cancel={() => setOptions({...options, type: undefined, sourceId: undefined})}
        />
      );
    }
  }

  return (
    <div className={S("composition-selection")}>
      <button onClick={() => setOptions({...options, type: "manual"})} className={S("selection-block", "selection-block--manual")}>
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
      <button onClick={() => setOptions({...options, type: "ai"})} className={S("selection-block", "selection-block--ai")}>
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
