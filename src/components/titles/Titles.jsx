import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React from "react";
import {aiStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {AISearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {EntityCard} from "@/components/common/EntityLists.jsx";

const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

let batchSize = 20;
const TitleResults = observer(() => {

  return (
    <InfiniteScroll
      scrollPreservationKey="titles"
      withLoader
      watchList={[aiStore.searchSettings.key]}
      Update={async () => await aiStore.GetTitles({limit: batchSize})}
      className={S("entity-grid", "entity-grid--titles")}
    >
      {
        (aiStore.titles || []).map((result, index) =>
          <EntityCard
            key={`result-${index}`}
            link={UrlJoin("~/titles", result.objectId)}
            id={result.objectId}
            label={result.name}
            aspectRatio={"portrait"}
            image={result.imageUrl}
            imageWidth={400}
            showImageTooltip={result.type === "frame"}
            contain
            className={S("search-result")}
          />
        )
      }
    </InfiniteScroll>
  );
});

const Titles = observer(() => {
  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <AISearchBar
          basePath="~/search"
          onObjectSelect={({item, navigate}) =>
            item.objectId && navigate(UrlJoin("~/titles", item.objectId))
          }
        />
        <div className={S("list-page", "list-page--titles")}>
          <TitleResults />
        </div>
      </div>
    </div>
  );
});

export default Titles;
