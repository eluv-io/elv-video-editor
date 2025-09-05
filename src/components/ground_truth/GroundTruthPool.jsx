import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useLocation, useParams, useSearchParams} from "wouter";
import {groundTruthStore} from "@/stores/index.js";
import {Confirm, IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, StorageHandler} from "@/utils/Utils.js";
import {CardDisplaySwitch, SearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {
  GroundTruthEntityForm, GroundTruthEntityMenu, GroundTruthMultiEntityAssetForm,
  GroundTruthPoolForm,
  GroundTruthPoolSaveButton
} from "@/components/ground_truth/GroundTruthForms.jsx";
import {EntityCard, EntityListItem} from "@/components/common/EntityLists.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import CreateIcon from "@/assets/icons/v2/add2.svg";
import RebuildModelIcon from "@/assets/icons/v2/rebuild-model.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";

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

let batchSize = 25;
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
            contain
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
  const [queryParams] = useSearchParams();
  const filter = decodeURIComponent(queryParams.get("q") || "");
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showList, setShowList] = useState(StorageHandler.get({type: "session", key: "pool-display"}) || false);
  const pool = groundTruthStore.pools[poolId] || {};
  const [updateKey, setUpdateKey] = useState(0);
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
            saveByLocation
            placeholder="Label, Description, Attributes"
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
            <span className={S("browser__header-last")}>
              {pool.name || pool.objectId}
            </span>
            <div className={S("browser__header-actions")}>
              {
                !pool.lastModified ? null :
                  <div style={{marginRight: 10}}>Last Modified {pool.lastModified.toLocaleString()}</div>
              }
              <StyledButton
                icon={RebuildModelIcon}
                small
                disabled={pool.embeddingsBuilt}
                onClick={async () =>
                  await Confirm({
                    title: "Rebuild Model",
                    text: "Are you sure you want to rebuild the model for this ground truth pool? This may take several minutes.",
                    onConfirm: async () => await groundTruthStore.RebuildGroundTruthPool({poolId})
                  })
                }
              >
                Rebuild Model
              </StyledButton>
              <GroundTruthPoolSaveButton
                poolId={poolId}
                small
              />
            </div>
          </h1>
          <div className={S("browser__actions")}>
            <StyledButton
              icon={CreateIcon}
              onClick={() => setShowEntityModal(true)}
            >
              New Entity
            </StyledButton>
            <StyledButton
              icon={GroundTruthIcon}
              onClick={() => setShowAssetModal(true)}
            >
              Add New Ground Truth Assets
            </StyledButton>
            <CardDisplaySwitch showList={showList} setShowList={setShowList} />
          </div>
          {
            !pool?.metadata ?
              <div className={S("browser-table", "browser-table--loading")}>
                <Loader/>
              </div> :
              <div className={S("list-page", "list-page--with-sidebar")}>
                <Entities key={updateKey} showList={showList} filter={filter}/>
                <PoolDetails/>
              </div>
          }
        </div>
      </div>
      {
        !showEntityModal ? null :
          <GroundTruthEntityForm
            title="Create Ground Truth Entity"
            poolId={poolId}
            showForm
            showAssets
            Close={entityId => {
              setShowEntityModal(false);
              entityId && navigate(UrlJoin("/", poolId, "entities", entityId));
            }}
          />
      }
      {
        !showAssetModal ? null :
          <GroundTruthMultiEntityAssetForm
            title="Add New Ground Truth Assets"
            poolId={poolId}
            showAssets
            showEntitySelection
            Close={() => {
              setShowAssetModal(false);
              setUpdateKey(Math.random());
            }}
          />
      }
    </>
  );
});

export default GroundTruthPool;
