import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch, useParams} from "wouter";
import {GroundTruthPoolBrowser} from "@/components/nav/Browser.jsx";
import GroundTruthPool from "@/components/ground_truth/GroundTruthPool.jsx";
import GroundTruthEntity from "@/components/ground_truth/GroundTruthEntity.jsx";
import GroundTruthAsset from "@/components/ground_truth/GroundTruthAsset.jsx";

const Wrapper = observer(({children}) => {
  const {poolId} = useParams();

  useEffect(() => {
    rootStore.SetSubpage(poolId);
  }, [rootStore.page, poolId]);

  return children;
});

const GroundTruthView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("groundTruth");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <Switch>
      <Route path=":poolId/entities/:entityId/assets/:assetIndexOrId">
        <Wrapper>
          <GroundTruthAsset />
        </Wrapper>
      </Route>
      <Route path=":poolId/entities/:entityId">
        <Wrapper>
          <GroundTruthEntity />
        </Wrapper>
      </Route>
      <Route path=":poolId">
        <Wrapper>
          <GroundTruthPool />
        </Wrapper>
      </Route>
      <Route path="/" exact>
        <Wrapper>
          <GroundTruthPoolBrowser />
        </Wrapper>
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
});

export default GroundTruthView;
