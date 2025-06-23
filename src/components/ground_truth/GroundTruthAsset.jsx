import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect} from "react";
import {groundTruthStore} from "@/stores/index.js";
import {IconButton, Linkish, LoaderImage} from "@/components/common/Common.jsx";
import BackIcon from "@/assets/icons/v2/back.svg";
import UrlJoin from "url-join";

import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(BrowserStyles, GroundTruthStyles);

const GroundTruthAsset = observer(() => {
  const {poolId, entityId, assetIndexOrId} = useParams();

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId];
  let asset =
    (entity?.sample_files || []).find(asset => asset.id && asset.id === assetIndexOrId) ||
    (entity?.sample_files || [])[assetIndexOrId];
  const filename = asset?.link?.["/"]?.split("/")?.slice(-1)[0];

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  return (
    <div className={S("browser-page", "asset-page")}>
      <div className={S("browser")}>
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Ground Truth Entity"
            to={UrlJoin("/", poolId, "entities", entityId)}
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
          <Linkish to={UrlJoin("/", poolId, "entities", entityId)}>
            {entity?.label || entityId}
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <span>
            {asset?.label || filename || assetIndexOrId}
          </span>
        </h1>
        <div className={S("asset-page__content")}>
        <div className={S("asset-page__image-container")}>
            <LoaderImage
              src={asset?.link?.url}
              loaderDelay={0}
              loaderAspectRatio={1}
              className={S("asset-page__image")}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default GroundTruthAsset;
