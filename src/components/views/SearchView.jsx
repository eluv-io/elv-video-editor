import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {rootStore} from "@/stores/index.js";
import {Redirect, Route, Switch} from "wouter";
import SearchResults from "@/components/search/SearchResults.jsx";
import SearchResult from "@/components/search/SearchResult.jsx";

const SimpleView = observer(() => {
  useEffect(() => {
    rootStore.SetPage("search");
  }, []);

  return (
    <Switch>
      <Route path="/:queryB58/:resultIndex">
        <SearchResult />
      </Route>
      <Route path="/:queryB58">
        <SearchResults />
      </Route>
      <Route>
        <Redirect to="~/" />
      </Route>
    </Switch>
  );
});

export default SimpleView;
