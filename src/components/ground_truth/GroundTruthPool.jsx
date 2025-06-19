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
const Entities = observer(({filter}) => {
  const {poolId} = useParams();
  const [entities, setEntities] = useState([]);
  const [limit, setLimit] = useState(batchSize);
  const pool = groundTruthStore.pools[poolId];

  filter = filter.toLowerCase();

  useEffect(() => {
    setEntities(
      Object.keys(pool.metadata.entities || {})
        .map(entityId => {
          const entity = pool.metadata.entities[entityId];
          const anchorImage = (entity.sample_files?.find(item => item.anchor) || entity.sample_files?.[0])?.link;

          return {
            id: entityId,
            label: entity.label,
            image: anchorImage,
            attrs: Object.values(entity.meta || {})
          };
        })
        .filter(entity =>
          !filter ||
          entity.label?.toLowerCase()?.includes(filter) ||
          entity.attrs.find(attr => attr?.toLowerCase()?.includes(filter))
        )
        .slice(0, limit)
    );
  }, [limit, filter]);

  if(!pool) {
    return null;
  }

  return (
    <InfiniteScroll
      scrollPreservationKey={`pool-${poolId}`}
      watchList={[filter]}
      batchSize={batchSize}
      Update={newLimit => setLimit(Math.max(limit, newLimit))}
      className={S("entity-grid")}
    >
      {
        entities.map(entity =>
          <Linkish to={UrlJoin("/", poolId, "entities", entity.id)} key={`entity-${entity.id}`} className={S("entity-card")}>
            <div className={S("entity-card__image-container")}>
              {
                !entity.image?.url ?
                  <div className={S("entity-card__image", "entity-card__image--blank")}>
                    <Icon icon={ImageIcon} />
                  </div>:
                  <LoaderImage
                    width={300}
                    src={entity.image?.url}
                    loaderDelay={25}
                    loaderAspectRatio={1}
                    className={S("entity-card__image")}
                  />
              }
            </div>
            <div className={S("entity-card__text")}>
              <Tooltip openDelay={500} label={entity.label}>
                <div className={S("entity-card__title", "ellipsis")}>
                  { entity.label }
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

const GroundTruthPool = observer(() => {
  const {poolId} = useParams();

  const [filter, setFilter] = useState("");
  const pool = groundTruthStore.pools[poolId] || {};

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <SearchBar placeholder="Filter Entities" filter={filter} setFilter={setFilter}/>
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Ground Truth Pools"
            to="/"
            className={S("browser__header-back")}
          />
          <Linkish to="/">
            All Ground Truth
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <span>
            {pool.name || pool.objectId}
          </span>
        </h1>
        {
          !pool?.metadata ?
            <div className={S("browser-table", "browser-table--loading")}>
              <Loader/>
            </div> :
            <Entities filter={filter} />
        }
      </div>
    </div>
  );
});

export default GroundTruthPool;
