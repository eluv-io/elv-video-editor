import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {aiStore} from "@/stores/index.js";
import {CreateModuleClassMatcher, ParseSearchQuery} from "@/utils/Utils.js";
import {AISearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {EntityCard} from "@/components/common/EntityLists.jsx";
import {Redirect, useParams} from "wouter";

const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

let batchSize = 20;
const TitleResults = observer(({queryB58}) =>
  <InfiniteScroll
    scrollPreservationKey="titles"
    withLoader
    watchList={[queryB58, aiStore.searchImageFrameUrl, aiStore.searchSettings.key]}
    Update={
      async (limit, initial) =>
        await aiStore.Search({
          query: aiStore.client.utils.FromB58ToStr(queryB58 || ""),
          limit: batchSize,
          initial,
          clipsContentLevel: true
        })
    }
    className={S("entity-grid", "entity-grid--titles")}
  >
    {
      (aiStore.searchResults.results || []).map((result, index) =>
        <EntityCard
          key={`result-${index}`}
          link={UrlJoin("~/titles", queryB58 || "", "title", result.objectId)}
          id={result.objectId}
          label={result.name}
          aspectRatio={"portrait"}
          image={result.titleImageUrl || result.imageUrl}
          backupImage={result.imageUrl}
          imageWidth={400}
          badge={
            !queryB58 || !result.score ? null :
              <div className={S("search-result__score")}>
                Score: {result.score}
              </div>
          }
          showImageTooltip={result.type === "frame"}
          contain
          className={S("search-result")}
        />
      )
    }
  </InfiniteScroll>
);

const Titles = observer(() => {
  let {queryB58} = useParams();
  const {mode, query} = ParseSearchQuery({queryB58});

  useEffect(() => {
    if(aiStore.searchResults.key !== `${aiStore.searchSettings.key}-${query}-${mode}-${aiStore.searchImageFrameUrl || ""}`) {
      aiStore.ClearSearchResults();
    }
  }, [queryB58, aiStore.searchSettings.key]);


  if(
    (mode === "frame-image" && !aiStore.searchImageFrameUrl)
  ) {
    return <Redirect to="~/titles" />;
  }

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <AISearchBar
          clipOnly
          basePath="/"
          initialQuery={query}
          initialMode={mode}
          onObjectSelect={({item, navigate}) =>
            item.objectId && navigate(UrlJoin("~/titles", "title", item.objectId))
          }
        />
        <div className={S("list-page", "list-page--titles")}>
          <TitleResults key={aiStore.searchResults.key} queryB58={queryB58} />
        </div>
      </div>
    </div>
  );
});

export default Titles;
