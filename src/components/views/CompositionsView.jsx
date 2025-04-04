import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {CompositionSidePanel, CompositionBrowserPanel} from "@/components/side_panel/SidePanel.jsx";
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
    compositionStore.SetFilter("");
    keyboardControlsStore.SetActiveStore(compositionStore.videoStore);

    if(objectId) {
      compositionStore.LoadMyClips({objectId});
      compositionStore.SetCompositionObject({objectId, compositionKey})
        .then(() => rootStore.SetSelectedObjectId(objectId, compositionStore.videoStore.sourceVideoStore.name));
    }
  }, [objectId, compositionKey]);

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
        <Panel id="top" order={1} minSize={30} defaultSize={30}>
          <PanelGroup direction="horizontal" className="panel-group">
            {
              !rootStore.selectedObjectId ? null :
                <Panel id="browser" order={1}>
                  <CompositionBrowserPanel />
                </Panel>
            }
            <PanelResizeHandle />
            <Panel id="video" order={2} defaultSize={50}>
              <CompositionVideoSection store={compositionStore.videoStore} />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <Panel id="bottom" order={2} minSize={50}>
          <CompositionTimeline />
        </Panel>
      </PanelGroup>
    );
  }

  return (
    <>
      <PanelGroup direction="vertical" className="panel-group">
        <Panel id="top" minSize={35} order={1} defaultSize={65}>
          <PanelGroup direction="horizontal" className="panel-group">
            <Panel id="side-panel" order={1} defaultSize={25}>
              <CompositionSidePanel />
            </Panel>
            <PanelResizeHandle />
            <Panel id="videos" order={2}>
              <PanelGroup direction="horizontal" className="panel-group">
                {
                  !compositionStore.selectedClip ? null :
                    <>
                      <Panel id="clip" order={1}>
                        <CompositionVideoSection
                          clipView
                          key={`clip-${compositionStore.selectedClip.storeKey}`}
                          store={compositionStore.selectedClipStore}
                        />
                      </Panel>
                    </>
                }
                <PanelResizeHandle />
                <Panel id="content" order={2}>
                  <CompositionVideoSection store={compositionStore.videoStore} />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
          <PanelResizeHandle />
        </Panel>
        <PanelResizeHandle />
        <Panel id="bottom" order={2} minSize={32}>
          <CompositionTimeline />
        </Panel>
      </PanelGroup>
      <DraggedClip />
    </>
  );
});

export default CompositionsView;
