import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch} from "wouter";
import Titles from "@/components/titles/Titles.jsx";
import Title from "@/components/titles/Title.jsx";
import TitleMetadata from "@/components/titles/TitleMetadata.jsx";

const TitlesView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("titles");
  }, []);

  return (
    <Switch>
      <Route path="/:queryB58?/title/:titleId/metadata">
        <TitleMetadata />
      </Route>
      <Route path="/:queryB58?/title/:titleId/:clipId">
        Title Clip Details
      </Route>
      <Route path="/:queryB58?/title/:titleId">
        <Title />
      </Route>
      <Route path="/:queryB58?">
        <Titles />
      </Route>
      <Route>
        <Redirect to="~/" />
      </Route>
    </Switch>
  );
});

export default TitlesView;
