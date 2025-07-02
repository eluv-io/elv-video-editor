import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useLocation, useParams} from "wouter";
import {groundTruthStore} from "@/stores/index.js";
import {IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, StorageHandler} from "@/utils/Utils.js";
import {CardDisplaySwitch, SearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";

import BackIcon from "@/assets/icons/v2/back.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import CreateIcon from "@/assets/icons/v2/add2.svg";
import {
  EntityCard, EntityListItem,
  GroundTruthEntityForm, GroundTruthEntityMenu,
  GroundTruthPoolForm,
  GroundTruthPoolSaveButton
} from "@/components/ground_truth/GroundTruthForms.jsx";

const S = CreateModuleClassMatcher(BrowserStyles, GroundTruthStyles);

const PoolDetails = observer(() => {
  const {poolId} = useParams();
  const [editing, setEditing] = useState(false);

  const pool = groundTruthStore.pools[poolId];

  if(!pool || !pool.metadata) { return null; }

  let entityCount = (Object.keys(pool.metadata.entities || {})).length || 0;
  let assetCount = Object.keys(pool.metadata.entities || {}).reduce((acc, entityKey) => {
    return acc + (pool.metadata.entities[entityKey]?.sample_files?.length || 0);
  }, 0);

  return (
    <>
      {
        !editing ? null :
          <GroundTruthPoolForm
            pool={pool}
            Close={() => setEditing(false)}
          />
      }
      <div className={S("details")}>
        <IconButton
          icon={EditIcon}
          onClick={() => setEditing(true)}
          label="Edit Pool Details"
          className={S("details__edit")}
        />

        <div className={S("details__header")}>
          Pool Details
        </div>
        <div className={S("details__title")}>
          {pool.name || poolId}
        </div>
        {
          !pool.description ? null :
            <div className={S("details__text", "details__description")}>
              {pool.description}
            </div>
        }
        <div className={S("details__break")}/>
        <div className={S("details__subtitle")}>
          Entities: {entityCount}
        </div>
        <div className={S("details__subtitle")}>
          Assets: {assetCount}
        </div>
        <div className={S("details__break")}/>
        {
          pool.attributes.length === 0 ? null :
            <>
              <div className={S("details__subtitle")}>
                Attributes
              </div>
              {
                pool.attributes.map(attribute =>
                  <div key={attribute.key} className={S("details__text")}>
                    {attribute.key}
                  </div>
                )
              }
            </>
        }
      </div>
    </>
  );
});

let batchSize = 24;
const Entities = observer(({showList, filter}) => {
  const {poolId} = useParams();
  const [entities, setEntities] = useState([]);
  const [limit, setLimit] = useState(batchSize);
  const [updateIndex, setUpdateIndex] = useState(0);

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
            meta: entity.meta,
            __filterAttrs: Object.values(entity.meta || {}),
            assetCount: entity.sample_files?.length || 0
          };
        })
        .filter(entity =>
          !filter ||
          filter.trim().split(/\s+/).every(token =>
            entity.label?.toLowerCase()?.includes(token) ||
            entity.description?.toLowerCase()?.includes(token) ||
            entity.__filterAttrs.find(attr => attr?.toLowerCase()?.includes(token))
          )
        )
        .slice(0, limit)
    );
  }, [limit, filter, updateIndex]);

  if(!pool) {
    return null;
  }

  if(entities.length === 0) {
    return (
      <div className={S("entity-grid", "entity-grid--empty")}>
        { filter ? "No Results" : "No Entities" }
      </div>
    );
  }

  const Component = showList ? EntityListItem : EntityCard;
  return (
    <InfiniteScroll
      key={`scroll-${showList}`}
      scrollPreservationKey={`pool-${poolId}-${showList}`}
      watchList={[filter]}
      batchSize={batchSize}
      Update={newLimit => setLimit(Math.max(limit, newLimit))}
      className={S(showList ? "entity-list" : "entity-grid")}
    >
      {
        entities.map(entity =>
          <Component
            key={`entity-${entity.id}`}
            link={UrlJoin("/", poolId, "entities", entity.id)}
            label={entity.label}
            count={entity.assetCount || 0}
            image={entity.image?.url}
            tooltip={
              <div className={S("tooltip", "entity-card__tooltip")}>
                <div className={S("entity-card__tooltip-label")}>{entity.label}</div>
                {
                  pool.attributes.map(attribute =>
                    <div key={attribute.key} className={S("entity-card__tooltip-attribute")}>
                      <label>{attribute.key}:</label>
                      <div>{entity?.meta?.[attribute.key] || ""}</div>
                    </div>
                  )
                }
              </div>
            }
            actions={
              <GroundTruthEntityMenu
                poolId={poolId}
                entityId={entity.id}
                Update={() => setUpdateIndex(updateIndex + 1)}
              />
            }
          />
        )
      }
    </InfiniteScroll>
  );
});

const GroundTruthPool = observer(() => {
  const {poolId} = useParams();
  const [filter, setFilter] = useState("");
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showList, setShowList] = useState(StorageHandler.get({type: "session", key: "pool-display"}) || false);
  const pool = groundTruthStore.pools[poolId] || {};
  const [, navigate] = useLocation();

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  useEffect(() => {
    showList ?
      StorageHandler.set({type: "session", key: "pool-display", value: "true"}) :
      StorageHandler.remove({type: "session", key: "pool-display"});
  }, [showList]);

  if(!pool) {
    return <Redirect to="/" />;
  }

  return (
    <>
      <div className={S("browser-page")}>
        <div className={S("browser")}>
          <SearchBar
            filterKey="pool"
            filterId={`${poolId}`}
            placeholder="Label, Description, Attributes"
            filter={filter}
            setFilter={setFilter}
          />
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
            <GroundTruthPoolSaveButton
              poolId={poolId}
              className={S("browser__save", "browser__action--right")}
            />
          </h1>
          <div className={S("browser__actions")}>
            <StyledButton
              icon={CreateIcon}
              onClick={() => setShowEntityModal(true)}
            >
              New Entity
            </StyledButton>
            <CardDisplaySwitch showList={showList} setShowList={setShowList} />
          </div>
          {
            !pool?.metadata ?
              <div className={S("browser-table", "browser-table--loading")}>
                <Loader/>
              </div> :
              <div className={S("list-page")}>
                <Entities showList={showList} filter={filter}/>
                <PoolDetails/>
              </div>
          }
        </div>
      </div>
      {
        !showEntityModal ? null :
          <GroundTruthEntityForm
            poolId={poolId}
            Close={entityId => {
              setShowEntityModal(false);
              entityId && navigate(UrlJoin("/", poolId, "entities", entityId));
            }}
          />
      }
    </>
  );
});

export default GroundTruthPool;
