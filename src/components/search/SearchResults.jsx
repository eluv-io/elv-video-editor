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
export const GroupedSearchResults = observer(({
  showList,
  groupKey="f_music",
  scrollPreservationKey,
  small,
  className="",
  groupClassName=""
}) => {
  let {queryB58, resultIndex} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);

  if(!aiStore.searchIndex) { return null; }

  resultIndex = typeof resultIndex === "undefined" ? undefined : parseInt(resultIndex);

  let groups = [];
  let groupContent = {};
  aiStore.searchResults.results?.forEach(((result, index) => {
    const group = result.sources?.[0]?.fields?.[groupKey]?.[0];

    if(!group) {
      return;
    }

    if(!groups.includes(group)) {
      groups.push(group);
      groupContent[group] = [{...result, resultIndex: index}];
    } else {
      groupContent[group].push({...result, resultIndex: index});
    }
  }));

  let Component = showList ? EntityListItem : EntityCard;
  return (
    <InfiniteScroll
      key={`scroll-${showList}-${aiStore.searchIndex?.versionHash}-${queryB58}`}
      scrollPreservationKey={scrollPreservationKey ? `search-${aiStore.searchIndex?.versionHash}-${queryB58}-${scrollPreservationKey}` : undefined}
      withLoader
      watchList={[query, aiStore.selectedSearchIndexId, aiStore.filterLowQualitySearchResults]}
      batchSize={
        resultIndex ? Math.max(resultIndex + 10, batchSize) :
          batchSize
      }
      Update={async (limit, initial) => await aiStore.Search({query, limit: batchSize, initial})}
      className={JoinClassNames(S("grouped-entity-list", small ? "grouped-entity-list--small" : ""), className)}
    >
      {
        groups.map(groupName =>
          <div key={`group-${groupName}`} className={S("grouped-entity-list__group")}>
            <h2 className={S("grouped-entity-list__title")}>
              { groupName }
            </h2>
            <div className={JoinClassNames(S(showList ? "entity-list" : "entity-grid"), groupClassName)}>
              {
                (groupContent[groupName] || []).map(result =>
                  <Component
                    listItem={showList}
                    key={`result-${result.resultIndex}`}
                    onRender={
                      resultIndex !== result.resultIndex ? undefined :
                        element => setTimeout(() =>
                          element.parentElement.scrollTo({
                            top: element.getBoundingClientRect().top - 200
                          })
                        , 100)
                    }
                    link={UrlJoin("/", queryB58, result.resultIndex.toString())}
                    id={result.objectId}
                    label={result.name}
                    aspectRatio={aiStore.searchResults.type === "image" ? "square" : "landscape"}
                    subtitle={result.subtitle}
                    image={ScaleImage(result.imageUrl, 100)}
                    badge={
                      !result.score ? null :
                        <div className={S("search-result__score")}>
                          Score: {result.score}
                        </div>
                    }
                    contain
                    className={S("search-result", result.resultIndex === resultIndex ? "search-result--selected" : "")}
                  />
                )
              }
            </div>
          </div>
        )
      }
    </InfiniteScroll>
  );
});

export const SearchResults = observer(({showList, scrollPreservationKey, className=""}) => {
  let {queryB58, resultIndex} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);

  if(!aiStore.searchIndex) { return null; }

  resultIndex = typeof resultIndex === "undefined" ? undefined : parseInt(resultIndex);

  let Component = showList ? EntityListItem : EntityCard;

  return (
    <InfiniteScroll
      key={`scroll-${showList}-${aiStore.searchIndex?.versionHash}-${queryB58}`}
      scrollPreservationKey={scrollPreservationKey ? `search-${aiStore.searchIndex?.versionHash}-${queryB58}-${scrollPreservationKey}` : undefined}
      withLoader
      watchList={[query, aiStore.selectedSearchIndexId, aiStore.filterLowQualitySearchResults]}
      batchSize={
        resultIndex ? Math.max(resultIndex + 10, batchSize) :
          batchSize
      }
      Update={async (limit, initial) => await aiStore.Search({query, limit: batchSize, initial})}
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
            label={result.name}
            aspectRatio={aiStore.searchResults.type === "image" ? "square" : "landscape"}
            subtitle={result.subtitle}
            image={ScaleImage(result.imageUrl, 100)}
            badge={
              !result.score ? null :
                <div className={S("search-result__score")}>
                  Score: {result.score}
                </div>
            }
            contain
            className={S("search-result", index === resultIndex ? "search-result--selected" : "")}
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
    if(aiStore.searchResults.key !== `${aiStore.searchIndex?.versionHash}-${queryB58}-${aiStore.filterLowQualitySearchResults}`) {
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
            {query.startsWith("music:") ? query?.split("music:")[1] || "All Results" : query}
          </span>
          <div className={S("browser__action--right")}>
            <button
              key={aiStore.filterLowQualitySearchResults}
              className={S("browser__toggle-button")}
              onClick={() => {
                aiStore.SetSearchQualityFilter(!aiStore.filterLowQualitySearchResults);
                aiStore.ClearSearchResults();
              }}
            >
              {
                aiStore.filterLowQualitySearchResults ?
                  "Show All Results" :
                  "Show Only High Score Results"
              }
            </button>
          </div>
          <CardDisplaySwitch
            showList={showList}
            setShowList={setShowList}
          />
        </h1>
        <div className={S("list-page", "list-page--search")}>
          {
            query.startsWith("music:") ?
              <GroupedSearchResults
                key={`${aiStore.selectedSearchIndexId}-${queryB58}`}
                groupKey="f_music"
                scrollPreservationKey="main"
                showList={showList}
              /> :
              <SearchResults
                key={`${aiStore.selectedSearchIndexId}-${queryB58}`}
                scrollPreservationKey="main"
                showList={showList}
              />
          }
        </div>
      </div>
    </div>
  );
});

export default SearchResultsPage;
