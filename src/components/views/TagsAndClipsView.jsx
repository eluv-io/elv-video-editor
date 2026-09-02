import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {ClipSidePanel, TagSidePanel} from "@/components/side_panel/SidePanel.jsx";
import VideoSection from "@/components/video/VideoSection.jsx";
import {ClipTimeline, SummaryTimeline, TagTimeline} from "@/components/timeline/Timeline.jsx";
import {
  editStore,
  groundTruthStore,
  keyboardControlsStore,
  rootStore,
  tagStore,
  videoStore
} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import {ProgressModal} from "@/components/common/Common.jsx";
import SynopsisSection from "@/components/timeline/SynopsisSection.jsx";

const TagsAndClipsView = observer(({mode}) => {
  const [sidePanel, setSidePanel] = useState(undefined);
  const [sidePanelDimensions, setSidePanelDimensions] = useState(undefined);
  const [resetBottomSize, setResetBottomSize] = useState(false);

  const showingAlternateView = videoStore.showSynopsisView || videoStore.showSummaryView;

  useEffect(() => {
    rootStore.SetPage(mode);
    keyboardControlsStore.SetActiveStore(videoStore);

    if(videoStore.ready) {
      groundTruthStore.LoadGroundTruthPools();
      videoStore.LoadMyClips({objectId: videoStore.videoObject?.objectId});

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
    if(mode !== "tags" || !videoStore.ready) { return; }

    videoStore.CheckTagsUpdated()
      .then(updated => updated && videoStore.Reload());
  }, [mode]);

  useEffect(() => {
    if(!sidePanel) { return; }

    const resizeObserver = new ResizeObserver(() =>
      setSidePanelDimensions(sidePanel.getBoundingClientRect())
    );

    resizeObserver.observe(sidePanel);

    return () => resizeObserver?.disconnect();
  }, [sidePanel]);

  useEffect(() => {
    return () => {
      videoStore.ToggleShowVertical(false);
      videoStore.ToggleShowSummaryView(false);
      videoStore.ToggleShowSynopsisView(false);
    };
  }, []);

  // After closing alternate view, set the max size for a moment to resize the bottom panel
  useEffect(() => {
    if(!showingAlternateView) {
      setResetBottomSize(true);

      setTimeout(() => setResetBottomSize(false), 100);
    }
  }, [showingAlternateView]);

  return (
    <>
      {
        !editStore.saving ? null :
          <ProgressModal
            progress={
              30 * editStore.saveProgress.tags +
              30 * editStore.saveProgress.overlay +
              30 * editStore.saveProgress.aggregation
            }
            error={editStore.saveError}
            title="Saving changes..."
            Close={() => editStore.ClearSaveError()}
          />
      }
      <PanelGroup key={videoStore.dropFrame} direction="vertical" className="panel-group">
        <Panel id="top" order={1} defaultSize={Math.max(50)} minSize={25}>
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
              <VideoSection showOverlay showFrameSearch showSave showSynopsis showVertical />
            </Panel>
            {
            !videoStore.showVertical || !videoStore.verticalVideoStore ? null :
              <>
                <PanelResizeHandle />
                <Panel id="right" order={3}>
                  <VideoSection
                    name="Vertical Video"
                    store={videoStore.verticalVideoStore}
                    vertical
                    Close={() => videoStore.ToggleShowVertical(false)}
                  />
                </Panel>
              </>
          }
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <Panel
          id="bottom"
          order={2}
          defaultSize={40}
          minSize={showingAlternateView ? 55 : undefined}
          maxSize={resetBottomSize ? 50 : undefined}
        >
          {
            videoStore.showSynopsisView ?
              <SynopsisSection /> :
              videoStore.showSummaryView ?
                <SummaryTimeline /> :
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
