import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import PanelView from "@/components/side_panel/PanelView.jsx";
import {compositionStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import CompositionTimeline from "@/components/compositions/CompositionTimeline.jsx";
import CompositionVideoSection from "@/components/compositions/CompositionVideoSection.jsx";
import {DraggedClip} from "@/components/compositions/Clips.jsx";
import {useParams} from "wouter";

const CompositionsView = observer(({mode}) => {
  const {objectId} = useParams();
  useEffect(() => {
    rootStore.SetPage("compositions");
    keyboardControlsStore.SetActiveStore(compositionStore.videoStore);

    if(objectId) {
      compositionStore.SetCompositionObject({objectId});
    }
  }, [objectId]);

  return (
    <>
      <PanelView
        sidePanelContent={
          mode === "tags" ?
            <TagSidePanel /> :
            <ClipSidePanel />
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
        initialTopPanelProportion={0.6}
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
