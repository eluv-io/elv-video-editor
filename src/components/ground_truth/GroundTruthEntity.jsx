import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useParams} from "wouter";
import {groundTruthStore} from "@/stores/index.js";
import {Icon, IconButton, Linkish, Loader, LoaderImage, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {SearchBar} from "@/components/nav/Browser.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import UrlJoin from "url-join";
import {Tooltip} from "@mantine/core";
import {
  GroundTruthAssetFileBrowser,
  GroundTruthAssetForm,
  GroundTruthEntityForm, GroundTruthPoolSaveButton,
} from "@/components/ground_truth/GroundTruthForms.jsx";

import ImageIcon from "@/assets/icons/v2/asset.svg";
import MenuIcon from "@/assets/icons/v2/dots-vertical.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";

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


let batchSize = 24;
const Assets = observer(({filter}) => {
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
          asset.filename?.toLowerCase()?.includes(filter)
        )
        .slice(0, limit)
    );
  }, [limit, filter]);

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
            key={`asset-${asset.id || index}`}
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
              {
                !asset.anchor ? null :
                  <Icon icon={AnchorIcon} className={S("entity-card__image-badge")} />
              }
            </div>
            <div className={S("entity-card__text")}>
              <Tooltip openDelay={500} label={asset.label || asset.filename}>
                <div className={S("entity-card__title-text", "ellipsis")}>
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

  const [showAssetModal, setShowAssetModal] = useState(false);

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

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
          <div className={S("browser__actions")}>
            <StyledButton
              icon={GroundTruthIcon}
              onClick={() => setShowAssetModal(true)}
            >
              Add New Ground Truth Assets
            </StyledButton>
            <GroundTruthPoolSaveButton
              poolId={poolId}
              className={S("browser__save")}
            />
          </div>
          {
            !entity ?
              <div className={S("browser-table", "browser-table--loading")}>
                <Loader/>
              </div> :
              <div className={S("list-page")}>
                <Assets key={`assets-${showAssetModal}`} filter={filter}/>
                <EntityDetails key={`details-${showAssetModal}`} />
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
