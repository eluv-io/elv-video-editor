import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useParams} from "wouter";
import {groundTruthStore} from "@/stores/index.js";
import {IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, StorageHandler} from "@/utils/Utils.js";
import {CardDisplaySwitch, SearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {
  GroundTruthAssetFileBrowser,
  GroundTruthAssetMenu,
  GroundTruthEntityForm,
  GroundTruthPoolSaveButton
} from "@/components/ground_truth/GroundTruthForms.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import {EntityCard, EntityListItem} from "@/components/common/EntityLists.jsx";

const S = CreateModuleClassMatcher(BrowserStyles, GroundTruthStyles);


const EntityDetails = observer(() => {
  const {poolId, entityId} = useParams();
  const [editing, setEditing] = useState(false);

  const pool = groundTruthStore.pools[poolId];
  const entity = pool?.metadata?.entities?.[entityId];

  if(!pool || !pool.metadata || !entity) { return null; }

  return (
    <>
      {
        !editing ? null :
          <GroundTruthEntityForm
            poolId={poolId}
            entityId={entityId}
            Close={() => setEditing(false)}
          />
      }
      <div className={S("details")}>
        <IconButton
          icon={EditIcon}
          onClick={() => setEditing(true)}
          label="Edit Entity Details"
          className={S("details__edit")}
        />

        <div className={S("details__header")}>
          Entity Details
        </div>
        <div className={S("details__title")}>
          {entity.label || entityId}
        </div>
        {
          !entity.description ? null :
            <div className={S("details__text", "details__description")}>
              {entity.description}
            </div>
        }
        <div className={S("details__break")}/>
        <div className={S("details__subtitle")}>
          Assets: {entity.sample_files?.length || 0}
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
                  <div key={attribute.key} className={S("details__field")}>
                    <label>{attribute.key}:</label>
                    <div>{entity?.meta?.[attribute.key] || ""}</div>
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
const Assets = observer(({filter, showList, updateIndex, setUpdateIndex}) => {
  const {poolId, entityId} = useParams();

  const pool = groundTruthStore.pools[poolId];
  const entity = pool?.metadata?.entities?.[entityId];
  const [assets, setAssets] = useState([]);
  const [limit, setLimit] = useState(batchSize);

  filter = filter.toLowerCase();

  useEffect(() => {
    let assets = (entity?.sample_files || []).map((asset, index) => ({
      ...asset,
      index,
      filename: asset.link?.["/"]?.split("/")?.slice(-1)[0]
    }));

    // Show anchor image first
    const anchorImageIndex = assets.findIndex(file => file.anchor);

    if(anchorImageIndex >= 0) {
      assets = [
        assets[anchorImageIndex],
        ...assets.filter((_, index) => index !== anchorImageIndex)
      ];
    }

    setAssets(
      assets
        .filter(asset =>
          !filter ||
          asset.label?.toLowerCase()?.includes(filter) ||
          asset.description?.toLowerCase()?.includes(filter) ||
          asset.filename?.toLowerCase()?.includes(filter)
        )
        .slice(0, limit)
    );
  }, [limit, filter, updateIndex]);

  if(!pool) {
    return null;
  }

  if(assets.length === 0) {
    return (
      <div className={S("entity-grid", "entity-grid--empty")}>
        { filter ? "No Results" : "No Assets" }
      </div>
    );
  }

  let Component = showList ? EntityListItem : EntityCard;
  return (
    <InfiniteScroll
      key={`scroll-${showList}`}
      watchList={[filter]}
      batchSize={batchSize}
      Update={newLimit => setLimit(Math.max(limit, newLimit))}
      className={S(showList ? "entity-list" : "entity-grid")}
    >
      {
        assets.map(asset =>
          <Component
            listItem={showList}
            key={`asset-${asset.id || asset.index}`}
            link={UrlJoin("/", poolId, "entities", entityId, "assets", asset.id || asset.index.toString())}
            label={asset.label || asset.filename}
            image={asset.link?.url}
            contain
            anchor={asset.anchor}
            actions={
              <GroundTruthAssetMenu
                poolId={poolId}
                entityId={entityId}
                assetIndexOrId={asset.id || asset.index}
                Update={() => setUpdateIndex(updateIndex + 1)}
              />
            }
          />
        )
      }
    </InfiniteScroll>
  );
});

const GroundTruthEntity = observer(() => {
  const {poolId, entityId} = useParams();

  const [filter, setFilter] = useState("");
  const [showList, setShowList] = useState(StorageHandler.get({type: "session", key: "entity-display"}) || false);
  const [updateIndex, setUpdateIndex] = useState(0);

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId];

  const [showAssetModal, setShowAssetModal] = useState(false);

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  useEffect(() => {
    if(!showAssetModal) {
      setUpdateIndex(updateIndex + 1);
    }
  }, [showAssetModal]);

  useEffect(() => {
    showList ?
      StorageHandler.set({type: "session", key: "entity-display", value: "true"}) :
      StorageHandler.remove({type: "session", key: "entity-display"});
  }, [showList]);

  if(!pool?.metadata) {
    return <Loader />;
  }

  if(!entity) {
    return <Redirect to={UrlJoin("/", poolId)} />;
  }

  return (
    <>
      <div className={S("browser-page")}>
        <div className={S("browser")}>
          <SearchBar
            filterKey="entity"
            filterId={`${poolId}-${entityId}`}
            placeholder="Label, Description, Filename"
            filter={filter}
            setFilter={setFilter}
          />
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
            <span className={S("browser__header-last")}>
              {entity.label || entityId}
            </span>
            <GroundTruthPoolSaveButton
              poolId={poolId}
              small
              className={S("browser__save", "browser__action--right")}
            />
          </h1>
          <div className={S("browser__actions")}>
            <StyledButton
              icon={GroundTruthIcon}
              onClick={() => setShowAssetModal(true)}
            >
              Add New Ground Truth Assets
            </StyledButton>
            <CardDisplaySwitch
              showList={showList}
              setShowList={setShowList}
            />
          </div>
          {
            !entity ?
              <div className={S("browser-table", "browser-table--loading")}>
                <Loader/>
              </div> :
              <div className={S("list-page", "list-page--with-sidebar")}>
                <Assets
                  filter={filter}
                  showList={showList}
                  updateIndex={updateIndex}
                  setUpdateIndex={setUpdateIndex}
                />
                <EntityDetails key={`details-${updateIndex}`} />
              </div>
          }
        </div>
      </div>
      {
        !showAssetModal ? null :
          <GroundTruthAssetFileBrowser
            poolId={poolId}
            entityId={entityId}
            Close={() => setShowAssetModal(false)}
          />
      }
    </>
  );
});

export default GroundTruthEntity;
