import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {useParams} from "wouter";
import {aiStore} from "@/stores/index.js";
import {IconButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, JoinClassNames, ScaleImage, StorageHandler} from "@/utils/Utils.js";
import {AISearchBar, CardDisplaySwitch} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {EntityCard, EntityListItem} from "@/components/common/EntityLists.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";

const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

let batchSize = 36;
export const SearchResults = observer(({showList, preserveScrollPosition, className=""}) => {
  let {queryB58, resultIndex} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);

  if(!aiStore.searchIndex) { return null; }

  resultIndex = typeof resultIndex === "undefined" ? undefined : parseInt(resultIndex);

  let Component = showList ? EntityListItem : EntityCard;
  return (
    <InfiniteScroll
      key={`scroll-${showList}-${aiStore.searchIndex?.versionHash}-${queryB58}`}
      scrollPreservationKey={preserveScrollPosition ? `search-${aiStore.searchIndex?.versionHash}-${queryB58}` : undefined}
      withLoader
      watchList={[query, aiStore.selectedSearchIndexId]}
      batchSize={
        resultIndex ? Math.max(resultIndex + 10, batchSize) :
          batchSize
      }
      Update={async () => await aiStore.Search({query, limit: batchSize})}
      className={JoinClassNames(S(showList ? "entity-list" : "entity-grid"), className)}
    >
      {
        (aiStore.searchResults.results || []).map((result, index) =>
          <Component
            listItem={showList}
            key={`result-${index}`}
            onRender={
              resultIndex !== index ? undefined :
                element => setTimeout(() =>
                  element.parentElement.scrollTo({
                    top: element.getBoundingClientRect().top - 200
                  })
                , 100)
            }
            link={UrlJoin("/", queryB58, index.toString())}
            id={result.objectId}
            anchor
            label={result.name}
            aspectRatio={aiStore.searchResults.type === "image" ? "square" : "landscape"}
            subtitle={result.subtitle}
            image={ScaleImage(result.imageUrl, 100)}
            contain
            className={
              index !== resultIndex ? null :
                S("search-result--selected")
            }
          />
        )
      }
    </InfiniteScroll>
  );
});

const SearchResultsPage = observer(() => {
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
          <span>
            Search Results
          </span>
          <span className={S("browser__header-chevron")}>▶</span>
          <span className={S("browser__header-last")}>
            {query}
          </span>
          <CardDisplaySwitch
            showList={showList}
            setShowList={setShowList}
          />
        </h1>
        <div className={S("list-page", "list-page--search")}>
          <SearchResults
            key={`${aiStore.selectedSearchIndexId}-${queryB58}`}
            preserveScrollPosition
            showList={showList}
          />
        </div>
      </div>
    </div>
  );
});

export default SearchResultsPage;
