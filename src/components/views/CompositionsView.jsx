import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {CompositionSidePanel} from "@/components/side_panel/SidePanel.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {compositionStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import CompositionTimeline from "@/components/compositions/CompositionTimeline.jsx";
import CompositionVideoSection from "@/components/compositions/CompositionVideoSection.jsx";
import {DraggedClip} from "@/components/compositions/Clips.jsx";
import {useParams} from "wouter";
import {Linkish} from "@/components/common/Common.jsx";

const CompositionsView = observer(() => {
  const {objectId, compositionKey} = useParams();

  useEffect(() => {
    rootStore.SetPage("compositions");
    rootStore.SetSubpage(objectId);
    keyboardControlsStore.SetActiveStore(compositionStore.videoStore);

    if(objectId) {
      compositionStore.SetCompositionObject({objectId, compositionKey});
    }
  }, [objectId]);

  if(rootStore.errorMessage) {
    return (
      <div className="error">
        <div>Unable to load content: </div>
        <div>{rootStore.errorMessage}</div>
        <Linkish to="~/" styled>Return to Content Browser</Linkish>
      </div>
    );
  }

  return (
    <>
      <PanelView
        sidePanelContent={
          !objectId ? null :
            <CompositionSidePanel />
        }
        mainPanelContent={
          <PanelView
            isSubpanel
            initialSidePanelProportion={0.5}
            sidePanelContent={
              !compositionStore.selectedClip ? null :
                <CompositionVideoSection
                  clipView
                  key={`clip-${compositionStore.selectedClip.storeKey}`}
                  store={compositionStore.selectedClipStore}
                />
            }
            mainPanelContent={
              !compositionStore.compositionObject ? null :
                <CompositionVideoSection store={compositionStore.videoStore} />
            }
          />
        }
        bottomPanelContent={<CompositionTimeline />}
        initialTopPanelProportion={objectId ? 0.6 : 0.3}
        minSizes={{
          mainPanel: 700,
          sidePanel: 350,
          bottomPanel: 260
        }}
      />
      <DraggedClip />
    </>
  );
});

export default CompositionsView;
