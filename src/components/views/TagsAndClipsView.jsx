import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import {editStore, keyboardControlsStore, rootStore, tagStore, trackStore, videoStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import {Modal} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher();

const SaveProgressModal = observer(() => {
  const tagProgress = 47.5 * editStore.saveProgress.tags;
  const overlayProgress = 47.5 * editStore.saveProgress.overlay;

  // Last 5% is reserved for finalizing
  return (
    <Modal
      title="Saving changes..."
      opened
      centered
      onClose={() => {}}
      withCloseButton={false}
    >
      <div className={S("progress")}>
        <progress
          value={tagProgress + overlayProgress}
          max={100}
        />
      </div>
    </Modal>
  );
});

const TagsAndClipsView = observer(({mode}) => {
  const [sidePanel, setSidePanel] = useState(undefined);
  const [sidePanelDimensions, setSidePanelDimensions] = useState(undefined);

  useEffect(() => {
    rootStore.SetPage(mode);
    keyboardControlsStore.SetActiveStore(videoStore);

    if(videoStore.ready) {
      const clipPoints = videoStore.ParseClipParams();

      if(!clipPoints) { return; }

      videoStore.FocusView(clipPoints);

      if(clipPoints.isolate) {
        tagStore.IsolateTag({
          startTime: clipPoints.inTime || 0,
          endTime: clipPoints.outTime || videoStore.duration
        });
      }
    }
  }, [videoStore.ready]);

  useEffect(() => {
    if(!sidePanel) { return; }

    const resizeObserver = new ResizeObserver(() =>
      setSidePanelDimensions(sidePanel.getBoundingClientRect())
    );

    resizeObserver.observe(sidePanel);

    return () => resizeObserver?.disconnect();
  }, [sidePanel]);

  const trackCount = mode === "tags" ?
    trackStore.metadataTracks.length :
    trackStore.clipTracks.length;

  return (
    <>
      { !editStore.saving ? null : <SaveProgressModal /> }
      <PanelGroup direction="vertical" className="panel-group">
        <Panel id="top" order={1} defaultSize={Math.max(40, 60 - trackCount * 3)} minSize={30}>
          <PanelGroup direction="horizontal" className="panel-group">
            <Panel id="side-panel" order={1} style={{"--panel-width": `${sidePanelDimensions?.width}px`}} defaultSize={30} minSize={100 * 425 / window.innerWidth}>
              {
                mode === "tags" ?
                  <TagSidePanel setElement={setSidePanel} /> :
                  <ClipSidePanel setElement={setSidePanel} />
              }
            </Panel>
            <PanelResizeHandle />
            <Panel id="content" order={2}>
              <VideoSection showOverlay />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <Panel id="bottom" order={2}>
          {
            mode === "tags" ?
              <TagTimeline /> :
              <ClipTimeline />
          }
        </Panel>
      </PanelGroup>
    </>
  );
});

export default TagsAndClipsView;
