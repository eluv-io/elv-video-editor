import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch} from "wouter";
import {GroundTruthPoolBrowser} from "@/components/nav/Browser.jsx";
import GroundTruthPool from "@/components/ground_truth/GroundTruthPool.jsx";
import GroundTruthEntity from "@/components/ground_truth/GroundTruthEntity.jsx";
import GroundTruthAsset from "@/components/ground_truth/GroundTruthAsset.jsx";

const GroundTruthView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("ground-truth");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <Switch>
      <Route path=":poolId/entities/:entityId/assets/:assetIndexOrId">
        <GroundTruthAsset />
      </Route>
      <Route path=":poolId/entities/:entityId">
        <GroundTruthEntity />
      </Route>
      <Route path=":poolId">
        <GroundTruthPool />
      </Route>
      <Route path="/" exact>
        <GroundTruthPoolBrowser />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
});

export default GroundTruthView;
