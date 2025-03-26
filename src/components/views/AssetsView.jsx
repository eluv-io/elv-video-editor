import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {AssetSidePanel} from "@/components/side_panel/SidePanel.jsx";
import {useParams} from "wouter";
import SelectedAsset from "@/components/assets/Assets.jsx";
import {rootStore, assetStore} from "@/stores/index.js";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";

const AssetsView = observer(() => {
  const {assetKey} = useParams();

  useEffect(() => {
    assetStore.ClearSelectedTags();
    rootStore.SetPage("assets");
    rootStore.SetSubpage(assetKey);
  }, [assetKey]);

  return (
    <PanelGroup direction="horizontal" className="panel-group">
      <Panel minSize={30}>
        <AssetSidePanel />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={30}>
        <SelectedAsset key={assetKey} assetKey={assetKey} />
      </Panel>
    </PanelGroup>
  );
});

export default AssetsView;
