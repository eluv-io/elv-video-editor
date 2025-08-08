import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {useParams} from "wouter";
import {aiStore} from "@/stores/index.js";
import {IconButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, ScaleImage, StorageHandler} from "@/utils/Utils.js";
import {AISearchBar, CardDisplaySwitch} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {EntityCard, EntityListItem} from "@/components/common/EntityLists.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";

const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

let batchSize = 36;
const Results = observer(({showList}) => {
  let {queryB58} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);

  if(!aiStore.searchIndex) { return null; }

  let Component = showList ? EntityListItem : EntityCard;
  return (
    <InfiniteScroll
      key={`scroll-${showList}-${aiStore.searchIndex?.versionHash}-${queryB58}`}
      scrollPreservationKey={`search-${aiStore.searchIndex?.versionHash}-${queryB58}`}
      withLoader
      watchList={[query, aiStore.selectedSearchIndexId]}
      batchSize={batchSize}
      Update={async () => await aiStore.Search({query, limit: batchSize})}
      className={S(showList ? "entity-list" : "entity-grid")}
    >
      {
        (aiStore.searchResults.results || []).map((result, index) =>
          <Component
            listItem={showList}
            key={`result-${index}`}
            link={UrlJoin("/", queryB58, index.toString())}
            label={result.name}
            aspectRatio={aiStore.searchResults.type === "image" ? "square" : "landscape"}
            subtitle={result.subtitle}
            image={ScaleImage(result.imageUrl, 100)}
            contain
          />
        )
      }
    </InfiniteScroll>
  );
});

const SearchResults = observer(() => {
  const [showList, setShowList] = useState(StorageHandler.get({type: "session", key: "search-display"}) || false);

  let {queryB58} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);

  useEffect(() => {
    if(aiStore.searchResults.key !== `${aiStore.searchIndex?.versionHash}-${queryB58}`) {
      aiStore.ClearSearchResults();
    }
  }, [queryB58, aiStore.searchIndex?.versionHash]);

  useEffect(() => {
    showList ?
      StorageHandler.set({type: "session", key: "search-display", value: "true"}) :
      StorageHandler.remove({type: "session", key: "search-display"});
  }, [showList]);

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <AISearchBar basePath="/" initialQuery={query} />
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Browse"
            to="~/"
            className={S("browser__header-back")}
          />
          <div>
            Search Results
          </div>
          <span className={S("browser__header-chevron")}>▶</span>
          <div>
            { query }
          </div>
          <CardDisplaySwitch
            showList={showList}
            setShowList={setShowList}
          />
        </h1>
        <div className={S("list-page", "list-page--search")}>
          <Results key={`${aiStore.selectedSearchIndexId}-${queryB58}`} showList={showList} />
        </div>
      </div>
    </div>
  );
});

export default SearchResults;
