import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {keyboardControlsStore, rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch} from "wouter";
import {GroundTruthPoolBrowser} from "@/components/nav/Browser.jsx";

const GroundTruthView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("ground-truth");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  return (
    <Switch>
      <Route path="/poolId/entities/:entityId">
      </Route>
      <Route path="/poolId/entities">
      </Route>
      <Route path=":poolId">
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
