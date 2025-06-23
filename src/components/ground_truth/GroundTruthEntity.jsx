import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {useParams} from "wouter";
import {groundTruthStore} from "@/stores/index.js";
import {Icon, IconButton, Linkish, Loader, LoaderImage} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {SearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {Tooltip} from "@mantine/core";

import ImageIcon from "@/assets/icons/v2/asset.svg";
import MenuIcon from "@/assets/icons/v2/dots-vertical.svg";
import BackIcon from "@/assets/icons/v2/back.svg";

const S = CreateModuleClassMatcher(BrowserStyles, GroundTruthStyles);

let batchSize = 24;
const Assets = observer(({filter}) => {
  const {poolId, entityId} = useParams();

  const pool = groundTruthStore.pools[poolId];
  const entity = pool?.metadata?.entities?.[entityId];
  const [assets, setAssets] = useState([]);
  const [limit, setLimit] = useState(batchSize);

  filter = filter.toLowerCase();

  useEffect(() => {
    setAssets(
      (entity?.sample_files || [])
        .map(asset => ({
          ...asset,
          filename: asset.link?.["/"]?.split("/")?.slice(-1)[0]
        }))
        .filter(asset =>
          !filter ||
          asset.label?.toLowerCase()?.includes(filter) ||
          asset.filename?.toLowerCase()?.includes(filter)
        )
        .slice(0, limit)
    );
  }, [limit, filter]);

  if(!pool) {
    return null;
  }

  return (
    <InfiniteScroll
      watchList={[filter]}
      batchSize={batchSize}
      Update={newLimit => setLimit(Math.max(limit, newLimit))}
      className={S("entity-grid")}
    >
      {
        assets.map((asset, index) =>
          <Linkish
            to={UrlJoin("/", poolId, "entities", entityId, "assets", asset.id || index.toString())}
            key={`asset-${asset.filename || index}`}
            className={S("entity-card")}
          >
            <div className={S("entity-card__image-container")}>
              {
                !asset.link?.url ?
                  <div className={S("entity-card__image", "entity-card__image--blank")}>
                    <Icon icon={ImageIcon} />
                  </div>:
                  <LoaderImage
                    width={300}
                    src={asset.link?.url}
                    loaderAspectRatio={1}
                    className={S("entity-card__image", "entity-card__image--contain")}
                  />
              }
            </div>
            <div className={S("entity-card__text")}>
              <Tooltip openDelay={500} label={asset.label || asset.filename}>
                <div className={S("entity-card__title", "ellipsis")}>
                  { asset.label || asset.filename }
                </div>
              </Tooltip>
              <div className={S("entity-card__actions")}>
                <IconButton
                  icon={MenuIcon}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                />
              </div>
            </div>
          </Linkish>
        )
      }
    </InfiniteScroll>
  );
});

const GroundTruthEntity = observer(() => {
  const {poolId, entityId} = useParams();

  const [filter, setFilter] = useState("");
  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId];

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <SearchBar placeholder="Filter Assets" filter={filter} setFilter={setFilter}/>
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Ground Truth Pool"
            to={UrlJoin("/", poolId)}
            className={S("browser__header-back")}
          />
          <Linkish to="/">
            All Ground Truth
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <Linkish to={UrlJoin("/", poolId)}>
            {pool.name || pool.objectId}
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <span>
            {entity.label || entityId}
          </span>
        </h1>
        {
          !entity ?
            <div className={S("browser-table", "browser-table--loading")}>
              <Loader/>
            </div> :
            <Assets filter={filter} />
        }
      </div>
    </div>
  );
});

export default GroundTruthEntity;
