import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {CompositionSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {compositionStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import CompositionTimeline from "@/components/compositions/CompositionTimeline.jsx";
import CompositionVideoSection from "@/components/compositions/CompositionVideoSection.jsx";
import {DraggedClip} from "@/components/compositions/Clips.jsx";
import {useParams} from "wouter";
import {Linkish} from "@/components/common/Common.jsx";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const CompositionsView = observer(() => {
  const {objectId, compositionKey} = useParams();

  useEffect(() => {
    rootStore.SetPage("compositions");
    rootStore.SetSubpage(objectId);
    keyboardControlsStore.SetActiveStore(compositionStore.videoStore);

    if(objectId) {
      rootStore.SetSelectedObjectId(objectId);
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

  if(!objectId) {
    // Selection view
    return (
      <PanelGroup direction="vertical" className="panel-group">
        <Panel minSize={30} defaultSize={30}>
          <CompositionVideoSection store={compositionStore.videoStore} />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={50}>
          <CompositionTimeline />
        </Panel>
      </PanelGroup>
    );
  }

  return (
    <>
      <PanelGroup direction="vertical" className="panel-group">
        <Panel minSize={35} defaultSize={65}>
          <PanelGroup direction="horizontal" className="panel-group">
            <Panel defaultSize={25}>
              <CompositionSidePanel />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <PanelGroup direction="horizontal" className="panel-group">
                {
                  !compositionStore.selectedClip ? null :
                    <>
                      <Panel>
                        <CompositionVideoSection
                          clipView
                          key={`clip-${compositionStore.selectedClip.storeKey}`}
                          store={compositionStore.selectedClipStore}
                        />
                      </Panel>
                    </>
                }
                <PanelResizeHandle />
                <Panel>
                  <CompositionVideoSection store={compositionStore.videoStore} />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
          <PanelResizeHandle />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={32}>
          <CompositionTimeline />
        </Panel>
      </PanelGroup>
      <DraggedClip />
    </>
  );
});

export default CompositionsView;
